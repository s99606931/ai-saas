#!/usr/bin/env bash
# =============================================================================
# MTU-N131: 보안 규정 준수 스캐너 E2E 테스트
# Plan SC: FR-N131.5
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0
TOTAL=0
TEST_OUTPUT_DIR=$(mktemp -d)

cleanup() { rm -rf "$TEST_OUTPUT_DIR"; }
trap cleanup EXIT

log_test() {
  TOTAL=$((TOTAL + 1))
  echo -e "\n${BLUE}[TEST $TOTAL]${NC} $1"
}

assert_pass() {
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}PASS${NC}: $1"
}

assert_fail() {
  FAIL=$((FAIL + 1))
  echo -e "  ${RED}FAIL${NC}: $1"
}

# 테스트 1: 산출물 존재
log_test "산출물 존재 확인"
if [[ -f "$PROJECT_ROOT/scripts/security-compliance-scan.sh" ]]; then
  assert_pass "security-compliance-scan.sh 존재"
else
  assert_fail "security-compliance-scan.sh 누락"
fi

# 테스트 2: 실행 권한
log_test "실행 권한 확인"
if [[ -x "$PROJECT_ROOT/scripts/security-compliance-scan.sh" ]]; then
  assert_pass "실행 가능"
else
  assert_fail "실행 권한 없음"
fi

# 테스트 3: 도움말
log_test "도움말 출력"
help_output=$("$PROJECT_ROOT/scripts/security-compliance-scan.sh" --help 2>&1 || true)
for keyword in "rule" "SECRET" "SQLI" "AUTH" "CRYPTO" "LOG"; do
  if echo "$help_output" | grep -q "$keyword"; then
    assert_pass "도움말에 $keyword"
  else
    assert_fail "도움말에 $keyword 미포함"
  fi
done

# 테스트 4: 유효하지 않은 규칙
log_test "유효하지 않은 규칙 검증"
if ! "$PROJECT_ROOT/scripts/security-compliance-scan.sh" --rule INVALID 2>/dev/null; then
  assert_pass "잘못된 규칙 시 오류"
else
  assert_fail "잘못된 규칙인데 성공"
fi

# 테스트 5: 전체 스캔 보고서
log_test "전체 보안 스캔 보고서"
"$PROJECT_ROOT/scripts/security-compliance-scan.sh" --output-dir "$TEST_OUTPUT_DIR" > /dev/null 2>&1

report=$(ls "$TEST_OUTPUT_DIR"/security-scan-*.md 2>/dev/null | head -1)
if [[ -n "$report" && -f "$report" ]]; then
  assert_pass "보고서 파일 생성됨"
  content=$(cat "$report")

  for section in "요약" "스캔 결과" "CSAP 통제항목" "조치 가이드" "감사 추적"; do
    if echo "$content" | grep -q "$section"; then
      assert_pass "섹션: $section"
    else
      assert_fail "섹션 누락: $section"
    fi
  done

  # 규칙 ID 표시
  for rule in "SECRET" "SQLI" "AUTH" "CRYPTO" "LOG"; do
    if echo "$content" | grep -q "$rule"; then
      assert_pass "규칙: $rule"
    else
      assert_fail "규칙 누락: $rule"
    fi
  done

  # CSAP 참조
  for csap in "D-06" "D-08" "D-09" "D-12"; do
    if echo "$content" | grep -q "$csap"; then
      assert_pass "CSAP: $csap"
    else
      assert_fail "CSAP 누락: $csap"
    fi
  done

  # 판정 유형
  for verdict in "PASS" "WARN" "FAIL"; do
    if echo "$content" | grep -q "$verdict"; then
      assert_pass "판정: $verdict"
    else
      assert_fail "판정 누락: $verdict"
    fi
  done
else
  assert_fail "보고서 파일 미생성"
fi

# 테스트 6: 특정 규칙 스캔
log_test "특정 규칙(SECRET) 스캔"
"$PROJECT_ROOT/scripts/security-compliance-scan.sh" --rule SECRET --output-dir "$TEST_OUTPUT_DIR" > /dev/null 2>&1
report2=$(ls "$TEST_OUTPUT_DIR"/security-scan-*.md 2>/dev/null | tail -1)
if [[ -n "$report2" && -f "$report2" ]]; then
  if grep -q "SECRET" "$report2"; then
    assert_pass "SECRET 규칙 결과 포함"
  else
    assert_fail "SECRET 규칙 미포함"
  fi
else
  assert_fail "특정 규칙 보고서 미생성"
fi

# 테스트 7: CSAP 참조
log_test "스크립트 CSAP 참조"
for csap in "D-08" "D-09" "D-12" "D-06"; do
  if grep -q "$csap" "$PROJECT_ROOT/scripts/security-compliance-scan.sh"; then
    assert_pass "스크립트에 $csap"
  else
    assert_fail "스크립트에 $csap 미포함"
  fi
done

# 테스트 8: 감사 로그
log_test "감사 로그 기록"
if grep -q "SECURITY_COMPLIANCE_SCAN" "$PROJECT_ROOT/.claude/audit.jsonl" 2>/dev/null; then
  assert_pass "감사 로그에 스캔 기록"
else
  assert_fail "감사 로그 기록 없음"
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  MTU-N131 보안 스캐너 E2E 테스트 결과${NC}"
echo -e "${CYAN}========================================${NC}"
echo -e "  전체: ${TOTAL}"
echo -e "  통과: ${GREEN}${PASS}${NC}"
echo -e "  실패: ${RED}${FAIL}${NC}"
if [[ $FAIL -eq 0 ]]; then
  echo -e "  결과: ${GREEN}모든 테스트 통과${NC}"
else
  echo -e "  결과: ${RED}${FAIL}개 테스트 실패${NC}"
fi
echo -e "${CYAN}========================================${NC}"
exit "$FAIL"
