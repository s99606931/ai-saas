#!/usr/bin/env bash
# =============================================================================
# 운영 런북 자동화 — 장애 대응 자동화 스크립트
# Design Ref: MTU-N248 S3.3
# Plan SC: FR-N248.5
# CSAP: D-06 (침해사고 관리 — 장애 대응)
#
# 사용법:
#   ./scripts/ops-runbook.sh crashloop         # CrashLoopBackOff 대응
#   ./scripts/ops-runbook.sh disk-full         # 디스크 사용량 대응
#   ./scripts/ops-runbook.sh cert-expiry       # 인증서 만료 대응
#   ./scripts/ops-runbook.sh db-connections    # DB 연결 고갈 대응
#   ./scripts/ops-runbook.sh high-memory       # 메모리 사용량 대응
#   ./scripts/ops-runbook.sh list              # 런북 목록
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNBOOK="${1:-list}"
NAMESPACE="${2:-saas-production}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_step()  { echo -e "${BLUE}[STEP]${NC} $1"; }
log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# --- CrashLoopBackOff 대응 ---
runbook_crashloop() {
  echo "================================================================"
  echo "  런북: CrashLoopBackOff 대응"
  echo "  네임스페이스: $NAMESPACE"
  echo "================================================================"

  log_step "1. CrashLoopBackOff Pod 식별"
  CRASH_PODS=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | grep CrashLoop | awk '{print $1}' || echo "")

  if [ -z "$CRASH_PODS" ]; then
    log_info "CrashLoopBackOff Pod 없음"
    return 0
  fi

  echo "  문제 Pod: $CRASH_PODS"

  log_step "2. Pod 로그 확인"
  for pod in $CRASH_PODS; do
    echo "  --- $pod 최근 로그 ---"
    kubectl logs "$pod" -n "$NAMESPACE" --tail=20 2>/dev/null || \
      kubectl logs "$pod" -n "$NAMESPACE" --previous --tail=20 2>/dev/null || \
      echo "  로그 접근 불가"
    echo ""
  done

  log_step "3. Pod 이벤트 확인"
  for pod in $CRASH_PODS; do
    kubectl describe pod "$pod" -n "$NAMESPACE" 2>/dev/null | grep -A5 "Events:" || true
  done

  log_step "4. 리소스 제한 확인"
  for pod in $CRASH_PODS; do
    kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{range .spec.containers[*]}{.name}: CPU={.resources.limits.cpu}, Mem={.resources.limits.memory}{"\n"}{end}' 2>/dev/null || true
  done

  log_step "5. 권장 조치"
  echo "  a) OOMKilled인 경우: 메모리 제한 증가"
  echo "  b) 설정 오류: 환경 변수/시크릿 확인"
  echo "  c) 의존 서비스 장애: DB/Redis 상태 확인"
  echo "  d) 긴급 조치: kubectl rollout restart deployment/<name> -n $NAMESPACE"
}

# --- 디스크 사용량 대응 ---
runbook_disk_full() {
  echo "================================================================"
  echo "  런북: 디스크 사용량 대응"
  echo "================================================================"

  log_step "1. 노드별 디스크 사용량 확인"
  kubectl get nodes -o custom-columns='NAME:.metadata.name' --no-headers 2>/dev/null | while read -r node; do
    echo "  노드: $node"
    kubectl describe node "$node" 2>/dev/null | grep -A3 "Allocated resources" || true
  done

  log_step "2. PVC 사용량 확인"
  kubectl get pvc -A --no-headers 2>/dev/null | while read -r line; do
    echo "  $line"
  done

  log_step "3. 대용량 Pod 로그 확인"
  echo "  컨테이너 로그 디스크 사용량:"
  du -sh /var/log/containers/ 2>/dev/null || echo "  접근 불가"

  log_step "4. 권장 조치"
  echo "  a) 오래된 로그 정리: kubectl logs --tail=0 으로 트렁케이트"
  echo "  b) 미사용 이미지 정리: crictl rmi --prune"
  echo "  c) PVC 확장: kubectl edit pvc <name>"
  echo "  d) 로그 로테이션 설정 확인"
}

# --- 인증서 만료 대응 ---
runbook_cert_expiry() {
  echo "================================================================"
  echo "  런북: 인증서 만료 대응"
  echo "================================================================"

  log_step "1. cert-manager 인증서 상태 확인"
  if kubectl get certificates -A &>/dev/null 2>&1; then
    kubectl get certificates -A --no-headers 2>/dev/null | while read -r line; do
      echo "  $line"
    done
  else
    log_warn "cert-manager 미설치 또는 접근 불가"
  fi

  log_step "2. TLS 시크릿 만료일 확인"
  kubectl get secrets -A -o json 2>/dev/null | \
    jq -r '.items[] | select(.type=="kubernetes.io/tls") | "\(.metadata.namespace)/\(.metadata.name)"' 2>/dev/null | \
    head -10 | while read -r secret; do
      NS=$(echo "$secret" | cut -d'/' -f1)
      NAME=$(echo "$secret" | cut -d'/' -f2)
      EXPIRY=$(kubectl get secret "$NAME" -n "$NS" -o jsonpath='{.data.tls\.crt}' 2>/dev/null | \
        base64 -d 2>/dev/null | \
        openssl x509 -noout -enddate 2>/dev/null | \
        sed 's/notAfter=//' || echo "확인 불가")
      echo "  $secret → 만료: $EXPIRY"
    done

  log_step "3. 권장 조치"
  echo "  a) cert-manager 자동 갱신 확인"
  echo "  b) 수동 갱신: kubectl delete certificate <name> (cert-manager 재발급)"
  echo "  c) k3s 자체 인증서: k3s certificate rotate"
}

