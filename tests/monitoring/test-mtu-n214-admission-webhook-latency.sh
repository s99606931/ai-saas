#!/bin/bash
set -euo pipefail
INFRA="/data/ai-saas/infra/monitoring"
PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "[FAIL] $1"; }
echo "=== MTU-N214: Admission Webhook E2E ==="
R="${INFRA}/admission-webhook/admission-webhook-latency-rules.yaml"; A="${INFRA}/admission-webhook/admission-webhook-latency-alerts.yaml"; D="${INFRA}/dashboards/admission-webhook-latency-dashboard.json"
for m in "adm_wh:latency_p50" "adm_wh:latency_p90" "adm_wh:latency_p99" "adm_wh:rejection_rate" "adm_wh:request_rate"; do grep -q "$m" "$R" && pass "$m" || fail "$m"; done
for a in "AdmissionWebhookLatencyHigh" "AdmissionWebhookRejectionHigh"; do grep -q "$a" "$A" && pass "$a" || fail "$a"; done
[ -f "$D" ] && pass "대시보드" || fail "대시보드"
grep -q "adm_wh:" "$D" && pass "쿼리" || fail "쿼리"
python3 -c "import yaml;yaml.safe_load(open('$R'))" && pass "YAML" || fail "YAML"
python3 -c "import yaml;yaml.safe_load(open('$A'))" && pass "YAML2" || fail "YAML2"
python3 -c "import json;json.load(open('$D'))" && pass "JSON" || fail "JSON"
grep -q "csap.*D-10" "$A" && pass "CSAP" || fail "CSAP"
echo "=== MTU-N214: ${PASS}/${TOTAL} ==="
[ "$FAIL" -eq 0 ]
