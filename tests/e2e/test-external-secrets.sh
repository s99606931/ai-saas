#!/bin/bash
# =============================================================================
# MTU-N66: External Secrets Operator 검증
# Design Ref: MTU-N66.design.md §1~§4
# Plan SC: FR-N66.1~FR-N66.7
# =============================================================================

set -euo pipefail

PASS=0
FAIL=0
TOTAL=0
ESO_DIR="/data/ai-saas/infra/external-secrets"

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
echo " MTU-N66: External Secrets Operator 검증"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"

# --- FR-N66.1: Helm values ---
echo ""
echo "--- FR-N66.1: Helm values ---"

run_test "TC-01" "values.yaml 존재" \
  "[ -f '${ESO_DIR}/values.yaml' ]"

run_test "TC-02" "ServiceMonitor 활성화" \
  "grep -q 'serviceMonitor:' '${ESO_DIR}/values.yaml'"

run_test "TC-03" "보안 컨텍스트 설정" \
  "grep -q 'runAsNonRoot: true' '${ESO_DIR}/values.yaml'"

# --- FR-N66.2: SecretStore ---
echo ""
echo "--- FR-N66.2: SecretStore ---"

run_test "TC-04" "kubernetes-backend.yaml 존재" \
  "[ -f '${ESO_DIR}/stores/kubernetes-backend.yaml' ]"

run_test "TC-05" "SecretStore kind 정의" \
  "grep -q 'kind: SecretStore' '${ESO_DIR}/stores/kubernetes-backend.yaml'"

run_test "TC-06" "RBAC Role 정의 (최소 권한)" \
  "grep -q 'kind: Role' '${ESO_DIR}/stores/kubernetes-backend.yaml'"

run_test "TC-07" "ServiceAccount 정의" \
  "grep -q 'kind: ServiceAccount' '${ESO_DIR}/stores/kubernetes-backend.yaml'"

# --- FR-N66.3: ExternalSecret 6종 ---
echo ""
echo "--- FR-N66.3: ExternalSecret ---"

SERVICES=("auth-service" "api-gateway" "tenant-service" "audit-service" "ai-gateway" "catalog-service")
for svc in "${SERVICES[@]}"; do
  run_test "TC-${TOTAL}" "${svc}-secrets.yaml 존재" \
    "[ -f '${ESO_DIR}/secrets/${svc}-secrets.yaml' ]"
done

run_test "TC-${TOTAL}" "ExternalSecret 6종 전체 확인" \
  "python3 -c \"
import glob
count = 0
for f in glob.glob('${ESO_DIR}/secrets/*-secrets.yaml'):
    with open(f) as fh:
        if 'kind: ExternalSecret' in fh.read():
            count += 1
assert count >= 6, f'ExternalSecret count={count}'
\""

# --- FR-N66.4: 자동 회전 ---
echo ""
echo "--- FR-N66.4: 자동 회전 ---"

run_test "TC-${TOTAL}" "refreshInterval 설정" \
  "grep -rq 'refreshInterval: 1h' '${ESO_DIR}/secrets/'"

# --- FR-N66.5: 역할 분리 문서 ---
echo ""
echo "--- FR-N66.5: 역할 분리 ---"

run_test "TC-${TOTAL}" "ROLE-SEPARATION.md 존재" \
  "[ -f '${ESO_DIR}/ROLE-SEPARATION.md' ]"

run_test "TC-${TOTAL}" "역할 분리 내용 포함" \
  "grep -q 'Sealed Secrets' '${ESO_DIR}/ROLE-SEPARATION.md' && grep -q 'External Secrets' '${ESO_DIR}/ROLE-SEPARATION.md'"

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
  echo -e "\n${GREEN}[ALL PASS] MTU-N66 External Secrets 검증 완료${NC}"
  exit 0
else
  echo -e "\n${RED}[PARTIAL] ${FAIL}건 실패${NC}"
  exit 1
fi
