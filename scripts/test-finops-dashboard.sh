#!/usr/bin/env bash
set -euo pipefail
PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS + 1)); TOTAL=$((TOTAL + 1)); echo "  [PASS] $1"; }
fail() { FAIL=$((FAIL + 1)); TOTAL=$((TOTAL + 1)); echo "  [FAIL] $1"; }
section() { echo ""; echo "=== $1 ==="; }

FR="infra/monitoring/finops-cost-rules.yaml"
DB="infra/monitoring/dashboards/finops-cost-analysis.json"

section "TEST 1: 비용 할당 Rules (FR-N97.1)"
if [ -f "$FR" ]; then pass "비용 규칙 파일 존재"; else fail "없음"; fi
for r in "cost_cpu" "cost_memory" "cost_total" "daily_usd" "monthly_usd"; do
  if grep -q "$r" "$FR" 2>/dev/null; then pass "규칙 '$r' 존재"; else fail "'$r' 누락"; fi
done

section "TEST 2: FinOps 대시보드 (FR-N97.2)"
if [ -f "$DB" ]; then pass "대시보드 존재"; else fail "없음"; fi
if python3 -c "import json; json.load(open('$DB'))" 2>/dev/null; then pass "JSON 유효"; else fail "JSON 오류"; fi
if grep -q "currencyUSD" "$DB" 2>/dev/null; then pass "USD 단위 사용"; else fail "통화 단위 누락"; fi

section "TEST 3: 효율성 점수 (FR-N97.3)"
for r in "cpu_efficiency" "memory_efficiency" "cost_waste"; do
  if grep -q "$r" "$FR" 2>/dev/null; then pass "효율성 규칙 '$r' 존재"; else fail "'$r' 누락"; fi
done

section "TEST 4: 최적화 알림 (FR-N97.4)"
for a in "FinOpsCPUOverProvisioned" "FinOpsMemoryOverProvisioned"; do
  if grep -q "$a" "$FR" 2>/dev/null; then pass "알림 '$a' 존재"; else fail "'$a' 누락"; fi
done

echo ""
echo "============================================"
echo "  MTU-N97 FinOps 검증: PASS=$PASS FAIL=$FAIL RATE=$(( PASS * 100 / TOTAL ))%"
echo "============================================"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
