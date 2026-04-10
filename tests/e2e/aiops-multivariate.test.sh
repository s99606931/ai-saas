#!/bin/bash
# AIOps 다변량 이상 탐지 E2E 테스트
# Plan SC: FR-N107.6

set -uo pipefail

PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo "[FAIL] $1: $2"; }

echo "============================================"
echo " MTU-N107: AIOps 다변량 이상 탐지 E2E 테스트"
echo "============================================"
echo ""

BASE="/data/ai-saas/infra/anomaly-detection"

# 다변량 설정 검증
echo "--- FR-N107.1: Isolation Forest 설정 ---"
F="$BASE/multivariate-config.yaml"
[ -f "$F" ] && pass "다변량 설정 파일 존재" || fail "파일 누락" "$F"
grep -q "isolation_forest" "$F" && pass "Isolation Forest 알고리즘 설정" || fail "IF 미설정" ""
grep -q "n_estimators: 200" "$F" && pass "추정기 200개 설정" || fail "추정기 미설정" ""
grep -q "contamination: 0.05" "$F" && pass "오염도 5% 설정" || fail "오염도 미설정" ""

FEATURE_COUNT=$(grep -c "query:" "$F" || true)
[ "$FEATURE_COUNT" -ge 8 ] && pass "특성 벡터 8개 이상 ($FEATURE_COUNT개)" || fail "특성 벡터 부족" "$FEATURE_COUNT"
grep -q "normalization" "$F" && pass "정규화 설정 존재" || fail "정규화 미설정" ""
grep -q "deduplication_window" "$F" && pass "디듀플리케이션 윈도우 설정" || fail "디듀플 미설정" ""

# LSTM Autoencoder 검증
echo ""
echo "--- FR-N107.2: LSTM Autoencoder 설정 ---"
F="$BASE/lstm-autoencoder.yaml"
[ -f "$F" ] && pass "LSTM 설정 파일 존재" || fail "파일 누락" "$F"
grep -q "lstm_autoencoder" "$F" && pass "LSTM Autoencoder 아키텍처 정의" || fail "LSTM 미정의" ""
grep -q "encoder" "$F" && pass "인코더 레이어 정의" || fail "인코더 미정의" ""
grep -q "decoder" "$F" && pass "디코더 레이어 정의" || fail "디코더 미정의" ""
grep -q "early_stopping" "$F" && pass "조기 종료 설정" || fail "조기 종료 미설정" ""
grep -q "seasonality" "$F" && pass "계절성 보정 설정" || fail "계절성 미설정" ""

# 상관관계 규칙 검증
echo ""
echo "--- FR-N107.3: 상관관계 분석 규칙 ---"
F="$BASE/correlation-rules.yaml"
[ -f "$F" ] && pass "상관관계 규칙 파일 존재" || fail "파일 누락" "$F"
grep -q "resource_exhaustion" "$F" && pass "리소스 부족 패턴 규칙" || fail "규칙 누락" ""
grep -q "network_degradation" "$F" && pass "네트워크 장애 패턴 규칙" || fail "규칙 누락" ""
grep -q "application_failure" "$F" && pass "애플리케이션 장애 패턴 규칙" || fail "규칙 누락" ""
grep -q "total_outage" "$F" && pass "전면 장애 패턴 규칙" || fail "규칙 누락" ""
grep -q "suppression" "$F" && pass "알림 억제 규칙 존재" || fail "억제 규칙 누락" ""
grep -q "merge_alerts" "$F" && pass "알림 통합 액션 정의" || fail "통합 미정의" ""

# 학습 파이프라인 검증
echo ""
echo "--- FR-N107.4: 학습 파이프라인 ---"
F="$BASE/training-pipeline.yaml"
[ -f "$F" ] && pass "학습 파이프라인 파일 존재" || fail "파일 누락" "$F"
grep -q "CronJob" "$F" && pass "CronJob 리소스 타입" || fail "CronJob 미사용" ""
grep -q "schedule:" "$F" && pass "학습 스케줄 설정" || fail "스케줄 미설정" ""
grep -q "IsolationForest" "$F" && pass "학습 코드에 IF 모델 포함" || fail "모델 학습 코드 누락" ""
grep -q "PersistentVolumeClaim" "$F" && pass "모델 저장소 PVC 정의" || fail "PVC 미정의" ""
grep -q "runAsNonRoot" "$F" && pass "보안 컨텍스트 설정" || fail "보안 컨텍스트 미설정" ""

# 결과 요약
echo ""
echo "============================================"
echo " 테스트 결과: ${PASS}/${TOTAL} 통과 (실패: ${FAIL})"
echo "============================================"
[ $FAIL -gt 0 ] && exit 1
MATCH_RATE=$(echo "scale=1; $PASS * 100 / $TOTAL" | bc)
echo "matchRate: ${MATCH_RATE}%"
echo "[PASS] MTU-N107 E2E 테스트 모두 통과"
