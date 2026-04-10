#!/usr/bin/env bash
set -euo pipefail
PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS + 1)); TOTAL=$((TOTAL + 1)); echo "  [PASS] $1"; }
fail() { FAIL=$((FAIL + 1)); TOTAL=$((TOTAL + 1)); echo "  [FAIL] $1"; }
section() { echo ""; echo "=== $1 ==="; }

MR="infra/monitoring/multitenant-monitoring-rules.yaml"
DB="infra/monitoring/dashboards/tenant-monitoring.json"

section "TEST 1: 테넌트별 Recording Rules (FR-N96.1)"
if [ -f "$MR" ]; then pass "규칙 파일 존재"; else fail "파일 없음"; fi
for rule in "tenant:cpu_usage" "tenant:memory_usage" "tenant:pod_count" "tenant:network_receive"; do
  if grep -q "$rule" "$MR" 2>/dev/null; then pass "Recording Rule '$rule' 존재"; else fail "'$rule' 누락"; fi
done

section "TEST 2: 테넌트별 SLO (FR-N96.2)"
for rule in "tenant:availability" "tenant:error_rate" "tenant:latency_p99" "tenant:request_rate"; do
  if grep -q "$rule" "$MR" 2>/dev/null; then pass "SLO Rule '$rule' 존재"; else fail "'$rule' 누락"; fi
done

section "TEST 3: 테넌트별 쿼터 모니터링 (FR-N96.3)"
for rule in "tenant:cpu_quota_usage" "tenant:memory_quota_usage"; do
  if grep -q "$rule" "$MR" 2>/dev/null; then pass "쿼터 Rule '$rule' 존재"; else fail "'$rule' 누락"; fi
done

section "TEST 4: 테넌트 대시보드 (FR-N96.4)"
if [ -f "$DB" ]; then pass "대시보드 파일 존재"; else fail "대시보드 없음"; fi
if python3 -c "import json; json.load(open('$DB'))" 2>/dev/null; then pass "JSON 유효"; else fail "JSON 오류"; fi
if grep -q "tenant" "$DB" 2>/dev/null; then pass "테넌트 변수 사용"; else fail "변수 누락"; fi
if grep -q "templating" "$DB" 2>/dev/null; then pass "Grafana 변수 템플릿 존재"; else fail "변수 템플릿 누락"; fi

section "TEST 5: 테넌트별 알림 (FR-N96.5)"
for alert in "TenantSLOAvailabilityBreach" "TenantCPUQuotaHigh" "TenantMemoryQuotaHigh"; do
  if grep -q "$alert" "$MR" 2>/dev/null; then pass "알림 '$alert' 존재"; else fail "'$alert' 누락"; fi
done

section "TEST 6: CSAP/N2SF 준수"
if grep -q "csap.ref" "$MR" 2>/dev/null; then pass "CSAP 참조 존재"; else fail "CSAP 참조 누락"; fi
if grep -q "n2sf.ref" "$MR" 2>/dev/null; then pass "N2SF 참조 존재"; else fail "N2SF 참조 누락"; fi
if grep -q "namespace!~" "$MR" 2>/dev/null; then pass "시스템 NS 제외 필터 존재"; else fail "시스템 NS 제외 누락"; fi

echo ""
echo "============================================"
echo "  MTU-N96 멀티테넌트 모니터링 검증 결과"
echo "  PASS: $PASS / FAIL: $FAIL / TOTAL: $TOTAL"
echo "  RATE: $(( PASS * 100 / TOTAL ))%"
echo "============================================"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
