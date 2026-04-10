#!/usr/bin/env bash
# =============================================================================
# MTU-N130: 기술 부채 대시보드 E2E 테스트
# Plan SC: FR-N130.5
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
if [[ -f "$PROJECT_ROOT/scripts/tech-debt-dashboard.sh" ]]; then
  assert_pass "tech-debt-dashboard.sh 존재"
else
  assert_fail "tech-debt-dashboard.sh 누락"
fi

# 테스트 2: 실행 권한
log_test "실행 권한 확인"
if [[ -x "$PROJECT_ROOT/scripts/tech-debt-dashboard.sh" ]]; then
  assert_pass "실행 가능"
else
  assert_fail "실행 권한 없음"
fi

# 테스트 3: 도움말
log_test "도움말 출력"
help_output=$("$PROJECT_ROOT/scripts/tech-debt-dashboard.sh" --help 2>&1 || true)
for keyword in "category" "code" "dependency" "documentation" "test"; do
  if echo "$help_output" | grep -q "$keyword"; then
    assert_pass "도움말에 $keyword"
  else
    assert_fail "도움말에 $keyword 미포함"
  fi
done

# 테스트 4: 유효하지 않은 카테고리
log_test "유효하지 않은 카테고리 검증"
if ! "$PROJECT_ROOT/scripts/tech-debt-dashboard.sh" --category invalid 2>/dev/null; then
  assert_pass "잘못된 카테고리 시 오류"
else
  assert_fail "잘못된 카테고리인데 성공"
fi

# 테스트 5: 전체 분석 보고서
log_test "전체 분석 보고서 생성"
"$PROJECT_ROOT/scripts/tech-debt-dashboard.sh" --output-dir "$TEST_OUTPUT_DIR" > /dev/null 2>&1

report=$(ls "$TEST_OUTPUT_DIR"/tech-debt-*.md 2>/dev/null | head -1)
if [[ -n "$report" && -f "$report" ]]; then
  assert_pass "보고서 파일 생성됨"
  content=$(cat "$report")

  for section in "요약" "카테고리별 부채" "등급 기준" "상세 분석" "리팩토링 권장" "감사 추적"; do
    if echo "$content" | grep -q "$section"; then
      assert_pass "섹션: $section"
    else
      assert_fail "섹션 누락: $section"
    fi
  done

  # 4개 카테고리
  for cat in "코드 부채" "의존성 부채" "문서 부채" "테스트 부채"; do
    if echo "$content" | grep -q "$cat"; then
      assert_pass "카테고리: $cat"
    else
      assert_fail "카테고리 누락: $cat"
    fi
  done

  # 종합 점수
  if echo "$content" | grep -q "종합 점수"; then
    assert_pass "종합 점수 표시"
  else
    assert_fail "종합 점수 미표시"
  fi

  # 등급 표시
  if echo "$content" | grep -qE "[ABCDF] \("; then
    assert_pass "등급 표시"
  else
    assert_fail "등급 미표시"
  fi

  # 가중치 표시
  if echo "$content" | grep -q "가중치"; then
    assert_pass "가중치 표시"
  else
    assert_fail "가중치 미표시"
  fi
else
  assert_fail "보고서 파일 미생성"
fi

# 테스트 6: 특정 카테고리 분석
log_test "특정 카테고리(code) 분석"
"$PROJECT_ROOT/scripts/tech-debt-dashboard.sh" --category code --output-dir "$TEST_OUTPUT_DIR" > /dev/null 2>&1
report2=$(ls "$TEST_OUTPUT_DIR"/tech-debt-*.md 2>/dev/null | tail -1)
if [[ -n "$report2" && -f "$report2" ]]; then
  content2=$(cat "$report2")
  if echo "$content2" | grep -q "코드 부채"; then
    assert_pass "코드 부채 카테고리 포함"
  else
    assert_fail "코드 부채 미포함"
  fi
else
  assert_fail "카테고리 보고서 미생성"
fi

# 테스트 7: CSAP D-12 참조
log_test "CSAP D-12 참조"
if grep -q "D-12" "$PROJECT_ROOT/scripts/tech-debt-dashboard.sh"; then
  assert_pass "스크립트에 D-12"
else
  assert_fail "D-12 참조 누락"
fi

# 테스트 8: 감사 로그
log_test "감사 로그 기록"
if grep -q "TECH_DEBT_ANALYSIS" "$PROJECT_ROOT/.claude/audit.jsonl" 2>/dev/null; then
  assert_pass "감사 로그에 분석 기록"
else
  assert_fail "감사 로그 기록 없음"
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  MTU-N130 기술 부채 대시보드 E2E 결과${NC}"
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
