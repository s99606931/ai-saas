#!/bin/bash
set -euo pipefail
INFRA="/data/ai-saas/infra/monitoring"
PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "[FAIL] $1"; }
echo "=== MTU-N213: SA 토큰 만료 E2E ==="
R="${INFRA}/sa-token/sa-token-expiry-rules.yaml"; A="${INFRA}/sa-token/sa-token-expiry-alerts.yaml"; D="${INFRA}/dashboards/sa-token-expiry-dashboard.json"
for m in "sa_token:expiry_seconds" "sa_token:near_expiry_count" "sa_token:valid_tokens_total"; do grep -q "$m" "$R" && pass "$m" || fail "$m"; done
for a in "SATokenNearExpiry" "SATokenStaleHigh"; do grep -q "$a" "$A" && pass "$a" || fail "$a"; done
[ -f "$D" ] && pass "대시보드" || fail "대시보드"
grep -q "sa_token:" "$D" && pass "대시보드쿼리" || fail "대시보드쿼리"
python3 -c "import yaml;yaml.safe_load(open('$R'))" && pass "YAML" || fail "YAML"
python3 -c "import yaml;yaml.safe_load(open('$A'))" && pass "YAML2" || fail "YAML2"
python3 -c "import json;json.load(open('$D'))" && pass "JSON" || fail "JSON"
grep -q "csap.*D-08" "$A" && pass "CSAP" || fail "CSAP"
echo "=== MTU-N213: ${PASS}/${TOTAL} ==="
[ "$FAIL" -eq 0 ]
