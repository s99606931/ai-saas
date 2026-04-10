#!/usr/bin/env bash
# =============================================================================
# MTU-N128: 인시던트 타임라인 E2E 테스트
# Plan SC: FR-N128.5
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
if [[ -f "$PROJECT_ROOT/scripts/generate-incident-timeline.sh" ]]; then
  assert_pass "generate-incident-timeline.sh 존재"
else
  assert_fail "generate-incident-timeline.sh 누락"
fi

# 테스트 2: 실행 권한
log_test "스크립트 실행 권한"
if [[ -x "$PROJECT_ROOT/scripts/generate-incident-timeline.sh" ]]; then
  assert_pass "실행 가능"
else
  assert_fail "실행 권한 없음"
fi

# 테스트 3: 도움말
log_test "도움말 출력"
help_output=$("$PROJECT_ROOT/scripts/generate-incident-timeline.sh" --help 2>&1 || true)
for keyword in "incident-id" "severity" "dry-run" "add-event"; do
  if echo "$help_output" | grep -q "$keyword"; then
    assert_pass "도움말에 --$keyword"
  else
    assert_fail "도움말에 --$keyword 미포함"
  fi
done

# 테스트 4: 잘못된 심각도
log_test "잘못된 심각도 검증"
if ! "$PROJECT_ROOT/scripts/generate-incident-timeline.sh" --severity P5 --dry-run 2>/dev/null; then
  assert_pass "잘못된 심각도 시 오류"
else
  assert_fail "잘못된 심각도인데 성공"
fi

# 테스트 5: dry-run 타임라인 생성
log_test "dry-run 타임라인 생성"
"$PROJECT_ROOT/scripts/generate-incident-timeline.sh" \
  --dry-run \
  --incident-id "INC-TEST-001" \
  --severity P1 \
  --output-dir "$TEST_OUTPUT_DIR" > /dev/null 2>&1

report=$(ls "$TEST_OUTPUT_DIR"/timeline-INC-TEST-001.md 2>/dev/null | head -1)
if [[ -n "$report" && -f "$report" ]]; then
  assert_pass "타임라인 파일 생성됨"
  content=$(cat "$report")

  for section in "인시던트 요약" "이벤트 분포" "시간순 타임라인" "MTTR" "감사 추적"; do
    if echo "$content" | grep -q "$section"; then
      assert_pass "섹션: $section"
    else
      assert_fail "섹션 누락: $section"
    fi
  done

  # 인시던트 ID 표시
  if echo "$content" | grep -q "INC-TEST-001"; then
    assert_pass "인시던트 ID 표시"
  else
    assert_fail "인시던트 ID 미표시"
  fi

  # 심각도 표시
  if echo "$content" | grep -q "P1"; then
    assert_pass "심각도 P1 표시"
  else
    assert_fail "심각도 미표시"
  fi

  # 이벤트 유형 아이콘
  for icon in "경보" "조치" "배포" "커밋"; do
    if echo "$content" | grep -q "$icon"; then
      assert_pass "이벤트 유형: $icon"
    else
      assert_fail "이벤트 유형 누락: $icon"
    fi
  done

  # 교훈 섹션
  if echo "$content" | grep -q "교훈"; then
    assert_pass "교훈 섹션 포함"
  else
    assert_fail "교훈 섹션 미포함"
  fi

  # 소요 시간 표시
  if echo "$content" | grep -q "소요 시간"; then
    assert_pass "소요 시간 표시"
  else
    assert_fail "소요 시간 미표시"
  fi
else
  assert_fail "타임라인 파일 미생성"
fi

# 테스트 6: 수동 이벤트 추가
log_test "수동 이벤트 추가"
"$PROJECT_ROOT/scripts/generate-incident-timeline.sh" \
  --dry-run \
  --incident-id "INC-TEST-002" \
  --add-event "2026-04-10T10:00:00Z|긴급 회의 소집" \
  --output-dir "$TEST_OUTPUT_DIR" > /dev/null 2>&1

report2="$TEST_OUTPUT_DIR/timeline-INC-TEST-002.md"
if [[ -f "$report2" ]]; then
  if grep -q "긴급 회의 소집" "$report2"; then
    assert_pass "수동 이벤트 타임라인에 포함"
  else
    assert_fail "수동 이벤트 미포함"
  fi
  if grep -q "수동" "$report2"; then
    assert_pass "수동 이벤트 유형 표시"
  else
    assert_fail "수동 이벤트 유형 미표시"
  fi
else
  assert_fail "수동 이벤트 타임라인 미생성"
fi

# 테스트 7: CSAP D-06 참조
log_test "CSAP D-06 참조"
if grep -q "D-06" "$PROJECT_ROOT/scripts/generate-incident-timeline.sh"; then
  assert_pass "스크립트에 D-06"
else
  assert_fail "D-06 참조 누락"
fi

# 테스트 8: 감사 로그
log_test "감사 로그 기록"
if grep -q "INCIDENT_TIMELINE" "$PROJECT_ROOT/.claude/audit.jsonl" 2>/dev/null; then
  assert_pass "감사 로그에 타임라인 기록"
else
  assert_fail "감사 로그 기록 없음"
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  MTU-N128 인시던트 타임라인 E2E 결과${NC}"
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
