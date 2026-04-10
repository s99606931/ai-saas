#!/bin/bash
# FinOps 비용 예측 및 예산 알림 E2E 테스트
# Plan SC: FR-N110.5

set -uo pipefail
PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "[FAIL] $1: $2"; }

echo "============================================"
echo " MTU-N110: FinOps 비용 예측 및 예산 알림 E2E"
echo "============================================"
echo ""

BASE="/data/ai-saas/infra/finops"

echo "--- FR-N110.1: 비용 예측 모델 ---"
F="$BASE/cost-prediction-config.yaml"
[ -f "$F" ] && pass "비용 예측 설정 파일 존재" || fail "파일 누락" "$F"
grep -q "prophet" "$F" && pass "Prophet 예측 모델 설정" || fail "모델 미설정" ""
grep -q "opencost" "$F" && pass "OpenCost 데이터 소스 설정" || fail "데이터 소스 미설정" ""
grep -q "daily_total_cost" "$F" && pass "일일 총비용 쿼리 정의" || fail "비용 쿼리 누락" ""
grep -q "unit_costs" "$F" && pass "비용 단가 정의" || fail "단가 미정의" ""
grep -q "end_of_month" "$F" && pass "월말 예측 시점 정의" || fail "예측 시점 누락" ""

echo ""
echo "--- FR-N110.2: 예산 정책 ---"
F="$BASE/budget-policy.yaml"
[ -f "$F" ] && pass "예산 정책 파일 존재" || fail "파일 누락" "$F"
grep -q "basic" "$F" && pass "Basic 티어 예산 정의" || fail "Basic 미정의" ""
grep -q "standard" "$F" && pass "Standard 티어 예산 정의" || fail "Standard 미정의" ""
grep -q "enterprise" "$F" && pass "Enterprise 티어 예산 정의" || fail "Enterprise 미정의" ""
grep -q "platform_budget" "$F" && pass "플랫폼 전체 예산 정의" || fail "전체 예산 미정의" ""
grep -q "alert_thresholds" "$F" && pass "알림 임계값 정의" || fail "임계값 미정의" ""
grep -q "anomaly_detection" "$F" && pass "비용 이상 탐지 정책" || fail "이상 탐지 미정의" ""
grep -q "daily_spike_threshold" "$F" && pass "일일 급증 감지 임계값" || fail "급증 감지 누락" ""
grep -q "idle_resource_threshold" "$F" && pass "유휴 리소스 감지 임계값" || fail "유휴 감지 누락" ""

echo ""
echo "--- FR-N110.3: AlertManager 규칙 ---"
F="$BASE/budget-alert-rules.yaml"
[ -f "$F" ] && pass "알림 규칙 파일 존재" || fail "파일 누락" "$F"
grep -q "PrometheusRule" "$F" && pass "PrometheusRule 리소스 타입" || fail "타입 오류" ""
grep -q "BudgetUsage50Percent" "$F" && pass "50% 알림 규칙" || fail "50% 규칙 누락" ""
grep -q "BudgetUsage80Percent" "$F" && pass "80% 알림 규칙" || fail "80% 규칙 누락" ""
grep -q "BudgetExceededPrediction" "$F" && pass "100% 초과 예측 규칙" || fail "100% 규칙 누락" ""
grep -q "DailyCostSpike" "$F" && pass "일일 비용 급증 규칙" || fail "급증 규칙 누락" ""
grep -q "IdleResourceDetected" "$F" && pass "유휴 리소스 감지 규칙" || fail "유휴 규칙 누락" ""
grep -q "PlatformBudgetWarning" "$F" && pass "플랫폼 전체 예산 규칙" || fail "전체 규칙 누락" ""
grep -q "runbook_url" "$F" && pass "런북 URL 포함" || fail "런북 미포함" ""

echo ""
echo "--- FR-N110.4: Grafana 대시보드 ---"
F="$BASE/cost-prediction-dashboard.json"
[ -f "$F" ] && pass "대시보드 JSON 파일 존재" || fail "파일 누락" "$F"
grep -q "finops-cost-prediction" "$F" && pass "대시보드 UID 설정" || fail "UID 미설정" ""
grep -q "gauge" "$F" && pass "게이지 패널 포함" || fail "게이지 누락" ""
grep -q "timeseries" "$F" && pass "시계열 패널 포함" || fail "시계열 누락" ""
grep -q "piechart" "$F" && pass "파이 차트 패널 포함" || fail "파이차트 누락" ""
grep -q "currencyKRW" "$F" && pass "원화 단위 설정" || fail "통화 단위 미설정" ""

PANEL_COUNT=$(grep -c '"title"' "$F" || true)
[ "$PANEL_COUNT" -ge 6 ] && pass "대시보드 패널 6개 이상 ($PANEL_COUNT개)" || fail "패널 부족" "$PANEL_COUNT"

echo ""
echo "============================================"
echo " 테스트 결과: ${PASS}/${TOTAL} 통과 (실패: ${FAIL})"
echo "============================================"
[ $FAIL -gt 0 ] && exit 1
MATCH_RATE=$(echo "scale=1; $PASS * 100 / $TOTAL" | bc)
echo "matchRate: ${MATCH_RATE}%"
echo "[PASS] MTU-N110 E2E 테스트 모두 통과"
