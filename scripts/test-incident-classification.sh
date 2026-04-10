#!/usr/bin/env bash
# =============================================================================
# 인시던트 자동 분류 + 에스컬레이션 검증 스크립트
# Design Ref: MTU-N95 Design
# Plan SC: FR-N95.1 ~ FR-N95.5
# =============================================================================
set -euo pipefail

PASS=0
FAIL=0
TOTAL=0

pass() { PASS=$((PASS + 1)); TOTAL=$((TOTAL + 1)); echo "  [PASS] $1"; }
fail() { FAIL=$((FAIL + 1)); TOTAL=$((TOTAL + 1)); echo "  [FAIL] $1"; }
section() { echo ""; echo "=== $1 ==="; }

IR="infra/monitoring/incident-classification-rules.yaml"
DB="infra/monitoring/dashboards/incident-management.json"
DOC="docs/operations/incident-management-process.md"

# =============================================================================
# TEST 1: 인시던트 분류 정책 (FR-N95.1)
# =============================================================================
section "TEST 1: 인시던트 분류 정책 (FR-N95.1)"

if [ -f "$IR" ]; then pass "분류 규칙 파일 존재"; else fail "분류 규칙 파일 없음"; fi
if grep -q "kind: PrometheusRule" "$IR" 2>/dev/null; then pass "PrometheusRule 타입 올바름"; else fail "타입 오류"; fi

for cat in "security" "availability" "performance" "infrastructure" "deployment"; do
  if grep -q "category: $cat" "$IR" 2>/dev/null || grep -q "$cat" "$IR" 2>/dev/null; then
    pass "인시던트 카테고리 '$cat' 정의됨"
  else
    fail "인시던트 카테고리 '$cat' 누락"
  fi
done

for priority in "P1" "P2"; do
  if grep -q "priority: $priority" "$IR" 2>/dev/null; then
    pass "우선순위 '$priority' 정의됨"
  else
    fail "우선순위 '$priority' 누락"
  fi
done

# =============================================================================
# TEST 2: 에스컬레이션 정책 (FR-N95.2)
# =============================================================================
section "TEST 2: 에스컬레이션 정책 (FR-N95.2)"

if grep -q "escalation" "$IR" 2>/dev/null; then pass "에스컬레이션 레이블 존재"; else fail "에스컬레이션 레이블 누락"; fi

# =============================================================================
# TEST 3: SLO 위반 롤백 트리거 (FR-N95.3)
# =============================================================================
section "TEST 3: SLO 위반 롤백 트리거 (FR-N95.3)"

if grep -q "SLORollbackTriggerBurnRate" "$IR" 2>/dev/null; then pass "에러 예산 소진 롤백 트리거 존재"; else fail "누락"; fi
if grep -q "SLORollbackTriggerAvailability" "$IR" 2>/dev/null; then pass "가용성 롤백 트리거 존재"; else fail "누락"; fi
if grep -q "SLORollbackTriggerLatency" "$IR" 2>/dev/null; then pass "지연 롤백 트리거 존재"; else fail "누락"; fi
if grep -q "rollback_candidate" "$IR" 2>/dev/null; then pass "롤백 후보 레이블 존재"; else fail "누락"; fi

# =============================================================================
# TEST 4: 인시던트 대시보드 (FR-N95.4)
# =============================================================================
section "TEST 4: 인시던트 대시보드 (FR-N95.4)"

if [ -f "$DB" ]; then pass "인시던트 대시보드 파일 존재"; else fail "대시보드 없음"; fi
if python3 -c "import json; json.load(open('$DB'))" 2>/dev/null; then pass "JSON 유효성 통과"; else fail "JSON 오류"; fi
for q in "incident:total" "incident:p1" "incident:security" "rollback_candidate"; do
  if grep -q "$q" "$DB" 2>/dev/null; then pass "대시보드에 '$q' 쿼리 포함"; else fail "'$q' 누락"; fi
done

# =============================================================================
# TEST 5: 인시던트 관리 프로세스 문서 (FR-N95.5)
# =============================================================================
section "TEST 5: 인시던트 관리 프로세스 문서 (FR-N95.5)"

if [ -f "$DOC" ]; then pass "인시던트 관리 문서 존재"; else fail "문서 없음"; fi
for keyword in "에스컬레이션" "롤백" "감사 로그" "카테고리" "우선순위" "사후 분석"; do
  if grep -q "$keyword" "$DOC" 2>/dev/null; then pass "문서에 '$keyword' 포함"; else fail "'$keyword' 누락"; fi
done

# CSAP 참조
if grep -q "CSAP" "$IR" 2>/dev/null; then pass "규칙에 CSAP 참조 존재"; else fail "CSAP 참조 누락"; fi

# =============================================================================
# 결과 요약
# =============================================================================
echo ""
echo "============================================"
echo "  MTU-N95 인시던트 분류 검증 결과"
echo "============================================"
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "  TOTAL: $TOTAL"
echo "  RATE: $(( PASS * 100 / TOTAL ))%"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then exit 1; fi
