#!/bin/bash
set -euo pipefail
INFRA="/data/ai-saas/infra/monitoring"
PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "[FAIL] $1"; }
echo "=== MTU-N212: 이미지 풀 레이턴시 E2E ==="
R="${INFRA}/image-pull/image-pull-latency-rules.yaml"
A="${INFRA}/image-pull/image-pull-latency-alerts.yaml"
D="${INFRA}/dashboards/image-pull-latency-dashboard.json"
for m in "img_pull:duration_p50" "img_pull:duration_p90" "img_pull:duration_p99" "img_pull:failure_rate" "img_pull:pull_rate"; do grep -q "$m" "$R" && pass "$m" || fail "$m"; done
for a in "ImagePullSlow" "ImagePullFailing"; do grep -q "$a" "$A" && pass "$a" || fail "$a"; done
[ -f "$D" ] && pass "대시보드" || fail "대시보드"
grep -q "img_pull:" "$D" && pass "대시보드 쿼리" || fail "대시보드 쿼리"
python3 -c "import yaml;yaml.safe_load(open('$R'))" && pass "Rules YAML" || fail "Rules YAML"
python3 -c "import yaml;yaml.safe_load(open('$A'))" && pass "Alerts YAML" || fail "Alerts YAML"
python3 -c "import json;json.load(open('$D'))" && pass "JSON" || fail "JSON"
grep -q "csap.*D-10" "$A" && pass "CSAP" || fail "CSAP"
echo "=== MTU-N212: ${PASS}/${TOTAL} 통과 ==="
[ "$FAIL" -eq 0 ]
