#!/usr/bin/env bash
# =============================================================================
# MTU-N121: SLO 에러 예산 자동 리포팅 E2E 테스트
# Design Ref: MTU-N121 Design
# Plan SC: FR-N121.6
# CSAP: D-06(침해사고 관리 -- SLO 리포팅 검증)
#
# 사용법: ./scripts/test-slo-report.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0
TOTAL=0
TEST_OUTPUT_DIR=$(mktemp -d)

cleanup() {
  rm -rf "$TEST_OUTPUT_DIR"
}
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

# ---------------------------------------------------------------------------
# 테스트 1: 스크립트 실행 권한 확인
# ---------------------------------------------------------------------------
log_test "스크립트 실행 가능 확인"

if [[ -x "$PROJECT_ROOT/scripts/generate-slo-report.sh" ]]; then
  assert_pass "generate-slo-report.sh 실행 가능"
else
  assert_fail "generate-slo-report.sh 실행 권한 없음"
fi

# ---------------------------------------------------------------------------
# 테스트 2: 도움말 출력
# ---------------------------------------------------------------------------
log_test "도움말 출력 테스트"

help_output=$("$PROJECT_ROOT/scripts/generate-slo-report.sh" --help 2>&1 || true)

if echo "$help_output" | grep -q "period"; then
  assert_pass "도움말에 --period 포함"
else
  assert_fail "도움말에 --period 미포함"
fi

if echo "$help_output" | grep -q "dry-run"; then
  assert_pass "도움말에 --dry-run 포함"
else
  assert_fail "도움말에 --dry-run 미포함"
fi

# ---------------------------------------------------------------------------
# 테스트 3: 잘못된 기간 입력 검증
# ---------------------------------------------------------------------------
log_test "잘못된 기간 입력 검증"

if ! "$PROJECT_ROOT/scripts/generate-slo-report.sh" --period invalid 2>/dev/null; then
  assert_pass "잘못된 기간 시 오류 반환"
else
  assert_fail "잘못된 기간인데 성공으로 반환"
fi

# ---------------------------------------------------------------------------
# 테스트 4: 주간 보고서 dry-run 생성
# ---------------------------------------------------------------------------
log_test "주간 보고서 dry-run 생성"

"$PROJECT_ROOT/scripts/generate-slo-report.sh" \
  --period weekly \
  --output-dir "$TEST_OUTPUT_DIR" \
  --dry-run > /dev/null 2>&1

weekly_report=$(ls "$TEST_OUTPUT_DIR"/slo-report-weekly-*.md 2>/dev/null | head -1)

if [[ -n "$weekly_report" && -f "$weekly_report" ]]; then
  assert_pass "주간 보고서 파일 생성됨"

  content=$(cat "$weekly_report")

  # 필수 섹션 확인
  if echo "$content" | grep -q "요약"; then
    assert_pass "섹션 1: 요약 포함"
  else
    assert_fail "섹션 1: 요약 누락"
  fi

  if echo "$content" | grep -q "SLO 달성 현황"; then
    assert_pass "섹션 2: SLO 달성 현황 포함"
  else
    assert_fail "섹션 2: SLO 달성 현황 누락"
  fi

  if echo "$content" | grep -q "Burn Rate"; then
    assert_pass "섹션 3: Burn Rate 분석 포함"
  else
    assert_fail "섹션 3: Burn Rate 분석 누락"
  fi

  if echo "$content" | grep -q "MTTR"; then
    assert_pass "섹션 5: MTTR 통계 포함"
  else
    assert_fail "섹션 5: MTTR 통계 누락"
  fi

  if echo "$content" | grep -q "권장 조치"; then
    assert_pass "섹션 6: 권장 조치 포함"
  else
    assert_fail "섹션 6: 권장 조치 누락"
  fi

  if echo "$content" | grep -q "감사 추적"; then
    assert_pass "섹션 7: 감사 추적 포함"
  else
    assert_fail "섹션 7: 감사 추적 누락"
  fi

  # 서비스별 SLI 테이블 확인
  if echo "$content" | grep -q "api-gateway"; then
    assert_pass "api-gateway 서비스 포함"
  else
    assert_fail "api-gateway 서비스 누락"
  fi

  if echo "$content" | grep -q "auth-service"; then
    assert_pass "auth-service 서비스 포함"
  else
    assert_fail "auth-service 서비스 누락"
  fi

  if echo "$content" | grep -q "달성률"; then
    assert_pass "전체 달성률 포함"
  else
    assert_fail "전체 달성률 누락"
  fi
else
  assert_fail "주간 보고서 파일 미생성"
fi

# ---------------------------------------------------------------------------
# 테스트 5: 월간 보고서 dry-run 생성
# ---------------------------------------------------------------------------
log_test "월간 보고서 dry-run 생성"

