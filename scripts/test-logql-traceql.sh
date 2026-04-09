#!/bin/bash
# =============================================================================
# MTU-N69: LogQL + TraceQL 고급 쿼리 테스트
# Design Ref: MTU-N69 Design §1, §2, §3
# Plan SC: FR-N69.5
# CSAP: D-06(로그 분석 체계 검증)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 색상 출력
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

PASS=0; FAIL=0; SKIP=0; TOTAL=0

pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo -e "  ${GREEN}[PASS]${NC} $*"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo -e "  ${RED}[FAIL]${NC} $*"; }
skip() { SKIP=$((SKIP+1)); TOTAL=$((TOTAL+1)); echo -e "  ${YELLOW}[SKIP]${NC} $*"; }
header() { echo -e "\n${BOLD}${CYAN}=== $* ===${NC}"; }

GUIDE="$PROJECT_DIR/docs/operations/logql-traceql-query-guide.md"
LOKI_RULES="$PROJECT_DIR/infra/monitoring/loki-alerting-rules.yaml"

# =============================================================================
# Phase 1: 파일 존재 검증
# =============================================================================
header "Phase 1: 파일 존재 검증"

if [[ -f "$GUIDE" ]]; then
  pass "T1: LogQL/TraceQL 쿼리 가이드 존재"
else
  fail "T1: logql-traceql-query-guide.md 미존재"
fi

if [[ -f "$LOKI_RULES" ]]; then
  pass "T2: Loki 알림 규칙 파일 존재"
else
  fail "T2: loki-alerting-rules.yaml 미존재"
fi

# =============================================================================
# Phase 2: LogQL 쿼리 패턴 검증 (10종)
# =============================================================================
header "Phase 2: LogQL 쿼리 패턴 검증 (10종)"

LOGQL_PATTERNS=(
  "L1:에러 로그:error"
  "L2:HTTP 500:status >= 500"
  "L3:느린 요청:duration"
  "L4:인증 실패:401"
  "L5:PII 탐지:PII_DETECTED"
  "L6:감사 이벤트:audit"
  "L7:OOM Kill:OOMKilled"
  "L8:CrashLoop:CrashLoopBackOff"
  "L9:로그량 통계:rate"
  "L10:에러율 트렌드:error"
)

LOGQL_COUNT=0
for pattern in "${LOGQL_PATTERNS[@]}"; do
  IFS=':' read -r id desc keyword <<< "$pattern"
  if grep -q "$keyword" "$GUIDE" 2>/dev/null; then
    LOGQL_COUNT=$((LOGQL_COUNT+1))
  fi
done

if [[ "$LOGQL_COUNT" -ge 10 ]]; then
  pass "T3: FR-N69.1 LogQL 쿼리 패턴 ${LOGQL_COUNT}/10 존재"
else
  fail "T3: FR-N69.1 LogQL 쿼리 패턴 ${LOGQL_COUNT}/10 (미달)"
fi

# =============================================================================
# Phase 3: TraceQL 쿼리 패턴 검증 (8종)
# =============================================================================
header "Phase 3: TraceQL 쿼리 패턴 검증 (8종)"

TRACEQL_PATTERNS=(
  "T1:에러 트레이스:status = error"
  "T2:서비스 5xx:http.status_code"
  "T3:느린 트레이스:duration > 3s"
  "T4:서비스 체인:>>"
  "T5:HTTP 메서드:http.method"
  "T6:에러 체인:error"
  "T7:사용자 트레이스:user.id"
  "T8:DB 쿼리:db.system"
)

TRACEQL_COUNT=0
for pattern in "${TRACEQL_PATTERNS[@]}"; do
  IFS=':' read -r id desc keyword <<< "$pattern"
  if grep -q "$keyword" "$GUIDE" 2>/dev/null; then
    TRACEQL_COUNT=$((TRACEQL_COUNT+1))
  fi
done

if [[ "$TRACEQL_COUNT" -ge 8 ]]; then
  pass "T4: FR-N69.2 TraceQL 쿼리 패턴 ${TRACEQL_COUNT}/8 존재"
else
  fail "T4: FR-N69.2 TraceQL 쿼리 패턴 ${TRACEQL_COUNT}/8 (미달)"
fi

# =============================================================================
# Phase 4: Loki 알림 규칙 검증 (FR-N69.3)
# =============================================================================
header "Phase 4: Loki 알림 규칙 검증"

# T5: 알림 규칙 파일 YAML 유효성
if python3 -c "import yaml; yaml.safe_load(open('$LOKI_RULES'))" 2>/dev/null; then
  pass "T5: Loki 알림 규칙 YAML 유효성 통과"
