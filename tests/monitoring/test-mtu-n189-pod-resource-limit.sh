#!/bin/bash
# =============================================================================
# MTU-N189: Pod 리소스 제한 위반 모니터링 E2E 테스트
# Design Ref: MTU-N189 Design §DS-N189.7
# Plan SC: FR-N189.8
# CSAP: D-12-05
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RULES_FILE="$PROJECT_ROOT/infra/monitoring/pod-resource-limit-rules.yaml"
DASHBOARD_FILE="$PROJECT_ROOT/infra/monitoring/dashboards/pod-resource-limit.json"

PASS=0
FAIL=0
TOTAL=0

pass() { ((PASS++)); ((TOTAL++)); echo "  [PASS] $1"; }
fail() { ((FAIL++)); ((TOTAL++)); echo "  [FAIL] $1"; }

echo "=============================================="
echo "MTU-N189 Pod 리소스 제한 위반 모니터링 테스트"
echo "=============================================="

echo ""
echo "[TC-N189.1] YAML 문법 유효성 검사"
if python3 -c "import yaml; yaml.safe_load(open('$RULES_FILE'))" 2>/dev/null; then
  pass "PrometheusRule YAML 파싱 성공"
else
  fail "PrometheusRule YAML 파싱 실패"
fi

echo ""
echo "[TC-N189.2] Recording Rule 수 검증"
RECORDING_RULES=$(grep -c "record:" "$RULES_FILE" 2>/dev/null || echo 0)
if [ "$RECORDING_RULES" -ge 8 ]; then
  pass "Recording rule $RECORDING_RULES개 확인 (최소 8개 요구)"
else
  fail "Recording rule 수 부족: $RECORDING_RULES개"
fi

echo ""
echo "[TC-N189.3] Alert Rule 수 검증"
ALERT_RULES=$(grep -c "alert:" "$RULES_FILE" 2>/dev/null || echo 0)
if [ "$ALERT_RULES" -ge 6 ]; then
  pass "Alert rule $ALERT_RULES개 확인 (최소 6개 요구)"
else
  fail "Alert rule 수 부족: $ALERT_RULES개"
fi

echo ""
echo "[TC-N189.4] Dashboard JSON 유효성 검사"
if jq empty "$DASHBOARD_FILE" 2>/dev/null; then
  pass "Dashboard JSON 파싱 성공"
else
  fail "Dashboard JSON 파싱 실패"
fi

PANEL_COUNT=$(jq '.panels | length' "$DASHBOARD_FILE" 2>/dev/null || echo 0)
if [ "$PANEL_COUNT" -ge 7 ]; then
  pass "Dashboard 패널 $PANEL_COUNT개 확인 (최소 7개 요구)"
else
  fail "Dashboard 패널 수 부족: $PANEL_COUNT개"
fi

DASHBOARD_UID=$(jq -r '.uid' "$DASHBOARD_FILE" 2>/dev/null)
if [ "$DASHBOARD_UID" = "pod-resource-limit-n189" ]; then
  pass "Dashboard UID 정상: $DASHBOARD_UID"
else
  fail "Dashboard UID 비정상: $DASHBOARD_UID"
fi

TEMPLATE_COUNT=$(jq '.templating.list | length' "$DASHBOARD_FILE" 2>/dev/null || echo 0)
if [ "$TEMPLATE_COUNT" -ge 2 ]; then
  pass "템플릿 변수 $TEMPLATE_COUNT개 확인"
else
  fail "템플릿 변수 부족: $TEMPLATE_COUNT개"
fi

echo ""
echo "[TC-N189.5] CSAP 라벨 매핑 확인"
for csap in "D-10-03" "D-06-02" "D-12-07"; do
  if grep -q "$csap" "$RULES_FILE"; then
    pass "CSAP 통제항목 '$csap' 매핑 존재"
  else
    fail "CSAP 통제항목 '$csap' 매핑 누락"
  fi
done

echo ""
echo "[TC-N189.6] Design Ref 주석 존재 확인"
if grep -q "Design Ref:" "$RULES_FILE"; then pass "Design Ref 주석 존재"; else fail "Design Ref 누락"; fi
if grep -q "Plan SC:" "$RULES_FILE"; then pass "Plan SC 주석 존재"; else fail "Plan SC 누락"; fi

echo ""
echo "[추가] Recording Rule 이름 검증"
for rule_name in "pod:cpu_throttling:ratio" "pod:memory_usage_vs_limit:ratio" "pod:oomkilled:detected" "pod:oomkilled_restarts:total" "pod:resource_efficiency:score" "pod:cpu_usage_vs_request:ratio"; do
  if grep -q "$rule_name" "$RULES_FILE"; then
    pass "Recording rule '$rule_name' 존재"
  else
    fail "Recording rule '$rule_name' 누락"
  fi
done

echo ""
echo "[추가] Alert 이름 검증"
for alert_name in "CPUThrottlingHigh" "CPUThrottlingSevere" "MemoryLimitApproaching" "MemoryLimitCritical" "OOMKilledDetected" "OOMKilledRepeated" "CPURequestOverrun"; do
  if grep -q "$alert_name" "$RULES_FILE"; then
    pass "Alert '$alert_name' 존재"
  else
    fail "Alert '$alert_name' 누락"
  fi
done

echo ""
echo "[추가] Runbook URL 존재 확인"
RUNBOOK_COUNT=$(grep -c "runbook_url:" "$RULES_FILE" 2>/dev/null || echo 0)
if [ "$RUNBOOK_COUNT" -ge 5 ]; then
  pass "Runbook URL $RUNBOOK_COUNT개 확인"
else
  fail "Runbook URL 부족: $RUNBOOK_COUNT개"
fi

echo ""
echo "=============================================="
echo "테스트 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "=============================================="
if [ "$FAIL" -gt 0 ]; then echo "상태: FAIL"; exit 1; else echo "상태: PASS"; exit 0; fi
