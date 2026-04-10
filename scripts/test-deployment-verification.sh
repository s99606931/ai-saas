#!/usr/bin/env bash
# =============================================================================
# MTU-N129: 배포 검증 E2E 테스트
# Plan SC: FR-N129.5
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
if [[ -f "$PROJECT_ROOT/scripts/verify-deployment.sh" ]]; then
  assert_pass "verify-deployment.sh 존재"
else
  assert_fail "verify-deployment.sh 누락"
fi

# 테스트 2: 실행 권한
log_test "실행 권한 확인"
if [[ -x "$PROJECT_ROOT/scripts/verify-deployment.sh" ]]; then
  assert_pass "실행 가능"
else
  assert_fail "실행 권한 없음"
fi

# 테스트 3: 도움말
log_test "도움말 출력"
help_output=$("$PROJECT_ROOT/scripts/verify-deployment.sh" --help 2>&1 || true)
for keyword in "service" "namespace" "dry-run" "error-threshold" "latency-threshold"; do
  if echo "$help_output" | grep -q "$keyword"; then
    assert_pass "도움말에 --$keyword"
  else
    assert_fail "도움말에 --$keyword 미포함"
  fi
done

# 테스트 4: 서비스 미지정 오류
log_test "서비스 미지정 오류"
if ! "$PROJECT_ROOT/scripts/verify-deployment.sh" 2>/dev/null; then
  assert_pass "서비스 미지정 시 오류"
else
  assert_fail "서비스 미지정인데 성공"
fi

# 테스트 5: dry-run 단일 서비스
log_test "dry-run 단일 서비스 검증"
"$PROJECT_ROOT/scripts/verify-deployment.sh" \
  --service api-gateway \
  --dry-run \
  --output-dir "$TEST_OUTPUT_DIR" > /dev/null 2>&1 || true

report=$(ls "$TEST_OUTPUT_DIR"/verify-*.md 2>/dev/null | head -1)
if [[ -n "$report" && -f "$report" ]]; then
  assert_pass "보고서 파일 생성됨"
  content=$(cat "$report")

  for section in "요약" "서비스별 검증 결과" "검증 기준" "서비스별 상세" "롤백 판단" "감사 추적"; do
    if echo "$content" | grep -q "$section"; then
      assert_pass "섹션: $section"
    else
      assert_fail "섹션 누락: $section"
    fi
  done

  # 검증 항목
  for item in "Pod" "Health" "Error" "Latency" "Resource"; do
    if echo "$content" | grep -q "$item"; then
      assert_pass "검증 항목: $item"
    else
      assert_fail "검증 항목 누락: $item"
    fi
  done

  # 판정 유형
  for verdict in "HEALTHY" "INVESTIGATE" "ROLLBACK"; do
    if echo "$content" | grep -q "$verdict"; then
      assert_pass "판정 유형: $verdict"
    else
      assert_fail "판정 유형 누락: $verdict"
    fi
  done

  # 서비스 이름
  if echo "$content" | grep -q "api-gateway"; then
    assert_pass "서비스명 표시"
  else
    assert_fail "서비스명 미표시"
  fi
else
  assert_fail "보고서 파일 미생성"
fi

# 테스트 6: dry-run 전체 서비스
log_test "dry-run 전체 서비스 검증"
"$PROJECT_ROOT/scripts/verify-deployment.sh" \
  --all \
  --dry-run \
  --output-dir "$TEST_OUTPUT_DIR" > /dev/null 2>&1 || true

report2=$(ls "$TEST_OUTPUT_DIR"/verify-*.md 2>/dev/null | tail -1)
if [[ -n "$report2" && -f "$report2" ]]; then
  content2=$(cat "$report2")
  svc_count=0
  for svc in "api-gateway" "auth-service" "tenant-service"; do
    if echo "$content2" | grep -q "$svc"; then
      svc_count=$((svc_count + 1))
    fi
  done
  if [[ "$svc_count" -ge 3 ]]; then
    assert_pass "복수 서비스 검증됨 (${svc_count}개)"
  else
    assert_fail "복수 서비스 미검증 (${svc_count}개)"
  fi
else
  assert_fail "전체 서비스 보고서 미생성"
fi

# 테스트 7: CSAP D-06 참조
log_test "CSAP D-06 참조"
if grep -q "D-06" "$PROJECT_ROOT/scripts/verify-deployment.sh"; then
  assert_pass "스크립트에 D-06"
else
  assert_fail "D-06 참조 누락"
fi

# 테스트 8: 감사 로그
log_test "감사 로그 기록"
if grep -q "DEPLOYMENT_VERIFY" "$PROJECT_ROOT/.claude/audit.jsonl" 2>/dev/null; then
  assert_pass "감사 로그에 검증 기록"
else
  assert_fail "감사 로그 기록 없음"
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  MTU-N129 배포 검증 E2E 테스트 결과${NC}"
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
