#!/bin/bash
# =============================================================================
# MTU-N188: ConfigMap/Secret 변경 감지 모니터링 E2E 테스트
# Design Ref: MTU-N188 Design §DS-N188.5
# Plan SC: FR-N188.7
# CSAP: D-12-05
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RULES_FILE="$PROJECT_ROOT/infra/monitoring/configmap-secret-change-rules.yaml"
DASHBOARD_FILE="$PROJECT_ROOT/infra/monitoring/dashboards/configmap-secret-change.json"

PASS=0
FAIL=0
TOTAL=0

pass() { ((PASS++)); ((TOTAL++)); echo "  [PASS] $1"; }
fail() { ((FAIL++)); ((TOTAL++)); echo "  [FAIL] $1"; }

echo "=============================================="
echo "MTU-N188 ConfigMap/Secret 변경 감지 테스트"
echo "=============================================="

# YAML 유효성
echo ""
echo "[TC-N188.1] YAML 문법 유효성 검사"
if python3 -c "import yaml; yaml.safe_load(open('$RULES_FILE'))" 2>/dev/null; then
  pass "PrometheusRule YAML 파싱 성공"
else
  fail "PrometheusRule YAML 파싱 실패"
fi

# Recording Rule 수
echo ""
echo "[TC-N188.2] Recording Rule 수 검증"
RECORDING_RULES=$(grep -c "record:" "$RULES_FILE" 2>/dev/null || echo 0)
if [ "$RECORDING_RULES" -ge 6 ]; then
  pass "Recording rule $RECORDING_RULES개 확인 (최소 6개 요구)"
else
  fail "Recording rule 수 부족: $RECORDING_RULES개"
fi

# Alert Rule 수
echo ""
echo "[TC-N188.3] Alert Rule 수 검증"
ALERT_RULES=$(grep -c "alert:" "$RULES_FILE" 2>/dev/null || echo 0)
if [ "$ALERT_RULES" -ge 4 ]; then
  pass "Alert rule $ALERT_RULES개 확인 (최소 4개 요구)"
else
  fail "Alert rule 수 부족: $ALERT_RULES개"
fi

# Dashboard JSON
echo ""
echo "[TC-N188.4] Dashboard JSON 유효성 검사"
if jq empty "$DASHBOARD_FILE" 2>/dev/null; then
  pass "Dashboard JSON 파싱 성공"
else
  fail "Dashboard JSON 파싱 실패"
fi

PANEL_COUNT=$(jq '.panels | length' "$DASHBOARD_FILE" 2>/dev/null || echo 0)
if [ "$PANEL_COUNT" -ge 7 ]; then
  pass "Dashboard 패널 $PANEL_COUNT개 확인 (최소 7개 요구)"
else
  fail "Dashboard 패널 수 부족: $PANEL_COUNT개"
fi

DASHBOARD_UID=$(jq -r '.uid' "$DASHBOARD_FILE" 2>/dev/null)
if [ "$DASHBOARD_UID" = "configmap-secret-change-n188" ]; then
  pass "Dashboard UID 정상: $DASHBOARD_UID"
else
  fail "Dashboard UID 비정상: $DASHBOARD_UID"
fi

# CSAP 라벨
echo ""
echo "[TC-N188.5] CSAP 라벨 매핑 확인"
for csap in "D-06-02" "D-09-01" "D-10-03"; do
  if grep -q "$csap" "$RULES_FILE"; then
    pass "CSAP 통제항목 '$csap' 매핑 존재"
  else
    fail "CSAP 통제항목 '$csap' 매핑 누락"
  fi
done

# Design Ref
echo ""
echo "[TC-N188.6] Design Ref 주석 존재 확인"
if grep -q "Design Ref:" "$RULES_FILE"; then
  pass "PrometheusRule Design Ref 주석 존재"
else
  fail "PrometheusRule Design Ref 주석 누락"
fi
if grep -q "Plan SC:" "$RULES_FILE"; then
  pass "Plan SC 주석 존재"
else
  fail "Plan SC 주석 누락"
fi

# Recording Rule 이름
echo ""
echo "[추가] Recording Rule 이름 검증"
for rule_name in "configmap:changes:rate5m" "secret:changes:rate5m" "configmap:total:count" "secret:total:count" "config:all_changes:rate5m"; do
  if grep -q "$rule_name" "$RULES_FILE"; then
    pass "Recording rule '$rule_name' 존재"
  else
    fail "Recording rule '$rule_name' 누락"
  fi
done

# Alert 이름
echo ""
echo "[추가] Alert 이름 검증"
for alert_name in "SecretChanged" "ConfigMapChangeFlood" "SecretChangeFlood" "SecretChangedOffHours" "SensitiveNamespaceConfigChange"; do
  if grep -q "$alert_name" "$RULES_FILE"; then
    pass "Alert '$alert_name' 존재"
  else
    fail "Alert '$alert_name' 누락"
  fi
done

# Runbook URL
echo ""
echo "[추가] Runbook URL 존재 확인"
RUNBOOK_COUNT=$(grep -c "runbook_url:" "$RULES_FILE" 2>/dev/null || echo 0)
if [ "$RUNBOOK_COUNT" -ge 3 ]; then
  pass "Runbook URL $RUNBOOK_COUNT개 확인"
else
  fail "Runbook URL 부족: $RUNBOOK_COUNT개"
fi

echo ""
echo "=============================================="
echo "테스트 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "=============================================="
if [ "$FAIL" -gt 0 ]; then echo "상태: FAIL"; exit 1; else echo "상태: PASS"; exit 0; fi
