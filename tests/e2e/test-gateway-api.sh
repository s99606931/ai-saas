#!/bin/bash
# =============================================================================
# MTU-N65: Gateway API + Traefik 고도화 검증
# Design Ref: MTU-N65.design.md §1~§3
# Plan SC: FR-N65.1~FR-N65.7
# =============================================================================

set -euo pipefail

PASS=0
FAIL=0
TOTAL=0
GW_DIR="/data/ai-saas/infra/gateway-api"

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
echo " MTU-N65: Gateway API + Traefik 검증"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"

# --- FR-N65.7: Traefik Config ---
echo ""
echo "--- FR-N65.7: Traefik HelmChartConfig ---"

run_test "TC-01" "traefik-config.yaml 존재" \
  "[ -f '${GW_DIR}/traefik-config.yaml' ]"

run_test "TC-02" "Gateway API Provider 활성화" \
  "grep -q 'kubernetesGateway' '${GW_DIR}/traefik-config.yaml'"

run_test "TC-03" "접근 로그 활성화 (CSAP D-06)" \
  "grep -q 'accessLog' '${GW_DIR}/traefik-config.yaml'"

# --- FR-N65.1~2: GatewayClass + Gateway ---
echo ""
echo "--- FR-N65.1~2: GatewayClass + Gateway ---"

run_test "TC-04" "gateway.yaml 존재" \
  "[ -f '${GW_DIR}/gateway.yaml' ]"

run_test "TC-05" "GatewayClass 정의" \
  "grep -q 'kind: GatewayClass' '${GW_DIR}/gateway.yaml'"

run_test "TC-06" "Gateway 정의" \
  "grep -q 'kind: Gateway' '${GW_DIR}/gateway.yaml'"

run_test "TC-07" "HTTPS Listener TLS 설정" \
  "grep -q 'tls:' '${GW_DIR}/gateway.yaml'"

# --- FR-N65.3: HTTPRoute 6종 ---
echo ""
echo "--- FR-N65.3: HTTPRoute ---"

ROUTES=("auth-service-route" "api-gateway-route" "tenant-route" "audit-route" "ai-gateway-route" "catalog-route")
for route in "${ROUTES[@]}"; do
  run_test "TC-${TOTAL}" "${route}.yaml 존재" \
    "[ -f '${GW_DIR}/routes/${route}.yaml' ]"
done

run_test "TC-${TOTAL}" "모든 HTTPRoute kind 확인" \
  "python3 -c \"
import glob
count = 0
for f in glob.glob('${GW_DIR}/routes/*.yaml'):
    with open(f) as fh:
        if 'kind: HTTPRoute' in fh.read():
            count += 1
assert count >= 6, f'HTTPRoute count={count}'
\""

# --- FR-N65.4: Rate Limiting ---
echo ""
echo "--- FR-N65.4: Rate Limiting ---"

run_test "TC-${TOTAL}" "rate-limit.yaml 존재" \
  "[ -f '${GW_DIR}/middlewares/rate-limit.yaml' ]"

run_test "TC-${TOTAL}" "Middleware rateLimit 정의" \
  "grep -q 'rateLimit:' '${GW_DIR}/middlewares/rate-limit.yaml'"

# --- FR-N65.5: 보안 헤더 ---
echo ""
echo "--- FR-N65.5: 보안 헤더 ---"

run_test "TC-${TOTAL}" "security-headers.yaml 존재" \
  "[ -f '${GW_DIR}/middlewares/security-headers.yaml' ]"

run_test "TC-${TOTAL}" "HSTS 헤더 설정" \
  "grep -q 'stsSeconds' '${GW_DIR}/middlewares/security-headers.yaml'"

run_test "TC-${TOTAL}" "CSP 헤더 설정" \
  "grep -q 'contentSecurityPolicy' '${GW_DIR}/middlewares/security-headers.yaml'"

run_test "TC-${TOTAL}" "X-Frame-Options 설정" \
  "grep -q 'frameDeny\|SAMEORIGIN' '${GW_DIR}/middlewares/security-headers.yaml'"

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
  echo -e "\n${GREEN}[ALL PASS] MTU-N65 Gateway API 검증 완료${NC}"
  exit 0
else
  echo -e "\n${RED}[PARTIAL] ${FAIL}건 실패${NC}"
  exit 1
fi
