#!/usr/bin/env bash
# =============================================================================
# MTU-N125: 알림 피로도 분석 E2E 테스트
# Plan SC: FR-N125.5
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
for f in "scripts/analyze-alert-fatigue.sh" "infra/monitoring/alert-fatigue-rules.yaml"; do
  if [[ -f "$PROJECT_ROOT/$f" ]]; then
    assert_pass "$f 존재"
  else
    assert_fail "$f 누락"
  fi
done

# 테스트 2: 스크립트 실행
log_test "스크립트 실행 확인"
if [[ -x "$PROJECT_ROOT/scripts/analyze-alert-fatigue.sh" ]]; then
  assert_pass "analyze-alert-fatigue.sh 실행 가능"
else
  assert_fail "실행 권한 없음"
fi

# 테스트 3: 도움말
log_test "도움말 출력"
help_output=$("$PROJECT_ROOT/scripts/analyze-alert-fatigue.sh" --help 2>&1 || true)
for opt in "period" "dry-run"; do
  if echo "$help_output" | grep -q "$opt"; then
    assert_pass "도움말에 --$opt"
  else
    assert_fail "도움말에 --$opt 미포함"
  fi
done

# 테스트 4: 잘못된 기간
log_test "잘못된 기간 검증"
if ! "$PROJECT_ROOT/scripts/analyze-alert-fatigue.sh" --period invalid 2>/dev/null; then
  assert_pass "잘못된 기간 시 오류"
else
  assert_fail "잘못된 기간인데 성공"
fi

# 테스트 5: 주간 보고서 dry-run
log_test "주간 보고서 dry-run 생성"
"$PROJECT_ROOT/scripts/analyze-alert-fatigue.sh" --period weekly --output-dir "$TEST_OUTPUT_DIR" --dry-run > /dev/null 2>&1

report=$(ls "$TEST_OUTPUT_DIR"/alert-fatigue-weekly-*.md 2>/dev/null | head -1)
if [[ -n "$report" && -f "$report" ]]; then
  assert_pass "보고서 파일 생성됨"
  content=$(cat "$report")
  for section in "요약" "심각도별" "카테고리별" "피로도 지표" "최적화 권장" "등급 기준" "감사 추적"; do
    if echo "$content" | grep -q "$section"; then
      assert_pass "섹션: $section"
    else
      assert_fail "섹션 누락: $section"
    fi
  done
  if echo "$content" | grep -q "SNR"; then
    assert_pass "SNR 지표 포함"
  else
    assert_fail "SNR 지표 미포함"
  fi
  if echo "$content" | grep -q "피로도 등급"; then
    assert_pass "피로도 등급 표시"
  else
    assert_fail "피로도 등급 미표시"
  fi
else
  assert_fail "보고서 파일 미생성"
fi

# 테스트 6: 월간 보고서 dry-run
log_test "월간 보고서 dry-run 생성"
"$PROJECT_ROOT/scripts/analyze-alert-fatigue.sh" --period monthly --output-dir "$TEST_OUTPUT_DIR" --dry-run > /dev/null 2>&1
monthly=$(ls "$TEST_OUTPUT_DIR"/alert-fatigue-monthly-*.md 2>/dev/null | head -1)
if [[ -n "$monthly" && -f "$monthly" ]]; then
  assert_pass "월간 보고서 생성됨"
else
  assert_fail "월간 보고서 미생성"
fi

# 테스트 7: Recording Rule 검증
log_test "Recording Rule 검증"
prom_rule="$PROJECT_ROOT/infra/monitoring/alert-fatigue-rules.yaml"
for metric in "alert_fatigue:active_total" "alert_fatigue:snr_ratio" "alert_fatigue:daily_firing_count" "alert_fatigue:repeated_alerts_count"; do
  if grep -q "$metric" "$prom_rule"; then
    assert_pass "Recording Rule: $metric"
  else
    assert_fail "Recording Rule 누락: $metric"
  fi
done

for alert in "AlertFatigueHigh" "AlertSNRLow"; do
  if grep -q "$alert" "$prom_rule"; then
    assert_pass "알림 규칙: $alert"
  else
    assert_fail "알림 규칙 누락: $alert"
  fi
done

if grep -q "apiVersion: monitoring.coreos.com/v1" "$prom_rule"; then
  assert_pass "유효한 API 버전"
else
  assert_fail "유효하지 않은 API 버전"
fi

# 테스트 8: CSAP D-06
log_test "CSAP D-06 참조"
if grep -q "D-06" "$prom_rule"; then
  assert_pass "Recording Rule에 D-06"
else
  assert_fail "D-06 참조 누락"
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  MTU-N125 알림 피로도 E2E 테스트 결과${NC}"
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
