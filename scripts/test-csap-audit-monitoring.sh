#!/usr/bin/env bash
set -euo pipefail
PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS + 1)); TOTAL=$((TOTAL + 1)); echo "  [PASS] $1"; }
fail() { FAIL=$((FAIL + 1)); TOTAL=$((TOTAL + 1)); echo "  [FAIL] $1"; }
section() { echo ""; echo "=== $1 ==="; }

AR="infra/monitoring/csap-audit-monitoring-rules.yaml"

section "TEST 1: 감사 로그 메트릭 (FR-N99.1)"
if [ -f "$AR" ]; then pass "규칙 파일 존재"; else fail "없음"; fi
if grep -q "kind: PrometheusRule" "$AR" 2>/dev/null; then pass "PrometheusRule 타입"; else fail "타입 오류"; fi
for r in "csap:audit_events:rate5m" "csap:audit_events:total_24h" "csap:auth_failure:rate5m" "csap:rbac_denial:rate5m"; do
  if grep -q "$r" "$AR" 2>/dev/null; then pass "메트릭 '$r' 존재"; else fail "'$r' 누락"; fi
done

section "TEST 2: 무결성 알림 (FR-N99.2)"
if grep -q "CsapAuditLogWriteFailure" "$AR" 2>/dev/null; then pass "쓰기 실패 알림 존재"; else fail "누락"; fi
if grep -q "CsapAuditEventDrop" "$AR" 2>/dev/null; then pass "이벤트 급감 알림 존재"; else fail "누락"; fi

section "TEST 3: 보존 기간 알림 (FR-N99.3)"
if grep -q "CsapMetricRetentionInsufficient" "$AR" 2>/dev/null; then pass "보존 기간 알림 존재"; else fail "누락"; fi

section "TEST 4: CSAP 준수 확인"
if grep -q 'csap_ref: "D-06"' "$AR" 2>/dev/null; then pass "D-06 참조 레이블 존재"; else fail "D-06 레이블 누락"; fi
if grep -q 'csap_ref: "D-08"' "$AR" 2>/dev/null; then pass "D-08 참조 레이블 존재"; else fail "D-08 레이블 누락"; fi
if grep -q "csap.ref/d06" "$AR" 2>/dev/null; then pass "D-06 어노테이션 존재"; else fail "D-06 어노테이션 누락"; fi

section "TEST 5: 감사 누락 감지 (FR-N99.5)"
if grep -q "CsapAuthFailureSpike" "$AR" 2>/dev/null; then pass "인증 실패 급증 알림 존재"; else fail "누락"; fi
if grep -q "CsapRBACDenialSpike" "$AR" 2>/dev/null; then pass "RBAC 거부 급증 알림 존재"; else fail "누락"; fi
if grep -q "CsapNoAuditEvents24h" "$AR" 2>/dev/null; then pass "24시간 이벤트 없음 알림 존재"; else fail "누락"; fi

# YAML 유효성
if python3 -c "import yaml; yaml.safe_load(open('$AR'))" 2>/dev/null; then pass "YAML 유효"; else fail "YAML 오류"; fi

echo ""
echo "============================================"
echo "  MTU-N99 CSAP 감사 모니터링: PASS=$PASS FAIL=$FAIL RATE=$(( PASS * 100 / TOTAL ))%"
echo "============================================"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
