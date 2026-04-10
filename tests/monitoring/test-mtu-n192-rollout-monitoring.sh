#!/bin/bash
# =============================================================================
# MTU-N192: Deployment/StatefulSet 롤아웃 모니터링 E2E 테스트
# Design Ref: MTU-N192 Design §DS-N192.3
# Plan SC: FR-N192.6
# CSAP: D-12-05
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RULES_FILE="$PROJECT_ROOT/infra/monitoring/rollout-monitoring-rules.yaml"
DASHBOARD_FILE="$PROJECT_ROOT/infra/monitoring/dashboards/rollout-monitoring.json"

PASS=0
FAIL=0
TOTAL=0

pass() { ((PASS++)); ((TOTAL++)); echo "  [PASS] $1"; }
fail() { ((FAIL++)); ((TOTAL++)); echo "  [FAIL] $1"; }

echo "=============================================="
echo "MTU-N192 롤아웃 모니터링 테스트"
echo "=============================================="

echo ""
echo "[TC-N192.1] YAML 유효성"
if python3 -c "import yaml; yaml.safe_load(open('$RULES_FILE'))" 2>/dev/null; then pass "YAML 파싱 성공"; else fail "YAML 파싱 실패"; fi

echo ""
echo "[TC-N192.2] Recording Rule 수"
RECORDING_RULES=$(grep -c "record:" "$RULES_FILE" 2>/dev/null || echo 0)
if [ "$RECORDING_RULES" -ge 6 ]; then pass "Recording rule $RECORDING_RULES개"; else fail "부족: $RECORDING_RULES개"; fi

echo ""
echo "[TC-N192.3] Alert Rule 수"
ALERT_RULES=$(grep -c "alert:" "$RULES_FILE" 2>/dev/null || echo 0)
if [ "$ALERT_RULES" -ge 4 ]; then pass "Alert rule $ALERT_RULES개"; else fail "부족: $ALERT_RULES개"; fi

echo ""
echo "[TC-N192.4] Dashboard JSON"
if jq empty "$DASHBOARD_FILE" 2>/dev/null; then pass "JSON 파싱 성공"; else fail "JSON 파싱 실패"; fi
PANEL_COUNT=$(jq '.panels | length' "$DASHBOARD_FILE" 2>/dev/null || echo 0)
if [ "$PANEL_COUNT" -ge 7 ]; then pass "패널 $PANEL_COUNT개"; else fail "패널 부족: $PANEL_COUNT개"; fi
DASHBOARD_UID=$(jq -r '.uid' "$DASHBOARD_FILE" 2>/dev/null)
if [ "$DASHBOARD_UID" = "rollout-monitoring-n192" ]; then pass "UID 정상"; else fail "UID: $DASHBOARD_UID"; fi

echo ""
echo "[TC-N192.5] CSAP 라벨"
for csap in "D-10-03" "D-06-02"; do
  if grep -q "$csap" "$RULES_FILE"; then pass "CSAP '$csap'"; else fail "CSAP '$csap' 누락"; fi
done

echo ""
echo "[TC-N192.6] Design Ref"
if grep -q "Design Ref:" "$RULES_FILE"; then pass "Design Ref"; else fail "Design Ref 누락"; fi
if grep -q "Plan SC:" "$RULES_FILE"; then pass "Plan SC"; else fail "Plan SC 누락"; fi

echo ""
echo "[추가] Recording Rule 이름"
for r in "deployment:rollout_progress:ratio" "deployment:availability:ratio" "deployment:generation_mismatch:bool" "statefulset:rollout_progress:ratio" "statefulset:availability:ratio"; do
  if grep -q "$r" "$RULES_FILE"; then pass "'$r'"; else fail "'$r' 누락"; fi
done

echo ""
echo "[추가] Alert 이름"
for a in "DeploymentRolloutStuck" "DeploymentGenerationMismatch" "DeploymentReplicasMismatch" "StatefulSetRolloutStuck" "DeploymentZeroReplicas"; do
  if grep -q "$a" "$RULES_FILE"; then pass "'$a'"; else fail "'$a' 누락"; fi
done

echo ""
RUNBOOK_COUNT=$(grep -c "runbook_url:" "$RULES_FILE" 2>/dev/null || echo 0)
if [ "$RUNBOOK_COUNT" -ge 3 ]; then pass "Runbook $RUNBOOK_COUNT개"; else fail "Runbook 부족"; fi

echo ""
echo "=============================================="
echo "테스트 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "=============================================="
if [ "$FAIL" -gt 0 ]; then echo "상태: FAIL"; exit 1; else echo "상태: PASS"; exit 0; fi
