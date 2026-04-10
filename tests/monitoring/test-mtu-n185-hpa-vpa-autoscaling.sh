#!/bin/bash
# =============================================================================
# MTU-N185: HPA/VPA 오토스케일링 모니터링 E2E 테스트
# Design Ref: MTU-N185 Design §DS-N185.7
# Plan SC: FR-N185.7
# CSAP: D-12-05 (테스트 검증)
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RULES_FILE="$PROJECT_ROOT/infra/monitoring/hpa-vpa-autoscaling-rules.yaml"
DASHBOARD_FILE="$PROJECT_ROOT/infra/monitoring/dashboards/hpa-vpa-autoscaling.json"

PASS=0
FAIL=0
TOTAL=0

pass() { ((PASS++)); ((TOTAL++)); echo "  [PASS] $1"; }
fail() { ((FAIL++)); ((TOTAL++)); echo "  [FAIL] $1"; }

echo "=============================================="
echo "MTU-N185 HPA/VPA 오토스케일링 모니터링 테스트"
echo "=============================================="

# --- TC-N185.1: YAML 문법 유효성 ---
echo ""
echo "[TC-N185.1] YAML 문법 유효성 검사"
if python3 -c "import yaml; yaml.safe_load(open('$RULES_FILE'))" 2>/dev/null; then
  pass "PrometheusRule YAML 파싱 성공"
else
  fail "PrometheusRule YAML 파싱 실패"
fi

# --- TC-N185.2: PromQL 문법 유효성 ---
echo ""
echo "[TC-N185.2] PromQL 문법 유효성 검사"
if command -v promtool &>/dev/null; then
  if promtool check rules "$RULES_FILE" 2>/dev/null; then
    pass "promtool check rules 통과"
  else
    fail "promtool check rules 실패"
  fi
else
  echo "  [SKIP] promtool 미설치 — 대체 검증 수행"
  # 대체: recording rule 이름 형식 검증
  RECORDING_RULES=$(grep -c "record:" "$RULES_FILE" 2>/dev/null || echo 0)
  if [ "$RECORDING_RULES" -ge 8 ]; then
    pass "Recording rule $RECORDING_RULES개 확인 (최소 8개 요구)"
  else
    fail "Recording rule 수 부족: $RECORDING_RULES개 (최소 8개 요구)"
  fi

  ALERT_RULES=$(grep -c "alert:" "$RULES_FILE" 2>/dev/null || echo 0)
  if [ "$ALERT_RULES" -ge 5 ]; then
    pass "Alert rule $ALERT_RULES개 확인 (최소 5개 요구)"
  else
    fail "Alert rule 수 부족: $ALERT_RULES개 (최소 5개 요구)"
  fi
fi

# --- TC-N185.3: 필수 라벨 존재 확인 ---
echo ""
echo "[TC-N185.3] 필수 라벨 존재 확인"
for label in "mtu: N185" "csap_control:" "severity:"; do
  if grep -q "$label" "$RULES_FILE"; then
    pass "라벨 '$label' 존재"
  else
    fail "라벨 '$label' 누락"
  fi
done

# team 라벨 (알림에만)
if grep -q "team: sre" "$RULES_FILE"; then
  pass "알림 team 라벨 존재"
else
  fail "알림 team 라벨 누락"
fi

