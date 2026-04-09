#!/bin/bash
# =============================================================================
# MTU-N67: Flux Drift Detection + ConfigMap/Secret 감사 검증
# Design Ref: MTU-N67.design.md §1~§3
# Plan SC: FR-N67.1~FR-N67.6
# =============================================================================

set -euo pipefail

PASS=0
FAIL=0
TOTAL=0
FLUX_DIR="/data/ai-saas/infra/flux/drift-detection"
SCRIPT_DIR="/data/ai-saas/scripts/drift-audit"

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
echo " MTU-N67: Flux Drift Detection + 감사 검증"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"

# --- FR-N67.1~2: Flux Drift Detection ---
echo ""
echo "--- FR-N67.1~2: Flux Drift Detection 설정 ---"

run_test "TC-01" "drift-config.yaml 존재" \
  "[ -f '${FLUX_DIR}/drift-config.yaml' ]"

run_test "TC-02" "Kustomization interval 5분" \
  "grep -q 'interval: 5m' '${FLUX_DIR}/drift-config.yaml'"

run_test "TC-03" "prune: true (Git 우선)" \
  "grep -q 'prune: true' '${FLUX_DIR}/drift-config.yaml'"

run_test "TC-04" "driftDetection mode: enabled" \
  "grep -q 'mode: enabled' '${FLUX_DIR}/drift-config.yaml'"

run_test "TC-05" "HPA replicas 무시 규칙" \
  "grep -q '/spec/replicas' '${FLUX_DIR}/drift-config.yaml'"

# --- FR-N67.3: ConfigMap 감사 스크립트 ---
echo ""
echo "--- FR-N67.3: ConfigMap 감사 ---"

run_test "TC-06" "configmap-audit.sh 존재" \
  "[ -f '${SCRIPT_DIR}/configmap-audit.sh' ]"

run_test "TC-07" "configmap-audit.sh 실행 가능" \
  "bash -n '${SCRIPT_DIR}/configmap-audit.sh'"

# --- FR-N67.4: Secret 감사 스크립트 ---
echo ""
echo "--- FR-N67.4: Secret 감사 ---"

run_test "TC-08" "secret-audit.sh 존재" \
  "[ -f '${SCRIPT_DIR}/secret-audit.sh' ]"

run_test "TC-09" "secret-audit.sh 실행 가능" \
  "bash -n '${SCRIPT_DIR}/secret-audit.sh'"

# --- FR-N67.5: 기존 Prometheus 알림 확인 ---
echo ""
echo "--- FR-N67.5: Prometheus 알림 ---"

run_test "TC-10" "기존 drift 알림 규칙 존재" \
  "[ -f '${FLUX_DIR}/alerting-rules.yaml' ]"

run_test "TC-11" "FluxDriftDetected 알림 정의" \
  "grep -q 'FluxDriftDetected' '${FLUX_DIR}/alerting-rules.yaml'"

# --- FR-N67.6: 감사 로그 연동 ---
echo ""
echo "--- FR-N67.6: 감사 로그 ---"

run_test "TC-12" "secret-audit에 CSAP D-09 참조" \
  "grep -q 'D-09\|CSAP' '${SCRIPT_DIR}/secret-audit.sh'"

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
  echo -e "\n${GREEN}[ALL PASS] MTU-N67 Drift Detection 검증 완료${NC}"
  exit 0
else
  echo -e "\n${RED}[PARTIAL] ${FAIL}건 실패${NC}"
  exit 1
fi
