#!/bin/bash
set -euo pipefail
INFRA="/data/ai-saas/infra/monitoring"
PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "[FAIL] $1"; }
echo "=== MTU-N215: CRD 컨트롤러 E2E ==="
R="${INFRA}/crd-controller/crd-controller-status-rules.yaml"; A="${INFRA}/crd-controller/crd-controller-status-alerts.yaml"; D="${INFRA}/dashboards/crd-controller-status-dashboard.json"
for m in "crd_ctrl:crd_total" "crd_ctrl:reconcile_duration_p99" "crd_ctrl:reconcile_errors_rate"; do grep -q "$m" "$R" && pass "$m" || fail "$m"; done
for a in "CRDControllerReconcileErrors" "CRDControllerReconcileSlow"; do grep -q "$a" "$A" && pass "$a" || fail "$a"; done
[ -f "$D" ] && pass "대시보드" || fail "대시보드"
grep -q "crd_ctrl:" "$D" && pass "쿼리" || fail "쿼리"
python3 -c "import yaml;yaml.safe_load(open('$R'))" && pass "YAML" || fail "YAML"
python3 -c "import yaml;yaml.safe_load(open('$A'))" && pass "YAML2" || fail "YAML2"
python3 -c "import json;json.load(open('$D'))" && pass "JSON" || fail "JSON"
grep -q "csap.*D-10" "$A" && pass "CSAP" || fail "CSAP"
echo "=== MTU-N215: ${PASS}/${TOTAL} ==="
[ "$FAIL" -eq 0 ]
