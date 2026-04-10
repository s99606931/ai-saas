#!/usr/bin/env bash
# =============================================================================
# 예측적 스케일링 메트릭 검증 스크립트
# Design Ref: MTU-N93 Design §2
# Plan SC: FR-N93.1 ~ FR-N93.6
# =============================================================================
set -euo pipefail

PASS=0
FAIL=0
TOTAL=0

pass() { PASS=$((PASS + 1)); TOTAL=$((TOTAL + 1)); echo "  [PASS] $1"; }
fail() { FAIL=$((FAIL + 1)); TOTAL=$((TOTAL + 1)); echo "  [FAIL] $1"; }
section() { echo ""; echo "=== $1 ==="; }

PR="infra/monitoring/predictive-scaling-rules.yaml"
DB="infra/monitoring/dashboards/predictive-scaling.json"

# =============================================================================
# TEST 1: 규칙 파일 구조 검증
# =============================================================================
section "TEST 1: 규칙 파일 구조 검증"

if [ -f "$PR" ]; then pass "예측 규칙 파일 존재"; else fail "예측 규칙 파일 없음"; fi
if grep -q "kind: PrometheusRule" "$PR" 2>/dev/null; then pass "PrometheusRule 타입 올바름"; else fail "PrometheusRule 타입 오류"; fi
if grep -q "predict_linear" "$PR" 2>/dev/null; then pass "predict_linear 함수 사용됨"; else fail "predict_linear 함수 누락"; fi

# =============================================================================
# TEST 2: 디스크 용량 소진 예측 (FR-N93.1)
# =============================================================================
section "TEST 2: 디스크 용량 소진 예측 (FR-N93.1)"

if grep -q "PredictDiskFullIn24h" "$PR" 2>/dev/null; then pass "디스크 24시간 예측 알림 존재"; else fail "디스크 24시간 예측 알림 누락"; fi
if grep -q "PredictDiskFullIn4h" "$PR" 2>/dev/null; then pass "디스크 4시간 예측 알림 존재 (critical)"; else fail "디스크 4시간 예측 알림 누락"; fi
if grep -q "disk_exhaustion:seconds" "$PR" 2>/dev/null; then pass "디스크 소진 시간 계산 규칙 존재"; else fail "디스크 소진 시간 계산 누락"; fi

# =============================================================================
# TEST 3: 메모리 트렌드 예측 (FR-N93.2)
# =============================================================================
section "TEST 3: 메모리 트렌드 예측 (FR-N93.2)"

if grep -q "PredictMemoryExhaustIn24h" "$PR" 2>/dev/null; then pass "메모리 24시간 예측 알림 존재"; else fail "메모리 24시간 예측 알림 누락"; fi
if grep -q "PredictMemoryExhaustIn6h" "$PR" 2>/dev/null; then pass "메모리 6시간 예측 알림 존재 (critical)"; else fail "메모리 6시간 예측 알림 누락"; fi

# =============================================================================
# TEST 4: CPU 트렌드 예측 (FR-N93.3)
# =============================================================================
section "TEST 4: CPU 트렌드 예측 (FR-N93.3)"

if grep -q "PredictHighCPUIn24h" "$PR" 2>/dev/null; then pass "CPU 24시간 예측 알림 존재"; else fail "CPU 24시간 예측 알림 누락"; fi
if grep -q "cpu_usage:predict24h" "$PR" 2>/dev/null; then pass "CPU 예측 Recording Rule 존재"; else fail "CPU 예측 Recording Rule 누락"; fi

# =============================================================================
# TEST 5: 네트워크 대역폭 트렌드 (FR-N93.4)
# =============================================================================
section "TEST 5: 네트워크 대역폭 트렌드 (FR-N93.4)"

if grep -q "network_receive:predict24h" "$PR" 2>/dev/null; then pass "네트워크 예측 Recording Rule 존재"; else fail "네트워크 예측 Recording Rule 누락"; fi

# =============================================================================
# TEST 6: 예측 대시보드 (FR-N93.5)
# =============================================================================
section "TEST 6: 예측 대시보드 (FR-N93.5)"

if [ -f "$DB" ]; then pass "예측 대시보드 파일 존재"; else fail "예측 대시보드 파일 없음"; fi
if python3 -c "import json; json.load(open('$DB'))" 2>/dev/null; then pass "대시보드 JSON 유효성 통과"; else fail "JSON 파싱 오류"; fi
for q in "predict24h" "predict48h" "disk_exhaustion"; do
  if grep -q "$q" "$DB" 2>/dev/null; then pass "대시보드에 '$q' 쿼리 포함"; else fail "대시보드에 '$q' 쿼리 누락"; fi
done

# =============================================================================
# TEST 7: PV 용량 소진 예측 (FR-N93.6)
# =============================================================================
section "TEST 7: PV 용량 소진 예측 (FR-N93.6)"

if grep -q "PredictPVFullIn48h" "$PR" 2>/dev/null; then pass "PV 48시간 예측 알림 존재"; else fail "PV 48시간 예측 알림 누락"; fi
if grep -q "PredictPVFullIn12h" "$PR" 2>/dev/null; then pass "PV 12시간 예측 알림 존재 (critical)"; else fail "PV 12시간 예측 알림 누락"; fi

# Runbook URL 확인
if grep -q "runbook_url" "$PR" 2>/dev/null; then pass "Runbook URL 참조 존재"; else fail "Runbook URL 누락"; fi
if grep -q "csap.ref" "$PR" 2>/dev/null; then pass "CSAP 참조 존재"; else fail "CSAP 참조 누락"; fi

# =============================================================================
# 결과 요약
# =============================================================================
echo ""
echo "============================================"
echo "  MTU-N93 예측적 스케일링 검증 결과"
echo "============================================"
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "  TOTAL: $TOTAL"
echo "  RATE: $(( PASS * 100 / TOTAL ))%"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then exit 1; fi
