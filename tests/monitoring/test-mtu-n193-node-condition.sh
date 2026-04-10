#!/bin/bash
# MTU-N193: 노드 상태 상세 모니터링 E2E 테스트
# Design Ref: MTU-N193 | Plan SC: FR-N193.6 | CSAP: D-12-05
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RULES_FILE="$PROJECT_ROOT/infra/monitoring/node-condition-rules.yaml"
DASHBOARD_FILE="$PROJECT_ROOT/infra/monitoring/dashboards/node-condition.json"

PASS=0; FAIL=0; TOTAL=0
pass() { ((PASS++)); ((TOTAL++)); echo "  [PASS] $1"; }
fail() { ((FAIL++)); ((TOTAL++)); echo "  [FAIL] $1"; }

echo "=============================================="
echo "MTU-N193 노드 상태 모니터링 테스트"
echo "=============================================="

echo ""; echo "[TC-1] YAML 유효성"
if python3 -c "import yaml; yaml.safe_load(open('$RULES_FILE'))" 2>/dev/null; then pass "YAML OK"; else fail "YAML"; fi

echo ""; echo "[TC-2] Recording Rules"
R=$(grep -c "record:" "$RULES_FILE" 2>/dev/null || echo 0)
if [ "$R" -ge 7 ]; then pass "Recording $R개"; else fail "Recording $R개"; fi

echo ""; echo "[TC-3] Alert Rules"
A=$(grep -c "alert:" "$RULES_FILE" 2>/dev/null || echo 0)
if [ "$A" -ge 5 ]; then pass "Alert $A개"; else fail "Alert $A개"; fi

echo ""; echo "[TC-4] Dashboard"
if jq empty "$DASHBOARD_FILE" 2>/dev/null; then pass "JSON OK"; else fail "JSON"; fi
P=$(jq '.panels | length' "$DASHBOARD_FILE" 2>/dev/null || echo 0)
if [ "$P" -ge 7 ]; then pass "패널 $P개"; else fail "패널 $P개"; fi
U=$(jq -r '.uid' "$DASHBOARD_FILE" 2>/dev/null)
if [ "$U" = "node-condition-n193" ]; then pass "UID OK"; else fail "UID: $U"; fi

echo ""; echo "[TC-5] CSAP"
for c in "D-10-03" "D-06-02"; do if grep -q "$c" "$RULES_FILE"; then pass "$c"; else fail "$c"; fi; done

echo ""; echo "[TC-6] Design Ref"
if grep -q "Design Ref:" "$RULES_FILE"; then pass "Ref"; else fail "Ref"; fi
if grep -q "Plan SC:" "$RULES_FILE"; then pass "SC"; else fail "SC"; fi

echo ""; echo "[추가] Recording Rule 이름"
for r in "node:ready:count" "node:not_ready:count" "node:memory_pressure:count" "node:disk_pressure:count" "node:unschedulable:count" "node:total:count" "node:availability:ratio"; do
  if grep -q "$r" "$RULES_FILE"; then pass "'$r'"; else fail "'$r'"; fi
done

echo ""; echo "[추가] Alert 이름"
for a in "NodeNotReady" "NodeMemoryPressure" "NodeDiskPressure" "NodePIDPressure" "NodeUnschedulable" "ClusterNodeCountDecreased"; do
  if grep -q "$a" "$RULES_FILE"; then pass "'$a'"; else fail "'$a'"; fi
done

echo ""; RB=$(grep -c "runbook_url:" "$RULES_FILE" 2>/dev/null || echo 0)
if [ "$RB" -ge 4 ]; then pass "Runbook $RB개"; else fail "Runbook $RB개"; fi

echo ""
echo "=============================================="
echo "테스트 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "=============================================="
if [ "$FAIL" -gt 0 ]; then echo "상태: FAIL"; exit 1; else echo "상태: PASS"; exit 0; fi
