#!/bin/bash
set -euo pipefail
INFRA="/data/ai-saas/infra/monitoring"
PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "[FAIL] $1"; }
echo "=== MTU-N217: 네임스페이스 트렌드 E2E ==="
R="${INFRA}/namespace-trend/namespace-resource-trend-rules.yaml"; A="${INFRA}/namespace-trend/namespace-resource-trend-alerts.yaml"; D="${INFRA}/dashboards/namespace-resource-trend-dashboard.json"
for m in "ns_trend:cpu_usage" "ns_trend:memory_usage" "ns_trend:cpu_growth_rate" "ns_trend:memory_growth_rate" "ns_trend:pod_count"; do grep -q "$m" "$R" && pass "$m" || fail "$m"; done
for a in "NamespaceCPUSpike" "NamespaceMemorySpike"; do grep -q "$a" "$A" && pass "$a" || fail "$a"; done
[ -f "$D" ] && pass "대시보드" || fail "대시보드"
grep -q "ns_trend:" "$D" && pass "쿼리" || fail "쿼리"
python3 -c "import yaml;yaml.safe_load(open('$R'))" && pass "YAML" || fail "YAML"
python3 -c "import yaml;yaml.safe_load(open('$A'))" && pass "YAML2" || fail "YAML2"
python3 -c "import json;json.load(open('$D'))" && pass "JSON" || fail "JSON"
grep -q "csap.*D-10" "$A" && pass "CSAP" || fail "CSAP"
echo "=== MTU-N217: ${PASS}/${TOTAL} ==="
[ "$FAIL" -eq 0 ]
