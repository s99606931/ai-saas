#!/bin/bash
# =============================================================================
# MTU-N62: cert-manager TLS 인증서 자동화 검증
# Design Ref: MTU-N62.design.md §1~§4
# Plan SC: FR-N62.1~FR-N62.7
# =============================================================================

set -euo pipefail

PASS=0
FAIL=0
TOTAL=0
CM_DIR="/data/ai-saas/infra/cert-manager"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

run_test() {
  local id="$1" desc="$2" cmd="$3"
  TOTAL=$((TOTAL + 1))
  if eval "$cmd" > /dev/null 2>&1; then
    echo -e "  ${GREEN}[PASS]${NC} ${id}: ${desc}"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}[FAIL]${NC} ${id}: ${desc}"
    FAIL=$((FAIL + 1))
  fi
}

echo "============================================================"
echo " MTU-N62: cert-manager TLS 인증서 자동화 검증"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"

# --- FR-N62.1: Helm values.yaml ---
echo ""
echo "--- FR-N62.1: Helm values ---"

run_test "TC-01" "values.yaml 존재" \
  "[ -f '${CM_DIR}/values.yaml' ]"

run_test "TC-02" "CRD 설치 활성화" \
  "grep -q 'crds:' '${CM_DIR}/values.yaml' && grep -q 'enabled: true' '${CM_DIR}/values.yaml'"

run_test "TC-03" "Prometheus serviceMonitor 활성화" \
  "grep -q 'servicemonitor:' '${CM_DIR}/values.yaml'"

run_test "TC-04" "보안 컨텍스트 (runAsNonRoot)" \
  "grep -q 'runAsNonRoot: true' '${CM_DIR}/values.yaml'"

# --- FR-N62.2: Self-Signed Root CA ---
echo ""
echo "--- FR-N62.2: Self-Signed Root CA ---"

run_test "TC-05" "self-signed-issuer.yaml 존재" \
  "[ -f '${CM_DIR}/templates/self-signed-issuer.yaml' ]"

run_test "TC-06" "SelfSigned ClusterIssuer 정의" \
  "grep -q 'kind: ClusterIssuer' '${CM_DIR}/templates/self-signed-issuer.yaml' && grep -q 'selfSigned:' '${CM_DIR}/templates/self-signed-issuer.yaml'"

run_test "TC-07" "Root CA Certificate isCA: true" \
  "grep -q 'isCA: true' '${CM_DIR}/templates/self-signed-issuer.yaml'"

run_test "TC-08" "ECDSA P-256 키 알고리즘" \
  "grep -q 'algorithm: ECDSA' '${CM_DIR}/templates/self-signed-issuer.yaml'"

# --- FR-N62.3: CA ClusterIssuer ---
echo ""
echo "--- FR-N62.3: CA ClusterIssuer ---"

run_test "TC-09" "ca-cluster-issuer.yaml 존재" \
  "[ -f '${CM_DIR}/templates/ca-cluster-issuer.yaml' ]"

run_test "TC-10" "CA ClusterIssuer Root CA 참조" \
  "grep -q 'saas-root-ca-secret' '${CM_DIR}/templates/ca-cluster-issuer.yaml'"

# --- FR-N62.4: 서비스별 Certificate ---
echo ""
echo "--- FR-N62.4: 서비스별 Certificate ---"

SERVICES=("auth-service" "api-gateway" "tenant-service" "audit-service" "ai-gateway" "catalog-service")
for svc in "${SERVICES[@]}"; do
  run_test "TC-${TOTAL}" "${svc}-tls Certificate 존재" \
    "[ -f '${CM_DIR}/certificates/${svc}-tls.yaml' ]"
done

run_test "TC-${TOTAL}" "Certificate 6종 전체 확인" \
  "python3 -c \"
import glob
count = len(glob.glob('${CM_DIR}/certificates/*-tls.yaml'))
assert count >= 6, f'count={count}'
\""

# --- FR-N62.5: Prometheus 알림 ---
echo ""
echo "--- FR-N62.5: Prometheus 알림 ---"

run_test "TC-${TOTAL}" "alerting-rules.yaml 존재" \
  "[ -f '${CM_DIR}/alerting-rules.yaml' ]"

run_test "TC-${TOTAL}" "CertManagerCertExpiringSoon 알림" \
  "grep -q 'CertManagerCertExpiringSoon' '${CM_DIR}/alerting-rules.yaml'"

run_test "TC-${TOTAL}" "CertManagerCertNotReady 알림" \
  "grep -q 'CertManagerCertNotReady' '${CM_DIR}/alerting-rules.yaml'"

# --- 결과 ---
echo ""
echo "============================================================"
echo " 결과: PASS: ${PASS} / FAIL: ${FAIL} / 총: ${TOTAL}"
if [ "${TOTAL}" -gt 0 ]; then
  RATE=$(awk "BEGIN {printf \"%.1f\", (${PASS}/${TOTAL})*100}")
  echo " 통과율: ${RATE}%"
fi
echo "============================================================"

if [ "${FAIL}" -eq 0 ]; then
  echo -e "\n${GREEN}[ALL PASS] MTU-N62 cert-manager 검증 완료${NC}"
  exit 0
else
  echo -e "\n${RED}[PARTIAL] ${FAIL}건 실패${NC}"
  exit 1
fi
