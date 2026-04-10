#!/usr/bin/env bash
# =============================================================================
# AI 기반 이상 탐지 검증 스크립트
# Design Ref: MTU-N92 Design §2
# Plan SC: FR-N92.1 ~ FR-N92.6
# =============================================================================
set -euo pipefail

PASS=0
FAIL=0
TOTAL=0

pass() { PASS=$((PASS + 1)); TOTAL=$((TOTAL + 1)); echo "  [PASS] $1"; }
fail() { FAIL=$((FAIL + 1)); TOTAL=$((TOTAL + 1)); echo "  [FAIL] $1"; }
section() { echo ""; echo "=== $1 ==="; }

# =============================================================================
# TEST 1: 적응형 임계값 Recording Rules (FR-N92.4)
# =============================================================================
section "TEST 1: 적응형 임계값 Recording Rules (FR-N92.4)"

AR="infra/monitoring/anomaly-detection-rules.yaml"

if [ -f "$AR" ]; then
  pass "이상 탐지 규칙 파일 존재"
else
  fail "이상 탐지 규칙 파일 없음"
fi

if grep -q "kind: PrometheusRule" "$AR" 2>/dev/null; then
  pass "PrometheusRule 리소스 타입 올바름"
else
  fail "PrometheusRule 리소스 타입 오류"
fi

# 이동 평균 Recording Rules 확인
for rule in "avg1h" "stddev1h" "zscore"; do
  if grep -q "$rule" "$AR" 2>/dev/null; then
    pass "적응형 임계값: $rule 계산 규칙 존재"
  else
    fail "적응형 임계값: $rule 계산 규칙 누락"
  fi
done

# clamp_min 보호 (0으로 나누기 방지)
if grep -q "clamp_min" "$AR" 2>/dev/null; then
  pass "clamp_min으로 0 나누기 방지 적용"
else
  fail "clamp_min 미적용 (0 나누기 위험)"
fi

# =============================================================================
# TEST 2: 서비스 요청률 이상 탐지 (FR-N92.1)
# =============================================================================
section "TEST 2: 서비스 요청률 이상 탐지 (FR-N92.1)"

if grep -q "AnomalyHighRequestRate" "$AR" 2>/dev/null; then
  pass "요청률 이상 알림 규칙 존재"
else
  fail "요청률 이상 알림 규칙 누락"
fi

if grep -q "AnomalyVeryHighRequestRate" "$AR" 2>/dev/null; then
  pass "극심한 요청률 이상 알림 규칙 존재 (5 sigma)"
else
  fail "극심한 요청률 이상 알림 규칙 누락"
fi

if grep -q "AnomalyLowRequestRate" "$AR" 2>/dev/null; then
  pass "요청률 감소 이상 알림 규칙 존재"
else
  fail "요청률 감소 이상 알림 규칙 누락"
fi

# =============================================================================
# TEST 3: 응답 지연 이상 탐지 (FR-N92.2)
# =============================================================================
section "TEST 3: 응답 지연 이상 탐지 (FR-N92.2)"

if grep -q "AnomalyHighLatency" "$AR" 2>/dev/null; then
  pass "지연 이상 알림 규칙 존재"
else
  fail "지연 이상 알림 규칙 누락"
fi

if grep -q "AnomalyVeryHighLatency" "$AR" 2>/dev/null; then
  pass "극심한 지연 이상 알림 규칙 존재"
else
  fail "극심한 지연 이상 알림 규칙 누락"
fi

# =============================================================================
# TEST 4: 에러율 이상 탐지 (FR-N92.3)
# =============================================================================
section "TEST 4: 에러율 이상 탐지 (FR-N92.3)"

if grep -q "AnomalyHighErrorRate" "$AR" 2>/dev/null; then
  pass "에러율 이상 알림 규칙 존재"
else
  fail "에러율 이상 알림 규칙 누락"
fi

if grep -q "AnomalyVeryHighErrorRate" "$AR" 2>/dev/null; then
  pass "극심한 에러율 이상 알림 규칙 존재"
else
  fail "극심한 에러율 이상 알림 규칙 누락"
fi

# =============================================================================
# TEST 5: 이상 탐지 대시보드 (FR-N92.5)
# =============================================================================
section "TEST 5: 이상 탐지 대시보드 (FR-N92.5)"

DB="infra/monitoring/dashboards/anomaly-detection.json"

if [ -f "$DB" ]; then
  pass "이상 탐지 대시보드 파일 존재"
else
  fail "이상 탐지 대시보드 파일 없음"
fi

if python3 -c "import json; json.load(open('$DB'))" 2>/dev/null; then
  pass "대시보드 JSON 유효성 통과"
else
  fail "대시보드 JSON 파싱 오류"
fi

for query in "zscore" "avg1h" "stddev1h" "3 \\* service"; do
  if grep -q "$query" "$DB" 2>/dev/null; then
    pass "대시보드에 쿼리 패턴 '$query' 포함"
  else
    fail "대시보드에 쿼리 패턴 '$query' 누락"
  fi
done

# =============================================================================
# TEST 6: 시스템 리소스 이상 탐지 (FR-N92.6)
# =============================================================================
section "TEST 6: 시스템 리소스 이상 탐지 (FR-N92.6)"

if grep -q "AnomalyHighCPU" "$AR" 2>/dev/null; then
  pass "CPU 이상 알림 규칙 존재"
else
  fail "CPU 이상 알림 규칙 누락"
fi

if grep -q "AnomalyHighMemory" "$AR" 2>/dev/null; then
  pass "메모리 이상 알림 규칙 존재"
else
  fail "메모리 이상 알림 규칙 누락"
fi

# Z-Score 임계값 확인 (3 sigma)
if grep -q "> 3" "$AR" 2>/dev/null; then
  pass "Z-Score 3 sigma 임계값 설정됨"
else
  fail "Z-Score 임계값 설정 오류"
fi

# Critical 임계값 확인 (5 sigma)
if grep -q "> 5" "$AR" 2>/dev/null; then
  pass "Z-Score 5 sigma Critical 임계값 설정됨"
else
  fail "Z-Score Critical 임계값 누락"
fi

# CSAP 참조
if grep -q "csap.ref" "$AR" 2>/dev/null; then
  pass "CSAP 참조 어노테이션 존재"
else
  fail "CSAP 참조 어노테이션 누락"
fi

# Runbook URL 참조
if grep -q "runbook_url" "$AR" 2>/dev/null; then
  pass "Runbook URL 참조 존재"
else
  fail "Runbook URL 참조 누락"
fi

# detection 레이블 확인
if grep -q "detection: z-score" "$AR" 2>/dev/null; then
  pass "detection 레이블 'z-score' 설정됨"
else
  fail "detection 레이블 누락"
fi

# =============================================================================
# 결과 요약
# =============================================================================
echo ""
echo "============================================"
echo "  MTU-N92 이상 탐지 검증 결과"
echo "============================================"
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "  TOTAL: $TOTAL"
echo "  RATE: $(( PASS * 100 / TOTAL ))%"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