# --- TC-N185.4: Dashboard JSON 유효성 ---
echo ""
echo "[TC-N185.4] Dashboard JSON 유효성 검사"
if command -v jq &>/dev/null; then
  if jq empty "$DASHBOARD_FILE" 2>/dev/null; then
    pass "Dashboard JSON 파싱 성공"
  else
    fail "Dashboard JSON 파싱 실패"
  fi

  PANEL_COUNT=$(jq '.panels | length' "$DASHBOARD_FILE" 2>/dev/null || echo 0)
  if [ "$PANEL_COUNT" -ge 8 ]; then
    pass "Dashboard 패널 $PANEL_COUNT개 확인 (최소 8개 요구)"
  else
    fail "Dashboard 패널 수 부족: $PANEL_COUNT개 (최소 8개 요구)"
  fi

  # 대시보드 UID 확인
  DASHBOARD_UID=$(jq -r '.uid' "$DASHBOARD_FILE" 2>/dev/null)
  if [ "$DASHBOARD_UID" = "hpa-vpa-autoscaling-n185" ]; then
    pass "Dashboard UID 정상: $DASHBOARD_UID"
  else
    fail "Dashboard UID 비정상: $DASHBOARD_UID"
  fi

  # 템플릿 변수 확인
  TEMPLATE_COUNT=$(jq '.templating.list | length' "$DASHBOARD_FILE" 2>/dev/null || echo 0)
  if [ "$TEMPLATE_COUNT" -ge 2 ]; then
    pass "템플릿 변수 $TEMPLATE_COUNT개 확인 (최소 2개 요구)"
  else
    fail "템플릿 변수 부족: $TEMPLATE_COUNT개"
  fi
else
  echo "  [SKIP] jq 미설치"
fi

# --- TC-N185.5: CSAP 라벨 매핑 확인 ---
echo ""
echo "[TC-N185.5] CSAP 라벨 매핑 확인"
for csap in "D-10-03" "D-06-02" "D-12-07"; do
  if grep -q "$csap" "$RULES_FILE"; then
    pass "CSAP 통제항목 '$csap' 매핑 존재"
  else
    fail "CSAP 통제항목 '$csap' 매핑 누락"
  fi
done

# --- TC-N185.6: Design Ref 주석 존재 ---
echo ""
echo "[TC-N185.6] Design Ref 주석 존재 확인"
if grep -q "Design Ref:" "$RULES_FILE"; then
  pass "PrometheusRule Design Ref 주석 존재"
else
  fail "PrometheusRule Design Ref 주석 누락"
fi

if grep -q "Plan SC:" "$RULES_FILE"; then
  pass "PrometheusRule Plan SC 주석 존재"
else
  fail "PrometheusRule Plan SC 주석 누락"
fi

if grep -q "Design Ref:" "$DASHBOARD_FILE" || grep -q "DS-N185" "$DASHBOARD_FILE"; then
  pass "Dashboard Design Ref 주석 존재"
else
  fail "Dashboard Design Ref 주석 누락"
fi

# --- 추가 검증: Recording Rule 이름 패턴 ---
echo ""
echo "[추가] Recording Rule 이름 패턴 검증"
for rule_name in "hpa:scaling_events:rate5m" "hpa:current_vs_max:ratio" "hpa:flapping:score" "vpa:cpu_recommendation_applied:ratio" "autoscaling:efficiency:score"; do
  if grep -q "$rule_name" "$RULES_FILE"; then
    pass "Recording rule '$rule_name' 존재"
  else
    fail "Recording rule '$rule_name' 누락"
  fi
done

# --- 추가 검증: Alert 이름 패턴 ---
echo ""
echo "[추가] Alert 이름 패턴 검증"
for alert_name in "HPAScalingStuck" "HPAMaxReplicasReached" "HPAMetricsUnavailable" "HPAScalingFlapping" "HPABelowMinReplicas" "AutoscalingEfficiencyLow"; do
  if grep -q "$alert_name" "$RULES_FILE"; then
    pass "Alert '$alert_name' 존재"
  else
    fail "Alert '$alert_name' 누락"
  fi
done

# --- 추가 검증: runbook_url 존재 ---
echo ""
echo "[추가] Runbook URL 존재 확인"
RUNBOOK_COUNT=$(grep -c "runbook_url:" "$RULES_FILE" 2>/dev/null || echo 0)
if [ "$RUNBOOK_COUNT" -ge 3 ]; then
  pass "Runbook URL $RUNBOOK_COUNT개 확인"
else
  fail "Runbook URL 부족: $RUNBOOK_COUNT개"
fi

# --- 결과 요약 ---
echo ""
echo "=============================================="
echo "테스트 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "=============================================="

if [ "$FAIL" -gt 0 ]; then
  echo "상태: FAIL"
  exit 1
else
  echo "상태: PASS"
  exit 0
fi
