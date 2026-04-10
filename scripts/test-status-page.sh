#!/usr/bin/env bash
# =============================================================================
# MTU-N124: 플랫폼 상태 페이지 E2E 테스트
# Plan SC: FR-N124.5
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

# ---------------------------------------------------------------------------
# 테스트 1: 산출물 존재
# ---------------------------------------------------------------------------
log_test "산출물 존재 확인"

files=(
  "scripts/generate-status-page.sh"
  "infra/monitoring/status-page-rules.yaml"
)

for f in "${files[@]}"; do
  if [[ -f "$PROJECT_ROOT/$f" ]]; then
    assert_pass "$f 존재"
  else
    assert_fail "$f 누락"
  fi
done

# ---------------------------------------------------------------------------
# 테스트 2: 스크립트 실행
# ---------------------------------------------------------------------------
log_test "스크립트 실행 확인"

if [[ -x "$PROJECT_ROOT/scripts/generate-status-page.sh" ]]; then
  assert_pass "generate-status-page.sh 실행 가능"
else
  assert_fail "generate-status-page.sh 실행 권한 없음"
fi

# ---------------------------------------------------------------------------
# 테스트 3: 도움말
# ---------------------------------------------------------------------------
log_test "도움말 출력"

help_output=$("$PROJECT_ROOT/scripts/generate-status-page.sh" --help 2>&1 || true)

for opt in "dry-run" "maintenance" "output-dir"; do
  if echo "$help_output" | grep -q "$opt"; then
    assert_pass "도움말에 --$opt 포함"
  else
    assert_fail "도움말에 --$opt 미포함"
  fi
done

# ---------------------------------------------------------------------------
# 테스트 4: 상태 페이지 dry-run 생성
# ---------------------------------------------------------------------------
log_test "상태 페이지 dry-run 생성"

"$PROJECT_ROOT/scripts/generate-status-page.sh" \
  --dry-run \
  --output-dir "$TEST_OUTPUT_DIR" > /dev/null 2>&1

if [[ -f "$TEST_OUTPUT_DIR/index.md" ]]; then
  assert_pass "상태 페이지 파일 생성됨"

  content=$(cat "$TEST_OUTPUT_DIR/index.md")

  sections=("현재 상태" "서비스별 상태" "인시던트 히스토리" "상태 정의")
  for section in "${sections[@]}"; do
    if echo "$content" | grep -q "$section"; then
      assert_pass "섹션: $section"
    else
      assert_fail "섹션 누락: $section"
    fi
  done

  # 서비스 표시 확인
  services=("API 게이트웨이" "인증" "테넌트" "데이터베이스")
  for svc in "${services[@]}"; do
    if echo "$content" | grep -q "$svc"; then
      assert_pass "서비스 표시: $svc"
    else
      assert_fail "서비스 미표시: $svc"
    fi
  done

  # 계층 표시
  tiers=("Gateway" "Core" "Data")
  for tier in "${tiers[@]}"; do
    if echo "$content" | grep -q "$tier"; then
      assert_pass "계층 표시: $tier"
    else
      assert_fail "계층 미표시: $tier"
    fi
  done

  # 상태 아이콘
  if echo "$content" | grep -qE "\[정상\]|\[저하\]|\[장애\]"; then
    assert_pass "상태 아이콘 표시"
  else
    assert_fail "상태 아이콘 미표시"
  fi
else
  assert_fail "상태 페이지 파일 미생성"
fi

# ---------------------------------------------------------------------------
# 테스트 5: 인시던트 히스토리 파일 생성
# ---------------------------------------------------------------------------
log_test "인시던트 히스토리 파일 생성"

if [[ -f "$TEST_OUTPUT_DIR/incident-history.md" ]]; then
  assert_pass "인시던트 히스토리 파일 생성됨"

  if grep -q "인시던트 히스토리" "$TEST_OUTPUT_DIR/incident-history.md"; then
    assert_pass "인시던트 히스토리 헤더"
  else
    assert_fail "인시던트 히스토리 헤더 누락"
  fi
else
  assert_fail "인시던트 히스토리 파일 미생성"
fi

# ---------------------------------------------------------------------------
# 테스트 6: 유지보수 공지 추가
# ---------------------------------------------------------------------------
log_test "유지보수 공지 추가"

"$PROJECT_ROOT/scripts/generate-status-page.sh" \
  --dry-run \
  --output-dir "$TEST_OUTPUT_DIR" \
  --maintenance "데이터베이스 업그레이드" \
  --maintenance-start "2026-04-15T02:00:00+09:00" \
  --maintenance-end "2026-04-15T06:00:00+09:00" > /dev/null 2>&1

content=$(cat "$TEST_OUTPUT_DIR/index.md")

if echo "$content" | grep -q "유지보수"; then
  assert_pass "유지보수 공지 표시"
else
  assert_fail "유지보수 공지 미표시"
fi

if echo "$content" | grep -q "데이터베이스 업그레이드"; then
  assert_pass "유지보수 내용 표시"
else
  assert_fail "유지보수 내용 미표시"
fi

# ---------------------------------------------------------------------------
# 테스트 7: PrometheusRule 검증
# ---------------------------------------------------------------------------
log_test "PrometheusRule 검증"

prom_rule="$PROJECT_ROOT/infra/monitoring/status-page-rules.yaml"

if grep -q "status_page:service_availability" "$prom_rule"; then
  assert_pass "서비스 가용성 Recording Rule"
else
  assert_fail "서비스 가용성 Recording Rule 누락"
fi

if grep -q "status_page:active_incidents" "$prom_rule"; then
  assert_pass "활성 인시던트 Recording Rule"
else
  assert_fail "활성 인시던트 Recording Rule 누락"
fi

if grep -q "StatusPageUpdateRequired" "$prom_rule"; then
  assert_pass "상태 페이지 갱신 알림"
else
  assert_fail "상태 페이지 갱신 알림 누락"
fi

if grep -q "apiVersion: monitoring.coreos.com/v1" "$prom_rule"; then
  assert_pass "유효한 PrometheusRule API 버전"
else
  assert_fail "유효하지 않은 PrometheusRule API 버전"
fi

# ---------------------------------------------------------------------------
# 테스트 8: CSAP D-06 참조
# ---------------------------------------------------------------------------
log_test "CSAP D-06 참조"

if grep -q "D-06" "$prom_rule"; then
  assert_pass "PrometheusRule에 D-06 참조"
else
  assert_fail "PrometheusRule에 D-06 참조 누락"
fi

# ---------------------------------------------------------------------------
# 결과 요약
# ---------------------------------------------------------------------------
echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  MTU-N124 상태 페이지 E2E 테스트 결과${NC}"
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
