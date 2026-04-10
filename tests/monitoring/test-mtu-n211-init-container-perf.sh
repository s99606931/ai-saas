#!/bin/bash
set -euo pipefail
INFRA="/data/ai-saas/infra/monitoring"
PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "[FAIL] $1"; }
echo "=== MTU-N211: Init 컨테이너 성능 E2E ==="
R="${INFRA}/init-container/init-container-perf-rules.yaml"
A="${INFRA}/init-container/init-container-perf-alerts.yaml"
D="${INFRA}/dashboards/init-container-perf-dashboard.json"
for m in "init_ctr:waiting_count" "init_ctr:restart_rate" "init_ctr:not_ready_count"; do grep -q "$m" "$R" && pass "$m" || fail "$m"; done
for a in "InitContainerFailing" "InitContainerStuck"; do grep -q "$a" "$A" && pass "$a" || fail "$a"; done
[ -f "$D" ] && pass "대시보드" || fail "대시보드"
grep -q "init_ctr:" "$D" && pass "대시보드 쿼리" || fail "대시보드 쿼리"
python3 -c "import yaml;yaml.safe_load(open('$R'))" && pass "Rules YAML" || fail "Rules YAML"
python3 -c "import yaml;yaml.safe_load(open('$A'))" && pass "Alerts YAML" || fail "Alerts YAML"
python3 -c "import json;json.load(open('$D'))" && pass "Dashboard JSON" || fail "Dashboard JSON"
grep -q "csap.*D-10" "$A" && pass "CSAP" || fail "CSAP"
echo "=== MTU-N211: ${PASS}/${TOTAL} 통과 ==="
[ "$FAIL" -eq 0 ]
