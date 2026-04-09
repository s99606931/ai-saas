#!/bin/bash
# =============================================================================
# FinOps 비용 최적화 통합 테스트
# Design Ref: MTU-N59
# Plan SC: FR-N59.8
# =============================================================================

set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'

log_test() {
  local tc_id="$1"; local desc="$2"; local result="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$result" = "PASS" ]; then
    PASS=$((PASS + 1)); echo -e "  ${GREEN}[PASS]${NC} $tc_id: $desc"
  else
    FAIL=$((FAIL + 1)); echo -e "  ${RED}[FAIL]${NC} $tc_id: $desc"
  fi
}

echo "=============================================="
echo " FinOps 비용 최적화 통합 테스트"
echo " MTU-N59"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="
echo ""

FINOPS_DIR="/data/ai-saas/scripts/finops"
MON_DIR="/data/ai-saas/infra/monitoring"

# --- Phase 1: 스크립트 검증 ---
echo "[Phase 1] FinOps 스크립트 검증"
SCRIPTS=(
  "resource-analysis.sh|TC-01|리소스 사용량 분석 스크립트"
  "overprovisioning-check.sh|TC-02|오버프로비저닝 탐지 스크립트"
  "idle-resource-detect.sh|TC-03|유휴 리소스 탐지 스크립트"
  "weekly-cost-report.sh|TC-04|주간 비용 리포트 스크립트"
)

for entry in "${SCRIPTS[@]}"; do
  IFS='|' read -r filename tc_id desc <<< "$entry"
  if [ -f "${FINOPS_DIR}/${filename}" ]; then
    HAS_SHEBANG=$(head -1 "${FINOPS_DIR}/${filename}" | grep -c "bash" || true)
    LINE_COUNT=$(wc -l < "${FINOPS_DIR}/${filename}")
    if [ "$HAS_SHEBANG" -ge 1 ] && [ "$LINE_COUNT" -ge 10 ]; then
      log_test "$tc_id" "$desc (${LINE_COUNT}줄)" "PASS"
    else
      log_test "$tc_id" "$desc (불완전)" "FAIL"
    fi
  else
    log_test "$tc_id" "$desc (미존재)" "FAIL"
  fi
done

# --- TC-05: 최적화 Runbook ---
echo ""
echo "[Phase 2] Runbook 및 문서 검증"
if [ -f "${FINOPS_DIR}/optimization-runbook.md" ]; then
  HAS_VPA=$(grep -c "VPA\|vpa" "${FINOPS_DIR}/optimization-runbook.md" || true)
  HAS_KEDA=$(grep -c "KEDA\|scale-to-zero" "${FINOPS_DIR}/optimization-runbook.md" || true)
  HAS_CHECKLIST=$(grep -c "\- \[" "${FINOPS_DIR}/optimization-runbook.md" || true)
  if [ "$HAS_VPA" -ge 2 ] && [ "$HAS_KEDA" -ge 1 ] && [ "$HAS_CHECKLIST" -ge 3 ]; then
    log_test "TC-05" "최적화 Runbook (VPA, KEDA, 체크리스트)" "PASS"
  else
    log_test "TC-05" "Runbook 내용 불충분" "FAIL"
  fi
else
  log_test "TC-05" "optimization-runbook.md 미존재" "FAIL"
fi

# --- TC-06: 알림 규칙 ---
echo ""
echo "[Phase 3] 알림 규칙 검증"
ALERT_FILE="${MON_DIR}/finops-alerting-rules.yaml"
if [ -f "$ALERT_FILE" ]; then
  HAS_CRD=$(grep -c "kind: PrometheusRule" "$ALERT_FILE" || true)
  ALERT_COUNT=$(grep -c "alert:" "$ALERT_FILE" || true)
  HAS_OVER=$(grep -c "Overprovisioned" "$ALERT_FILE" || true)
  HAS_PVC=$(grep -c "UnusedPVC" "$ALERT_FILE" || true)
  if [ "$HAS_CRD" -ge 1 ] && [ "$ALERT_COUNT" -ge 4 ] && [ "$HAS_OVER" -ge 1 ]; then
    log_test "TC-06" "PrometheusRule 알림 ${ALERT_COUNT}개 (오버프로비저닝 포함)" "PASS"
  else
    log_test "TC-06" "알림 규칙 불완전" "FAIL"
  fi
  [ "$HAS_PVC" -ge 1 ] && log_test "TC-07" "미사용 PVC 알림 규칙" "PASS" || log_test "TC-07" "PVC 알림 누락" "FAIL"
else
  log_test "TC-06" "finops-alerting-rules.yaml 미존재" "FAIL"
  log_test "TC-07" "알림 규칙 검증 불가" "FAIL"
fi

# --- TC-08: Grafana 대시보드 ---
echo ""
echo "[Phase 4] Grafana 대시보드 검증"
DASHBOARD="${MON_DIR}/dashboards/finops-dashboard.json"
if [ -f "$DASHBOARD" ]; then
  PANELS=$(python3 -c "import json; d=json.load(open('$DASHBOARD')); print(len(d.get('panels',[])))" 2>/dev/null || echo "0")
  HAS_FINOPS_TAG=$(grep -c '"finops"' "$DASHBOARD" || true)
  if [ "$PANELS" -ge 4 ] && [ "$HAS_FINOPS_TAG" -ge 1 ]; then
    log_test "TC-08" "Grafana 비용 대시보드 ${PANELS}개 패널" "PASS"
  else
    log_test "TC-08" "대시보드 불충분" "FAIL"
  fi
else
  log_test "TC-08" "finops-dashboard.json 미존재" "FAIL"
fi

# --- TC-09: 오버프로비저닝 탐지 로직 ---
if grep -q "THRESHOLD\|threshold" "${FINOPS_DIR}/overprovisioning-check.sh" && \
   grep -q "prometheus\|PROM" "${FINOPS_DIR}/overprovisioning-check.sh"; then
  log_test "TC-09" "Prometheus 기반 오버프로비저닝 탐지 로직" "PASS"
else
  log_test "TC-09" "탐지 로직 불완전" "FAIL"
fi

# --- TC-10: idle 리소스 탐지 로직 ---
if grep -q "IDLE_THRESHOLD\|idle" "${FINOPS_DIR}/idle-resource-detect.sh" && \
   grep -q "scale-to-zero\|KEDA" "${FINOPS_DIR}/idle-resource-detect.sh"; then
  log_test "TC-10" "유휴 리소스 탐지 + KEDA 권고" "PASS"
else
  log_test "TC-10" "유휴 리소스 탐지 불완전" "FAIL"
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
  echo -e "\n${GREEN}[ALL PASS] FinOps 비용 최적화 통합 테스트 완료${NC}"
  exit 0
else
  echo -e "\n${RED}[PARTIAL] ${FAIL}건 실패${NC}"
  exit 1
fi
