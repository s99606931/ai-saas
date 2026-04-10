#!/bin/bash
set -euo pipefail
INFRA="/data/ai-saas/infra/monitoring"
PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "[FAIL] $1"; }
echo "=== MTU-N216: 스케줄링 대기 E2E ==="
R="${INFRA}/scheduling-wait/scheduling-wait-rules.yaml"; A="${INFRA}/scheduling-wait/scheduling-wait-alerts.yaml"; D="${INFRA}/dashboards/scheduling-wait-dashboard.json"
for m in "sched_wait:pending_duration_by_ns" "sched_wait:long_pending_count" "sched_wait:unschedulable_by_reason"; do grep -q "$m" "$R" && pass "$m" || fail "$m"; done
for a in "PodPendingTooLong" "PodUnschedulableMultiple"; do grep -q "$a" "$A" && pass "$a" || fail "$a"; done
[ -f "$D" ] && pass "대시보드" || fail "대시보드"
grep -q "sched_wait:" "$D" && pass "쿼리" || fail "쿼리"
python3 -c "import yaml;yaml.safe_load(open('$R'))" && pass "YAML" || fail "YAML"
python3 -c "import yaml;yaml.safe_load(open('$A'))" && pass "YAML2" || fail "YAML2"
python3 -c "import json;json.load(open('$D'))" && pass "JSON" || fail "JSON"
grep -q "csap.*D-10" "$A" && pass "CSAP" || fail "CSAP"
echo "=== MTU-N216: ${PASS}/${TOTAL} ==="
[ "$FAIL" -eq 0 ]