# --- DB 연결 고갈 대응 ---
runbook_db_connections() {
  echo "================================================================"
  echo "  런북: 데이터베이스 연결 고갈 대응"
  echo "================================================================"

  log_step "1. PostgreSQL 연결 수 확인"
  PG_POD=$(kubectl get pods -n "$NAMESPACE" -l app=postgres --no-headers 2>/dev/null | awk '{print $1}' | head -1 || echo "")

  if [ -n "$PG_POD" ]; then
    kubectl exec "$PG_POD" -n "$NAMESPACE" -- psql -U saas -c "SELECT count(*) as connections FROM pg_stat_activity;" 2>/dev/null || \
      log_warn "PostgreSQL 쿼리 실행 실패"
  else
    log_warn "PostgreSQL Pod 미확인"
  fi

  log_step "2. 서비스별 연결 풀 설정 확인"
  echo "  각 서비스의 DATABASE_URL 환경 변수에서 pool_size 확인"
  kubectl get deployments -n "$NAMESPACE" -o jsonpath='{range .items[*]}{.metadata.name}: {range .spec.template.spec.containers[*]}{range .env[?(@.name=="DATABASE_URL")]}{.value}{end}{end}{"\n"}{end}' 2>/dev/null || true

  log_step "3. 권장 조치"
  echo "  a) 연결 풀 크기 조정 (pgBouncer 도입 검토)"
  echo "  b) idle 연결 타임아웃 설정"
  echo "  c) max_connections 증가 (PostgreSQL 설정)"
  echo "  d) 긴급: 서비스 순차 재시작으로 연결 해제"
}

# --- 메모리 사용량 대응 ---
runbook_high_memory() {
  echo "================================================================"
  echo "  런북: 메모리 사용량 대응"
  echo "================================================================"

  log_step "1. 메모리 사용량 상위 Pod"
  kubectl top pods -n "$NAMESPACE" --sort-by=memory 2>/dev/null | head -10 || \
    log_warn "kubectl top 실행 불가 (metrics-server 확인)"

  log_step "2. OOMKilled Pod 확인"
  kubectl get pods -n "$NAMESPACE" -o json 2>/dev/null | \
    jq -r '.items[] | select(.status.containerStatuses[]?.lastState.terminated.reason == "OOMKilled") | .metadata.name' 2>/dev/null | \
    while read -r pod; do
      echo "  OOMKilled: $pod"
    done

  log_step "3. 권장 조치"
  echo "  a) 메모리 제한 상향 (resources.limits.memory)"
  echo "  b) 메모리 누수 확인 (Pyroscope 프로파일링)"
  echo "  c) HPA 설정 확인 (자동 스케일링)"
  echo "  d) 긴급: kubectl rollout restart deployment/<name>"
}

# --- 런북 목록 ---
list_runbooks() {
  echo "================================================================"
  echo "  사용 가능한 운영 런북"
  echo "================================================================"
  echo ""
  echo "  crashloop       CrashLoopBackOff Pod 대응"
  echo "  disk-full       디스크 사용량 90%+ 대응"
  echo "  cert-expiry     인증서 만료 대응"
  echo "  db-connections  데이터베이스 연결 고갈 대응"
  echo "  high-memory     메모리 사용량 대응"
  echo ""
  echo "사용법: $0 <runbook> [namespace]"
  echo "  기본 네임스페이스: saas-production"
}

# --- 라우팅 ---
case "$RUNBOOK" in
  crashloop)       runbook_crashloop ;;
  disk-full)       runbook_disk_full ;;
  cert-expiry)     runbook_cert_expiry ;;
  db-connections)  runbook_db_connections ;;
  high-memory)     runbook_high_memory ;;
  list|--help|-h)  list_runbooks ;;
  *)
    log_error "알 수 없는 런북: $RUNBOOK"
    list_runbooks
    exit 1
    ;;
esac

# 감사 로그
TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
echo "{\"timestamp\":\"${TIMESTAMP}\",\"action\":\"RUNBOOK_EXECUTED\",\"runbook\":\"$RUNBOOK\",\"namespace\":\"$NAMESPACE\",\"csap_ref\":\"D-06\"}" >> "$PROJECT_DIR/.claude/audit.jsonl" 2>/dev/null || true
