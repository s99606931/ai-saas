#!/bin/bash
# ============================================================
# MTU-N74: SRE Runbook + 황금 신호 검증 테스트
# Plan SC: FR-N74.5
# ============================================================

set -euo pipefail

PASS=0
FAIL=0
TOTAL=12

log_pass() { echo "  [PASS] $1"; PASS=$((PASS+1)); }
log_fail() { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }

echo "============================================================"
echo "MTU-N74: SRE Runbook + 황금 신호 검증"
echo "날짜: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
echo ""

GS=/data/ai-saas/infra/monitoring/golden-signals-rules.yaml
RB=/data/ai-saas/docs/operations/runbooks
RA=/data/ai-saas/scripts/runbook-automation

# GS-01: 황금 신호 Recording Rules 파일 존재
echo "[GS-01] 황금 신호 Recording Rules 존재 확인"
if [ -f "$GS" ] && grep -q 'golden-signals' "$GS"; then
  log_pass "황금 신호 Recording Rules 존재"
else
  log_fail "황금 신호 Recording Rules 미존재"
fi

# GS-02: 4대 신호 전수 (Latency, Traffic, Errors, Saturation)
echo "[GS-02] 4대 황금 신호 전수 확인"
SIGNALS=0
grep -q 'signal: latency' "$GS" 2>/dev/null && SIGNALS=$((SIGNALS+1))
grep -q 'signal: traffic' "$GS" 2>/dev/null && SIGNALS=$((SIGNALS+1))
grep -q 'signal: errors' "$GS" 2>/dev/null && SIGNALS=$((SIGNALS+1))
grep -q 'signal: saturation' "$GS" 2>/dev/null && SIGNALS=$((SIGNALS+1))
if [ "$SIGNALS" -eq 4 ]; then
  log_pass "4대 황금 신호 전수 정의됨"
else
  log_fail "황금 신호 부족 (${SIGNALS}/4)"
fi

# GS-03: P50/P95/P99 Recording Rules
echo "[GS-03] Latency P50/P95/P99 Recording Rules 확인"
P_COUNT=0
grep -q 'p50' "$GS" 2>/dev/null && P_COUNT=$((P_COUNT+1))
grep -q 'p95' "$GS" 2>/dev/null && P_COUNT=$((P_COUNT+1))
grep -q 'p99' "$GS" 2>/dev/null && P_COUNT=$((P_COUNT+1))
if [ "$P_COUNT" -eq 3 ]; then
  log_pass "Latency P50/P95/P99 전수 정의됨"
else
  log_fail "Latency 분위수 부족 (${P_COUNT}/3)"
fi

# GS-04: 알림 규칙 runbook_url 포함
echo "[GS-04] 알림 규칙 runbook_url 포함 확인"
RU_COUNT=$(grep -c 'runbook_url' "$GS" 2>/dev/null || echo 0)
if [ "$RU_COUNT" -ge 3 ]; then
  log_pass "알림 ${RU_COUNT}건에 runbook_url 포함"
else
  log_fail "runbook_url 부족 (${RU_COUNT}건)"
fi

# GS-05: Runbook 10종 존재
echo "[GS-05] Runbook 문서 10종 확인"
RB_COUNT=$(ls "$RB"/*.md 2>/dev/null | grep -v README | wc -l || echo 0)
if [ "$RB_COUNT" -ge 10 ]; then
  log_pass "Runbook ${RB_COUNT}종 존재"
else
  log_fail "Runbook 부족 (${RB_COUNT}/10종)"
fi

# GS-06: Runbook README 존재
echo "[GS-06] Runbook README 목록 확인"
if [ -f "$RB/README.md" ] && grep -q 'Runbook' "$RB/README.md"; then
  log_pass "Runbook README 존재"
else
  log_fail "Runbook README 미존재"
fi

# GS-07: 자동화 스크립트 10종 존재
echo "[GS-07] 자동화 스크립트 10종 확인"
RA_COUNT=$(ls "$RA"/runbook-*.sh 2>/dev/null | wc -l || echo 0)
if [ "$RA_COUNT" -ge 10 ]; then
  log_pass "자동화 스크립트 ${RA_COUNT}종 존재"
else
  log_fail "자동화 스크립트 부족 (${RA_COUNT}/10종)"
fi

# GS-08: 스크립트 실행 권한 확인
echo "[GS-08] 스크립트 실행 권한 확인"
EXEC_COUNT=$(find "$RA" -name "runbook-*.sh" -executable 2>/dev/null | wc -l || echo 0)
if [ "$EXEC_COUNT" -ge 10 ]; then
  log_pass "스크립트 ${EXEC_COUNT}개 실행 가능"
else
  log_fail "실행 불가 스크립트 존재 (${EXEC_COUNT}/10개)"
fi

# GS-09: CSAP D-06 매핑 확인
echo "[GS-09] CSAP D-06 매핑 확인"
if grep -q 'D-06' "$GS" 2>/dev/null; then
  log_pass "CSAP D-06 매핑 확인됨"
else
  log_fail "CSAP D-06 매핑 미확인"
fi

# GS-10: CPU/Memory 포화도 규칙
echo "[GS-10] CPU+Memory 포화도 규칙 확인"
SAT_COUNT=0
grep -q 'cpu_saturation' "$GS" 2>/dev/null && SAT_COUNT=$((SAT_COUNT+1))
grep -q 'memory_saturation' "$GS" 2>/dev/null && SAT_COUNT=$((SAT_COUNT+1))
if [ "$SAT_COUNT" -eq 2 ]; then
  log_pass "CPU+Memory 포화도 규칙 정의됨"
else
  log_fail "포화도 규칙 부족 (${SAT_COUNT}/2)"
fi

# GS-11: 디스크 포화도 규칙
echo "[GS-11] 디스크 포화도 규칙 확인"
if grep -q 'disk_saturation' "$GS" 2>/dev/null; then
  log_pass "디스크 포화도 규칙 정의됨"
else
  log_fail "디스크 포화도 규칙 미정의"
fi

# GS-12: HighErrorRate 알림 규칙 (>5%)
echo "[GS-12] HighErrorRate 알림 규칙 확인"
if grep -q 'HighErrorRate' "$GS" 2>/dev/null; then
  log_pass "HighErrorRate 알림 정의됨"
else
  log_fail "HighErrorRate 알림 미정의"
fi

echo ""
echo "============================================================"
echo "MTU-N74 SRE Runbook + 황금 신호 검증 결과"
echo "============================================================"
echo "  통과: ${PASS} / ${TOTAL}"
echo "  실패: ${FAIL} / ${TOTAL}"
echo "  매치율: $(( PASS * 100 / TOTAL ))%"
echo "============================================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
