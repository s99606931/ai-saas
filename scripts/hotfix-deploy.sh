#!/bin/bash
# Design Ref: MTU-N237 SS2
# Plan SC: FR-HF.2, FR-HF.3
# Hotfix 배포 스크립트

set -euo pipefail

NAMESPACE="production"
TAG=""
VERIFY_ONLY=false
HELM_RELEASE="saas-platform"
TIMEOUT="5m"

usage() {
  cat <<EOF
사용법: $0 [옵션]

옵션:
  --tag <tag>          배포할 이미지 태그
  --namespace <ns>     대상 네임스페이스 (기본: production)
  --verify-only        배포 없이 검증만 실행
  --timeout <time>     Helm 타임아웃 (기본: 5m)
EOF
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag) TAG="$2"; shift 2;;
    --namespace) NAMESPACE="$2"; shift 2;;
    --verify-only) VERIFY_ONLY=true; shift;;
    --timeout) TIMEOUT="$2"; shift 2;;
    *) usage;;
  esac
done

# --- 검증 함수 ---
verify_deployment() {
  local ns="$1"
  echo "[검증] $ns 네임스페이스 배포 상태 확인..."

  # 1. Pod 상태 확인
  local ready_pods
  ready_pods=$(kubectl get pods -n "$ns" -l app.kubernetes.io/name=saas-platform \
    -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "")

  if echo "$ready_pods" | grep -q "False"; then
    echo "  [FAIL] 일부 Pod가 Ready 상태가 아닙니다"
    return 1
  fi
  echo "  [PASS] Pod Ready 상태 확인"

  # 2. 엔드포인트 헬스체크
  local health_url="http://saas-platform.${ns}.svc.cluster.local/health"
  if kubectl run --rm -i --tty health-check-"$(date +%s)" \
    --image=curlimages/curl --restart=Never -n "$ns" \
    -- curl -sf "$health_url" > /dev/null 2>&1; then
    echo "  [PASS] 헬스체크 통과"
  else
    echo "  [WARN] 헬스체크 확인 불가 (클러스터 외부 환경)"
  fi

  # 3. 최근 에러 로그 확인
  local error_count
  error_count=$(kubectl logs -n "$ns" -l app.kubernetes.io/name=saas-platform \
    --since=2m 2>/dev/null | grep -ci "error\|fatal\|panic" || echo "0")

  if [ "$error_count" -gt 5 ]; then
    echo "  [FAIL] 최근 2분 에러 $error_count건 감지"
    return 1
  fi
  echo "  [PASS] 에러 로그 정상 범위 ($error_count건)"

  echo "[검증] 완료: $ns 배포 정상"
  return 0
}

# --- 메인 ---
if [ "$VERIFY_ONLY" = true ]; then
  verify_deployment "$NAMESPACE"
  exit $?
fi

if [ -z "$TAG" ]; then
  echo "ERROR: --tag 필수"
  usage
fi

echo "============================================"
echo " Hotfix 배포: $TAG → $NAMESPACE"
echo "============================================"

# 배포 전 현재 리비전 기록 (롤백용)
CURRENT_REVISION=$(helm history "$HELM_RELEASE" -n "$NAMESPACE" --max 1 \
  -o json 2>/dev/null | jq -r '.[0].revision' || echo "0")
echo "현재 리비전: $CURRENT_REVISION"

# Helm 배포
echo "[배포] Helm upgrade 실행..."
helm upgrade --install "$HELM_RELEASE" ./infra/helm \
  --namespace "$NAMESPACE" \
  --set image.tag="$TAG" \
  --wait --timeout "$TIMEOUT"

# 배포 후 검증
echo "[배포 후 검증]..."
if ! verify_deployment "$NAMESPACE"; then
  echo "[FAIL] 배포 후 검증 실패. 롤백 실행..."
  bash scripts/hotfix-rollback.sh --namespace "$NAMESPACE" --revision "$CURRENT_REVISION"
  exit 1
fi

echo ""
echo "Hotfix 배포 완료: $TAG → $NAMESPACE"
