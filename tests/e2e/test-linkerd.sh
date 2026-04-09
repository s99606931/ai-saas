#!/bin/bash
# =============================================================================
# Linkerd 서비스 메시 통합 테스트
# Design Ref: MTU-N54 Section 3.6
# Plan SC: FR-N54.12
# =============================================================================

set -euo pipefail

PASS=0
FAIL=0
TOTAL=0

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

log_test() {
  local tc_id="$1"; local desc="$2"; local result="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$result" = "PASS" ]; then
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}[PASS]${NC} $tc_id: $desc"
  else
    FAIL=$((FAIL + 1))
    echo -e "  ${RED}[FAIL]${NC} $tc_id: $desc"
  fi
}

echo "=============================================="
echo " Linkerd 서비스 메시 통합 테스트"
echo " MTU-N54: Linkerd + mTLS Zero Trust"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="
echo ""

LINKERD_DIR="/data/ai-saas/infra/linkerd"

# --- TC-01: 설치 스크립트 존재 ---
echo "[Phase 1] 설치 설정 검증"
if [ -f "${LINKERD_DIR}/install.sh" ] && [ -x "${LINKERD_DIR}/install.sh" ]; then
  HAS_HELM=$(grep -c "helm install" "${LINKERD_DIR}/install.sh" || true)
  HAS_CERT=$(grep -c "step certificate" "${LINKERD_DIR}/install.sh" || true)
  if [ "$HAS_HELM" -ge 1 ] && [ "$HAS_CERT" -ge 1 ]; then
    log_test "TC-01" "Linkerd 설치 스크립트 완비 (Helm + step)" "PASS"
  else
    log_test "TC-01" "설치 스크립트 불완전" "FAIL"
  fi
else
  log_test "TC-01" "install.sh 미존재 또는 비실행" "FAIL"
fi

# --- TC-02: Control Plane Values 검증 ---
if [ -f "${LINKERD_DIR}/values.yaml" ]; then
  HAS_TRUST=$(grep -c "identityTrustAnchorsPEM" "${LINKERD_DIR}/values.yaml" || true)
  HAS_ISSUER=$(grep -c "issuer:" "${LINKERD_DIR}/values.yaml" || true)
  HAS_PROXY=$(grep -c "proxy:" "${LINKERD_DIR}/values.yaml" || true)
  HAS_ISSUANCE=$(grep -c "issuanceLifetime:" "${LINKERD_DIR}/values.yaml" || true)
  if [ "$HAS_TRUST" -ge 1 ] && [ "$HAS_ISSUER" -ge 1 ] && [ "$HAS_PROXY" -ge 1 ] && [ "$HAS_ISSUANCE" -ge 1 ]; then
    log_test "TC-02" "Helm values 필수 항목 (Trust Anchor, Issuer, Proxy, 24h)" "PASS"
  else
    log_test "TC-02" "Helm values 항목 누락" "FAIL"
  fi
else
  log_test "TC-02" "values.yaml 미존재" "FAIL"
fi

# --- TC-03: Trust Anchor 가이드 ---
if [ -f "${LINKERD_DIR}/trust-anchor-guide.md" ]; then
  HAS_STEP=$(grep -c "step certificate" "${LINKERD_DIR}/trust-anchor-guide.md" || true)
  HAS_ROTATION=$(grep -c "회전" "${LINKERD_DIR}/trust-anchor-guide.md" || true)
  HAS_WSL2=$(grep -c "WSL2" "${LINKERD_DIR}/trust-anchor-guide.md" || true)
  if [ "$HAS_STEP" -ge 2 ] && [ "$HAS_ROTATION" -ge 2 ] && [ "$HAS_WSL2" -ge 1 ]; then
    log_test "TC-03" "Trust Anchor 가이드 (step CLI, 회전 절차, WSL2)" "PASS"
  else
    log_test "TC-03" "Trust Anchor 가이드 내용 불충분" "FAIL"
  fi
else
  log_test "TC-03" "trust-anchor-guide.md 미존재" "FAIL"
fi

# --- TC-04: Helm values 리소스 설정 ---
if grep -q "request: 10m" "${LINKERD_DIR}/values.yaml" && \
   grep -q "limit: 100m" "${LINKERD_DIR}/values.yaml" && \
   grep -q "limit: 50Mi" "${LINKERD_DIR}/values.yaml"; then
  log_test "TC-04" "프록시 리소스 경량 설정 (10m/100m CPU, 10Mi/50Mi Mem)" "PASS"
else
  log_test "TC-04" "프록시 리소스 설정 누락" "FAIL"
fi

# --- TC-05: mTLS 설정 ---
if grep -q "issuanceLifetime: 24h0m0s" "${LINKERD_DIR}/values.yaml" && \
   grep -q "opaquePorts" "${LINKERD_DIR}/values.yaml"; then
  log_test "TC-05" "mTLS 24시간 인증서 회전 + opaquePorts 설정" "PASS"
else
  log_test "TC-05" "mTLS 설정 불완전" "FAIL"
fi

# --- TC-06~11: ServiceProfile 6개 검증 ---
echo ""
echo "[Phase 2] ServiceProfile 검증 (6개 서비스)"
PROFILES=(
  "auth-service|TC-06|auth-service ServiceProfile"
  "api-gateway|TC-07|api-gateway ServiceProfile"
  "tenant-service|TC-08|tenant-service ServiceProfile"
  "audit-service|TC-09|audit-service ServiceProfile"
  "ai-gateway|TC-10|ai-gateway ServiceProfile"
  "catalog-service|TC-11|catalog-service ServiceProfile"
)