else
  fail "T5: Loki 알림 규칙 YAML 유효성 실패"
fi

# T6: 에러 로그 알림 규칙
if grep -q "HighErrorLogRate" "$LOKI_RULES" 2>/dev/null; then
  pass "T6: FR-N69.3 에러 로그 급증 알림 규칙"
else
  fail "T6: FR-N69.3 에러 로그 알림 규칙 누락"
fi

# T7: 인증 실패 알림
if grep -q "AuthenticationFailureSpike" "$LOKI_RULES" 2>/dev/null; then
  pass "T7: FR-N69.3 인증 실패 급증 알림"
else
  fail "T7: FR-N69.3 인증 실패 알림 누락"
fi

# T8: PII 유출 탐지 알림
if grep -q "PIILeakageDetected" "$LOKI_RULES" 2>/dev/null; then
  pass "T8: FR-N69.3 PII 유출 탐지 알림"
else
  fail "T8: FR-N69.3 PII 유출 탐지 알림 누락"
fi

# T9: OOM Kill 탐지 알림
if grep -q "OOMKillDetected" "$LOKI_RULES" 2>/dev/null; then
  pass "T9: FR-N69.3 OOM Kill 탐지 알림"
else
  fail "T9: FR-N69.3 OOM Kill 알림 누락"
fi

# T10: 알림 규칙 총 개수 (5개 이상)
ALERT_COUNT=$(grep -c "alert:" "$LOKI_RULES" 2>/dev/null || echo 0)
if [[ "$ALERT_COUNT" -ge 5 ]]; then
  pass "T10: Loki 알림 규칙 ${ALERT_COUNT}개 (목표: 5개+)"
else
  fail "T10: Loki 알림 규칙 ${ALERT_COUNT}개 (목표: 5개 미달)"
fi

# =============================================================================
# Phase 5: 상관관계 + CSAP 검증
# =============================================================================
header "Phase 5: 상관관계 및 CSAP 검증"

# T11: 로그-트레이스 상관관계 섹션
if grep -q "traceID" "$GUIDE" 2>/dev/null || grep -q "traceId" "$GUIDE" 2>/dev/null; then
  pass "T11: FR-N69.4 로그-트레이스 상관관계 가이드"
else
  fail "T11: FR-N69.4 로그-트레이스 상관관계 누락"
fi

# T12: CSAP D-06 참조 (알림 규칙)
if grep -q "D-06" "$LOKI_RULES" 2>/dev/null; then
  pass "T12: CSAP D-06 참조 (Loki 알림 규칙)"
else
  fail "T12: CSAP D-06 참조 누락"
fi

# T13: CSAP D-08 참조 (보안 알림)
if grep -q "D-08" "$LOKI_RULES" 2>/dev/null; then
  pass "T13: CSAP D-08 참조 (보안 알림)"
else
  fail "T13: CSAP D-08 참조 누락"
fi

# T14: Runbook 참조
if grep -q "runbook" "$LOKI_RULES" 2>/dev/null; then
  pass "T14: 알림 규칙에 Runbook 참조 포함"
else
  fail "T14: Runbook 참조 누락"
fi

# T15: Design Ref 주석
if grep -q "Design Ref" "$LOKI_RULES" 2>/dev/null; then
  pass "T15: Design Ref 주석 포함"
else
  fail "T15: Design Ref 주석 누락"
fi

# =============================================================================
# 결과 요약
# =============================================================================
echo ""
header "테스트 결과 요약"
echo -e "  ${GREEN}PASS${NC}: $PASS"
echo -e "  ${RED}FAIL${NC}: $FAIL"
echo -e "  ${YELLOW}SKIP${NC}: $SKIP"
echo -e "  ${BOLD}TOTAL${NC}: $TOTAL"

MATCH_RATE=0
if [[ $((PASS + FAIL)) -gt 0 ]]; then
  MATCH_RATE=$(( (PASS * 100) / (PASS + FAIL) ))
fi
echo -e "\n  ${BOLD}matchRate: ${MATCH_RATE}%${NC}"

if [[ $FAIL -eq 0 ]]; then
  echo -e "\n${GREEN}${BOLD}  MTU-N69 LogQL + TraceQL 쿼리 최적화: ALL PASS${NC}"
  exit 0
else
  echo -e "\n${RED}${BOLD}  MTU-N69: ${FAIL}개 테스트 실패${NC}"
  exit 1
fi
