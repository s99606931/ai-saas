#!/usr/bin/env bash
# =============================================================================
# MTU-N127: SRE 성숙도 자가 평가 E2E 테스트
# Plan SC: FR-N127.5
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
if [[ -f "$PROJECT_ROOT/scripts/sre-maturity-assess.sh" ]]; then
  assert_pass "sre-maturity-assess.sh 존재"
else
  assert_fail "sre-maturity-assess.sh 누락"
fi

# 테스트 2: 실행 권한
log_test "스크립트 실행 권한 확인"
if [[ -x "$PROJECT_ROOT/scripts/sre-maturity-assess.sh" ]]; then
  assert_pass "실행 가능"
else
  assert_fail "실행 권한 없음"
fi

# 테스트 3: 도움말
log_test "도움말 출력"
help_output=$("$PROJECT_ROOT/scripts/sre-maturity-assess.sh" --help 2>&1 || true)
for keyword in "domain" "monitoring" "incident" "slo" "automation" "capacity" "security" "deployment" "documentation"; do
  if echo "$help_output" | grep -q "$keyword"; then
    assert_pass "도움말에 $keyword"
  else
    assert_fail "도움말에 $keyword 미포함"
  fi
done

# 테스트 4: 유효하지 않은 영역
log_test "유효하지 않은 영역 검증"
if ! "$PROJECT_ROOT/scripts/sre-maturity-assess.sh" --domain invalid 2>/dev/null; then
  assert_pass "잘못된 영역 시 오류"
else
  assert_fail "잘못된 영역인데 성공"
fi

# 테스트 5: 전체 평가 보고서
log_test "전체 평가 보고서 생성"
"$PROJECT_ROOT/scripts/sre-maturity-assess.sh" --output-dir "$TEST_OUTPUT_DIR" > /dev/null 2>&1

report=$(ls "$TEST_OUTPUT_DIR"/sre-maturity-*.md 2>/dev/null | head -1)
if [[ -n "$report" && -f "$report" ]]; then
  assert_pass "보고서 파일 생성됨"
  content=$(cat "$report")

  for section in "요약" "영역별 성숙도" "등급 기준" "상세 분석" "감사 추적"; do
    if echo "$content" | grep -q "$section"; then
      assert_pass "섹션: $section"
    else
      assert_fail "섹션 누락: $section"
    fi
  done

  # 8개 영역 이름
  for domain in "모니터링" "인시던트 관리" "SLO" "자동화" "용량 계획" "보안" "배포" "문서화"; do
    if echo "$content" | grep -q "$domain"; then
      assert_pass "영역: $domain"
    else
      assert_fail "영역 누락: $domain"
    fi
  done

  # 등급 표시
  if echo "$content" | grep -q "L[1-5]"; then
    assert_pass "등급 표시 (L1~L5)"
  else
    assert_fail "등급 미표시"
  fi

  # 종합 성숙도
  if echo "$content" | grep -q "종합 성숙도"; then
    assert_pass "종합 성숙도 표시"
  else
    assert_fail "종합 성숙도 미표시"
  fi

  # 권장 사항
  if echo "$content" | grep -q "권장"; then
    assert_pass "개선 권장 사항 포함"
  else
    assert_fail "개선 권장 사항 미포함"
  fi

  # 점수 표시
  if echo "$content" | grep -q "/5"; then
    assert_pass "점수 표시 (x/5)"
  else
    assert_fail "점수 미표시"
  fi
else
  assert_fail "보고서 파일 미생성"
fi

# 테스트 6: 특정 영역 평가
log_test "특정 영역(monitoring) 평가"
"$PROJECT_ROOT/scripts/sre-maturity-assess.sh" --domain monitoring --output-dir "$TEST_OUTPUT_DIR" > /dev/null 2>&1
report2=$(ls "$TEST_OUTPUT_DIR"/sre-maturity-*.md 2>/dev/null | tail -1)
if [[ -n "$report2" && -f "$report2" ]]; then
  content2=$(cat "$report2")
  if echo "$content2" | grep -q "모니터링"; then
    assert_pass "모니터링 영역 포함"
  else
    assert_fail "모니터링 영역 미포함"
  fi
  # 특정 영역만 평가 시 1개 영역만 나와야 함
  if echo "$content2" | grep -q "평가 영역: 1개"; then
    assert_pass "단일 영역 평가"
  else
    assert_fail "단일 영역 아닌 결과"
  fi
else
  assert_fail "특정 영역 보고서 미생성"
fi

# 테스트 7: CSAP D-06 참조
log_test "CSAP D-06 참조"
if grep -q "D-06" "$PROJECT_ROOT/scripts/sre-maturity-assess.sh"; then
  assert_pass "스크립트에 D-06 참조"
else
  assert_fail "D-06 참조 누락"
fi

# 테스트 8: 감사 로그 생성
log_test "감사 로그 생성"
if grep -q "SRE_MATURITY_ASSESS" "$PROJECT_ROOT/.claude/audit.jsonl" 2>/dev/null; then
  assert_pass "감사 로그에 평가 기록"
else
  assert_fail "감사 로그 기록 없음"
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  MTU-N127 SRE 성숙도 E2E 테스트 결과${NC}"
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