for entry in "${PROFILES[@]}"; do
  IFS='|' read -r svc tc_id desc <<< "$entry"
  PROFILE_FILE="${LINKERD_DIR}/service-profiles/${svc}.yaml"
  if [ -f "$PROFILE_FILE" ]; then
    HAS_KIND=$(grep -c "kind: ServiceProfile" "$PROFILE_FILE" || true)
    HAS_ROUTES=$(grep -c "routes:" "$PROFILE_FILE" || true)
    HAS_TIMEOUT=$(grep -c "timeout:" "$PROFILE_FILE" || true)
    HAS_RETRY=$(grep -c "retryBudget:" "$PROFILE_FILE" || true)
    if [ "$HAS_KIND" -ge 1 ] && [ "$HAS_ROUTES" -ge 1 ] && [ "$HAS_TIMEOUT" -ge 1 ] && [ "$HAS_RETRY" -ge 1 ]; then
      log_test "$tc_id" "$desc (routes + timeout + retryBudget)" "PASS"
    else
      log_test "$tc_id" "$desc (형식 불완전)" "FAIL"
    fi
  else
    log_test "$tc_id" "$desc (파일 미존재)" "FAIL"
  fi
done

# --- TC-12: AuthorizationPolicy 검증 ---
echo ""
echo "[Phase 3] AuthorizationPolicy 및 Zero Trust"
AUTH_DIR="${LINKERD_DIR}/authorization"
if [ -f "${AUTH_DIR}/auth-service-policy.yaml" ] && [ -f "${AUTH_DIR}/default-deny.yaml" ]; then
  HAS_AP=$(grep -c "kind: AuthorizationPolicy" "${AUTH_DIR}/auth-service-policy.yaml" || true)
  HAS_MTLS_AUTH=$(grep -c "MeshTLSAuthentication" "${AUTH_DIR}/auth-service-policy.yaml" || true)
  HAS_DENY=$(grep -c "default-deny" "${AUTH_DIR}/default-deny.yaml" || true)
  if [ "$HAS_AP" -ge 1 ] && [ "$HAS_MTLS_AUTH" -ge 1 ] && [ "$HAS_DENY" -ge 1 ]; then
    log_test "TC-12" "AuthorizationPolicy + Default Deny (Zero Trust)" "PASS"
  else
    log_test "TC-12" "AuthorizationPolicy 내용 불완전" "FAIL"
  fi
else
  log_test "TC-12" "AuthorizationPolicy 파일 누락" "FAIL"
fi

# --- TC-13: Grafana 대시보드 ---
DASHBOARD="/data/ai-saas/infra/monitoring/dashboards/linkerd-dashboard.json"
if [ -f "$DASHBOARD" ]; then
  PANELS=$(python3 -c "import json; d=json.load(open('$DASHBOARD')); print(len(d.get('panels',[])))" 2>/dev/null || echo "0")
  HAS_MTLS_PANEL=$(grep -c "mTLS" "$DASHBOARD" || true)
  if [ "$PANELS" -ge 4 ] && [ "$HAS_MTLS_PANEL" -ge 1 ]; then
    log_test "TC-13" "Grafana 대시보드 ${PANELS}개 패널 (mTLS 포함)" "PASS"
  else
    log_test "TC-13" "대시보드 내용 불충분" "FAIL"
  fi
else
  log_test "TC-13" "linkerd-dashboard.json 미존재" "FAIL"
fi

# --- TC-14: 재시도/타임아웃 정책 ---
echo ""
echo "[Phase 4] 트래픽 관리 정책"
RETRY_COUNT=$(grep -rl "isRetryable:" "${LINKERD_DIR}/service-profiles/" | wc -l)
TIMEOUT_COUNT=$(grep -rl "timeout:" "${LINKERD_DIR}/service-profiles/" | wc -l)
if [ "$RETRY_COUNT" -ge 6 ] && [ "$TIMEOUT_COUNT" -ge 6 ]; then
  log_test "TC-14" "Retry/Timeout 정책 전 서비스 적용 (${RETRY_COUNT}/${TIMEOUT_COUNT})" "PASS"
else
  log_test "TC-14" "Retry/Timeout 설정 불완전" "FAIL"
fi

# --- TC-15: k3s WSL2 호환성 가이드 ---
if grep -q "k3s" "${LINKERD_DIR}/trust-anchor-guide.md" && \
   grep -q "WSL2" "${LINKERD_DIR}/trust-anchor-guide.md" && \
   grep -q "flannel" "${LINKERD_DIR}/trust-anchor-guide.md"; then
  log_test "TC-15" "k3s WSL2 호환성 가이드 (CNI, iptables)" "PASS"
else
  log_test "TC-15" "k3s WSL2 호환성 정보 부족" "FAIL"
fi

# --- 최종 리포트 ---
echo ""
echo "=============================================="
echo " 테스트 결과 요약"
echo "=============================================="
echo -e " 총 테스트: ${TOTAL}"
echo -e " ${GREEN}PASS${NC}: ${PASS}"
echo -e " ${RED}FAIL${NC}: ${FAIL}"
RATE=$(awk "BEGIN {printf \"%.1f\", ($PASS/$TOTAL)*100}")
echo " 통과율: ${RATE}%"

if [ "$FAIL" -eq 0 ]; then
  echo -e "\n${GREEN}[ALL PASS] Linkerd 서비스 메시 통합 테스트 완료${NC}"
  exit 0
else
  echo -e "\n${RED}[PARTIAL] ${FAIL}건 실패${NC}"
  exit 1
fi
