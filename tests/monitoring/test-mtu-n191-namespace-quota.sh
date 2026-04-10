#!/bin/bash
# =============================================================================
# MTU-N191: Namespace 리소스 쿼터 모니터링 E2E 테스트
# Design Ref: MTU-N191 Design §DS-N191.3
# Plan SC: FR-N191.6
# CSAP: D-12-05
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RULES_FILE="$PROJECT_ROOT/infra/monitoring/namespace-quota-rules.yaml"
DASHBOARD_FILE="$PROJECT_ROOT/infra/monitoring/dashboards/namespace-quota.json"

PASS=0
FAIL=0
TOTAL=0

pass() { ((PASS++)); ((TOTAL++)); echo "  [PASS] $1"; }
fail() { ((FAIL++)); ((TOTAL++)); echo "  [FAIL] $1"; }

echo "=============================================="
echo "MTU-N191 Namespace 리소스 쿼터 모니터링 테스트"
echo "=============================================="

echo ""
echo "[TC-N191.1] YAML 문법 유효성 검사"
if python3 -c "import yaml; yaml.safe_load(open('$RULES_FILE'))" 2>/dev/null; then
  pass "YAML 파싱 성공"
else
  fail "YAML 파싱 실패"
fi

echo ""
echo "[TC-N191.2] Recording Rule 수 검증"
RECORDING_RULES=$(grep -c "record:" "$RULES_FILE" 2>/dev/null || echo 0)
if [ "$RECORDING_RULES" -ge 5 ]; then
  pass "Recording rule $RECORDING_RULES개 확인 (최소 5개)"
else
  fail "Recording rule 수 부족: $RECORDING_RULES개"
fi

echo ""
echo "[TC-N191.3] Alert Rule 수 검증"
ALERT_RULES=$(grep -c "alert:" "$RULES_FILE" 2>/dev/null || echo 0)
if [ "$ALERT_RULES" -ge 4 ]; then
  pass "Alert rule $ALERT_RULES개 확인 (최소 4개)"
else
  fail "Alert rule 수 부족: $ALERT_RULES개"
fi

echo ""
echo "[TC-N191.4] Dashboard JSON 유효성 검사"
if jq empty "$DASHBOARD_FILE" 2>/dev/null; then pass "JSON 파싱 성공"; else fail "JSON 파싱 실패"; fi
PANEL_COUNT=$(jq '.panels | length' "$DASHBOARD_FILE" 2>/dev/null || echo 0)
if [ "$PANEL_COUNT" -ge 7 ]; then pass "패널 $PANEL_COUNT개 확인"; else fail "패널 부족: $PANEL_COUNT개"; fi
DASHBOARD_UID=$(jq -r '.uid' "$DASHBOARD_FILE" 2>/dev/null)
if [ "$DASHBOARD_UID" = "namespace-quota-n191" ]; then pass "UID 정상"; else fail "UID 비정상: $DASHBOARD_UID"; fi

echo ""
echo "[TC-N191.5] CSAP 라벨 매핑 확인"
for csap in "D-10-03" "D-08-01"; do
  if grep -q "$csap" "$RULES_FILE"; then pass "CSAP '$csap' 존재"; else fail "CSAP '$csap' 누락"; fi
done

echo ""
echo "[TC-N191.6] Design Ref 주석 확인"
if grep -q "Design Ref:" "$RULES_FILE"; then pass "Design Ref 존재"; else fail "Design Ref 누락"; fi
if grep -q "Plan SC:" "$RULES_FILE"; then pass "Plan SC 존재"; else fail "Plan SC 누락"; fi

echo ""
echo "[추가] Recording Rule 이름 검증"
for r in "quota:usage:ratio" "quota:cpu_usage:ratio" "quota:memory_usage:ratio" "quota:pods_usage:ratio" "quota:remaining:value"; do
  if grep -q "$r" "$RULES_FILE"; then pass "'$r' 존재"; else fail "'$r' 누락"; fi
done

echo ""
echo "[추가] Alert 이름 검증"
for a in "QuotaUsageHigh" "QuotaUsageCritical" "QuotaExhausted" "PodQuotaNearExhaustion" "NamespaceWithoutQuota"; do
  if grep -q "$a" "$RULES_FILE"; then pass "'$a' 존재"; else fail "'$a' 누락"; fi
done

echo ""
RUNBOOK_COUNT=$(grep -c "runbook_url:" "$RULES_FILE" 2>/dev/null || echo 0)
if [ "$RUNBOOK_COUNT" -ge 4 ]; then pass "Runbook $RUNBOOK_COUNT개"; else fail "Runbook 부족"; fi

echo ""
echo "=============================================="
echo "테스트 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "=============================================="
if [ "$FAIL" -gt 0 ]; then echo "상태: FAIL"; exit 1; else echo "상태: PASS"; exit 0; fi
