#!/bin/bash
# 예측 스케일링 v2 E2E 테스트
# Plan SC: FR-N109.5

set -uo pipefail
PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "[FAIL] $1: $2"; }

echo "============================================"
echo " MTU-N109: ML 예측 스케일링 고도화 E2E 테스트"
echo "============================================"
echo ""

BASE="/data/ai-saas/infra/predictive-scaling"

echo "--- FR-N109.1: XGBoost 설정 ---"
F="$BASE/xgboost-ensemble.yaml"
[ -f "$F" ] && pass "XGBoost 설정 파일 존재" || fail "파일 누락" "$F"
grep -q "xgboost" "$F" && pass "XGBoost 모델 타입 정의" || fail "모델 미정의" ""
grep -q "n_estimators: 300" "$F" && pass "앙상블 300 추정기" || fail "파라미터 오류" ""
grep -q "features:" "$F" && pass "특성 벡터 정의" || fail "특성 미정의" ""
grep -q "hour_of_day" "$F" && pass "시간대 특성 포함" || fail "시간대 미포함" ""
grep -q "cpu_ma_5m" "$F" && pass "이동 평균 특성 포함" || fail "이동평균 미포함" ""
grep -q "cpu_derivative" "$F" && pass "변화율 특성 포함" || fail "변화율 미포함" ""
grep -q "prediction_horizons" "$F" && pass "예측 시점 정의 (15m/1h/24h)" || fail "예측 시점 미정의" ""

echo ""
echo "--- FR-N109.2: Prophet 계절성 ---"
F="$BASE/prophet-seasonality.yaml"
[ -f "$F" ] && pass "Prophet 설정 파일 존재" || fail "파일 누락" "$F"
grep -q "prophet" "$F" && pass "Prophet 모델 정의" || fail "모델 미정의" ""
grep -q "daily_seasonality: true" "$F" && pass "일간 계절성 설정" || fail "일간 미설정" ""
grep -q "weekly_seasonality: true" "$F" && pass "주간 계절성 설정" || fail "주간 미설정" ""
grep -q "ensemble" "$F" && pass "앙상블 설정 존재" || fail "앙상블 미정의" ""
grep -q "weighted_average" "$F" && pass "가중 평균 앙상블 방법" || fail "방법 미정의" ""
grep -q "KR" "$F" && pass "한국 공휴일 설정" || fail "공휴일 미설정" ""
grep -q "stl" "$F" && pass "STL 분해 설정" || fail "분해 미설정" ""

echo ""
echo "--- FR-N109.3: HPA Custom Metrics ---"
F="$BASE/hpa-custom-metrics.yaml"
[ -f "$F" ] && pass "HPA 설정 파일 존재" || fail "파일 누락" "$F"
grep -q "predicted_cpu_15m" "$F" && pass "15분 예측 메트릭 정의" || fail "예측 메트릭 미정의" ""
grep -q "predicted_memory_15m" "$F" && pass "메모리 예측 메트릭 정의" || fail "메모리 예측 미정의" ""
grep -q "HorizontalPodAutoscaler" "$F" && pass "HPA 예시 포함" || fail "HPA 미포함" ""
grep -q "External" "$F" && pass "External 메트릭 타입 사용" || fail "External 미사용" ""
grep -q "scaleUp" "$F" && pass "확장 정책 정의" || fail "확장 정책 누락" ""
grep -q "scaleDown" "$F" && pass "축소 정책 정의" || fail "축소 정책 누락" ""

echo ""
echo "--- FR-N109.4: 학습 파이프라인 ---"
F="$BASE/training-cronjob.yaml"
[ -f "$F" ] && pass "학습 파이프라인 파일 존재" || fail "파일 누락" "$F"
grep -q "CronJob" "$F" && pass "CronJob 리소스 타입" || fail "CronJob 미사용" ""
grep -q "XGBRegressor" "$F" && pass "XGBoost 학습 코드 포함" || fail "학습 코드 누락" ""
grep -q "TimeSeriesSplit" "$F" && pass "시계열 교차 검증 포함" || fail "CV 누락" ""
grep -q "PersistentVolumeClaim" "$F" && pass "모델 저장소 PVC" || fail "PVC 누락" ""
grep -q "runAsNonRoot" "$F" && pass "보안 컨텍스트 설정" || fail "보안 미설정" ""
grep -q "metadata.json" "$F" && pass "학습 메타데이터 저장" || fail "메타데이터 미저장" ""

echo ""
echo "============================================"
echo " 테스트 결과: ${PASS}/${TOTAL} 통과 (실패: ${FAIL})"
echo "============================================"
[ $FAIL -gt 0 ] && exit 1
MATCH_RATE=$(echo "scale=1; $PASS * 100 / $TOTAL" | bc)
echo "matchRate: ${MATCH_RATE}%"
echo "[PASS] MTU-N109 E2E 테스트 모두 통과"