"$PROJECT_ROOT/scripts/generate-slo-report.sh" \
  --period monthly \
  --output-dir "$TEST_OUTPUT_DIR" \
  --dry-run > /dev/null 2>&1

monthly_report=$(ls "$TEST_OUTPUT_DIR"/slo-report-monthly-*.md 2>/dev/null | head -1)

if [[ -n "$monthly_report" && -f "$monthly_report" ]]; then
  assert_pass "월간 보고서 파일 생성됨"

  content=$(cat "$monthly_report")

  if echo "$content" | grep -q "30"; then
    assert_pass "30일 기간 표시"
  else
    assert_fail "30일 기간 미표시"
  fi
else
  assert_fail "월간 보고서 파일 미생성"
fi

# ---------------------------------------------------------------------------
# 테스트 6: PrometheusRule 파일 검증
# ---------------------------------------------------------------------------
log_test "Recording Rule 파일 검증"

prom_rule="$PROJECT_ROOT/infra/monitoring/slo-reporting-rules.yaml"

if [[ -f "$prom_rule" ]]; then
  assert_pass "slo-reporting-rules.yaml 존재"

  if grep -q "slo:report:daily_error_rate" "$prom_rule"; then
    assert_pass "일간 에러율 Recording Rule 정의"
  else
    assert_fail "일간 에러율 Recording Rule 미정의"
  fi

  if grep -q "slo:report:weekly_error_rate" "$prom_rule"; then
    assert_pass "주간 에러율 Recording Rule 정의"
  else
    assert_fail "주간 에러율 Recording Rule 미정의"
  fi

  if grep -q "slo:report:daily_availability" "$prom_rule"; then
    assert_pass "일간 가용성 Recording Rule 정의"
  else
    assert_fail "일간 가용성 Recording Rule 미정의"
  fi

  if grep -q "slo:report:mttr_p1_avg_7d" "$prom_rule"; then
    assert_pass "MTTR P1 Recording Rule 정의"
  else
    assert_fail "MTTR P1 Recording Rule 미정의"
  fi

  if grep -q "slo:report:budget_exhaustion_days" "$prom_rule"; then
    assert_pass "에러 예산 소진 예측 Recording Rule 정의"
  else
    assert_fail "에러 예산 소진 예측 Recording Rule 미정의"
  fi

  if grep -q "slo:report:budget_burn_per_hour" "$prom_rule"; then
    assert_pass "시간당 소진 속도 Recording Rule 정의"
  else
    assert_fail "시간당 소진 속도 Recording Rule 미정의"
  fi

  if grep -q "SLOWeeklyReportDue" "$prom_rule"; then
    assert_pass "주간 보고서 생성 알림 정의"
  else
    assert_fail "주간 보고서 생성 알림 미정의"
  fi

  if grep -q "SLOMonthlyReportDue" "$prom_rule"; then
    assert_pass "월간 보고서 생성 알림 정의"
  else
    assert_fail "월간 보고서 생성 알림 미정의"
  fi

  if grep -q "apiVersion: monitoring.coreos.com/v1" "$prom_rule"; then
    assert_pass "유효한 PrometheusRule API 버전"
  else
    assert_fail "유효하지 않은 PrometheusRule API 버전"
  fi
else
  assert_fail "slo-reporting-rules.yaml 누락"
fi

# ---------------------------------------------------------------------------
# 테스트 7: CSAP D-06 감사 추적 확인
# ---------------------------------------------------------------------------
log_test "CSAP D-06 감사 추적 확인"

if grep -q "D-06" "$PROJECT_ROOT/infra/monitoring/slo-reporting-rules.yaml"; then
  assert_pass "Recording Rule에 D-06 참조"
else
  assert_fail "Recording Rule에 D-06 참조 누락"
fi

# ---------------------------------------------------------------------------
# 테스트 8: Burn Rate 해석 기준 포함 확인
# ---------------------------------------------------------------------------
log_test "Burn Rate 해석 기준 포함 확인"

if [[ -n "$weekly_report" && -f "$weekly_report" ]]; then
  content=$(cat "$weekly_report")

  if echo "$content" | grep -q "Burn Rate 해석 기준"; then
    assert_pass "Burn Rate 해석 기준 테이블 포함"
  else
    assert_fail "Burn Rate 해석 기준 테이블 누락"
  fi
else
  assert_fail "주간 보고서가 없어 확인 불가"
fi

# ---------------------------------------------------------------------------
# 결과 요약
# ---------------------------------------------------------------------------
echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  MTU-N121 SLO 에러 예산 리포팅 E2E 테스트 결과${NC}"
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
