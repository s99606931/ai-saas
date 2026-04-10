#!/usr/bin/env bash
# =============================================================================
# MTU-N122: 온콜 로테이션 및 에스컬레이션 E2E 테스트
# Design Ref: MTU-N122 Design
# Plan SC: FR-N122.6
# CSAP: D-06(침해사고 관리 -- 온콜 시스템 검증)
#
# 사용법: ./scripts/test-oncall-escalation.sh
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
# 테스트 1: 문서 산출물 존재 확인
# ---------------------------------------------------------------------------
log_test "문서 산출물 존재 확인"

docs=(
  "infra/monitoring/oncall-schedule.yaml"
  "docs/operations/escalation-policy.md"
  "docs/operations/oncall-handoff-checklist.md"
)

for doc in "${docs[@]}"; do
  if [[ -f "$PROJECT_ROOT/$doc" ]]; then
    assert_pass "$doc 존재"
  else
    assert_fail "$doc 누락"
  fi
done

# ---------------------------------------------------------------------------
# 테스트 2: 스크립트 실행 확인
# ---------------------------------------------------------------------------
log_test "oncall-status.sh 실행 확인"

if [[ -x "$PROJECT_ROOT/scripts/oncall-status.sh" ]]; then
  assert_pass "oncall-status.sh 실행 가능"
else
  assert_fail "oncall-status.sh 실행 권한 없음"
fi

# ---------------------------------------------------------------------------
# 테스트 3: 도움말 출력
# ---------------------------------------------------------------------------
log_test "도움말 출력 테스트"

help_output=$("$PROJECT_ROOT/scripts/oncall-status.sh" --help 2>&1 || true)

if echo "$help_output" | grep -q "team"; then
  assert_pass "도움말에 --team 포함"
else
  assert_fail "도움말에 --team 미포함"
fi

if echo "$help_output" | grep -q "escalation"; then
  assert_pass "도움말에 --escalation 포함"
else
  assert_fail "도움말에 --escalation 미포함"
fi

# ---------------------------------------------------------------------------
# 테스트 4: 현재 온콜 현황 조회
# ---------------------------------------------------------------------------
log_test "현재 온콜 현황 조회"

status_output=$("$PROJECT_ROOT/scripts/oncall-status.sh" 2>&1)

if echo "$status_output" | grep -q "온콜 현황"; then
  assert_pass "온콜 현황 헤더 표시"
else
  assert_fail "온콜 현황 헤더 미표시"
fi

teams=("SRE팀" "보안팀" "DevOps팀" "DBA팀" "인프라팀")
for team in "${teams[@]}"; do
  if echo "$status_output" | grep -q "$team"; then
    assert_pass "팀 표시: $team"
  else
    assert_fail "팀 미표시: $team"
  fi
done

# ---------------------------------------------------------------------------
# 테스트 5: 특정 팀 온콜 조회
# ---------------------------------------------------------------------------
log_test "특정 팀 온콜 조회 (SRE)"

sre_output=$("$PROJECT_ROOT/scripts/oncall-status.sh" --team sre 2>&1)

if echo "$sre_output" | grep -q "SRE팀"; then
  assert_pass "SRE팀 단독 조회 성공"
else
  assert_fail "SRE팀 단독 조회 실패"
fi

# ---------------------------------------------------------------------------
# 테스트 6: 다음 주 온콜 예정자 조회
# ---------------------------------------------------------------------------
log_test "다음 주 온콜 예정자 조회"

next_output=$("$PROJECT_ROOT/scripts/oncall-status.sh" --next 2>&1)

if echo "$next_output" | grep -q "다음 주"; then
  assert_pass "다음 주 온콜 헤더 표시"
else
  assert_fail "다음 주 온콜 헤더 미표시"
fi

if echo "$next_output" | grep -q "현재"; then
  assert_pass "현재/다음 주 비교 표시"
else
  assert_fail "현재/다음 주 비교 미표시"
fi

# ---------------------------------------------------------------------------
# 테스트 7: 에스컬레이션 정책 조회
# ---------------------------------------------------------------------------
log_test "에스컬레이션 정책 조회"

esc_output=$("$PROJECT_ROOT/scripts/oncall-status.sh" --escalation 2>&1)

if echo "$esc_output" | grep -q "에스컬레이션 정책"; then
  assert_pass "에스컬레이션 정책 헤더"
else
  assert_fail "에스컬레이션 정책 헤더 미표시"
fi

for p in "P1" "P2" "P3" "P4"; do
  if echo "$esc_output" | grep -q "$p"; then
    assert_pass "심각도 $p 정책 표시"
  else
    assert_fail "심각도 $p 정책 미표시"
  fi
done

# ---------------------------------------------------------------------------
# 테스트 8: ConfigMap 유효성 검증
# ---------------------------------------------------------------------------
log_test "ConfigMap 유효성 검증"

config="$PROJECT_ROOT/infra/monitoring/oncall-schedule.yaml"

if grep -q "apiVersion: v1" "$config"; then
  assert_pass "유효한 ConfigMap API 버전"
else
  assert_fail "유효하지 않은 ConfigMap API 버전"
fi

if grep -q "kind: ConfigMap" "$config"; then
  assert_pass "kind: ConfigMap 올바름"
else
  assert_fail "kind: ConfigMap 누락"
fi

if grep -q "schedule.yaml" "$config"; then
  assert_pass "schedule.yaml 데이터 키 존재"
else
  assert_fail "schedule.yaml 데이터 키 누락"
fi

if grep -q "escalation-policy.yaml" "$config"; then
  assert_pass "escalation-policy.yaml 데이터 키 존재"
else
  assert_fail "escalation-policy.yaml 데이터 키 누락"
fi

if grep -q "current-oncall.yaml" "$config"; then
  assert_pass "current-oncall.yaml 데이터 키 존재"
else
  assert_fail "current-oncall.yaml 데이터 키 누락"
fi

# ---------------------------------------------------------------------------
# 테스트 9: 에스컬레이션 정책 문서 필수 섹션
# ---------------------------------------------------------------------------
log_test "에스컬레이션 정책 문서 필수 섹션"

esc_doc="$PROJECT_ROOT/docs/operations/escalation-policy.md"

sections=("P1" "P2" "P3" "P4" "카테고리별 담당 팀" "자동 에스컬레이션" "감사 추적")
for section in "${sections[@]}"; do
  if grep -q "$section" "$esc_doc"; then
    assert_pass "에스컬레이션 정책 섹션: $section"
  else
    assert_fail "에스컬레이션 정책 섹션 누락: $section"
  fi
done

# ---------------------------------------------------------------------------
# 테스트 10: 핸드오프 체크리스트 필수 항목
# ---------------------------------------------------------------------------
log_test "핸드오프 체크리스트 필수 항목"

handoff="$PROJECT_ROOT/docs/operations/oncall-handoff-checklist.md"

items=("활성 인시던트" "에러 예산" "런북" "모니터링" "kubectl" "감사 로그")
for item in "${items[@]}"; do
  if grep -q "$item" "$handoff"; then
    assert_pass "핸드오프 항목: $item"
  else
    assert_fail "핸드오프 항목 누락: $item"
  fi
done

# ---------------------------------------------------------------------------
# 테스트 11: CSAP D-06 감사 추적 확인
# ---------------------------------------------------------------------------
log_test "CSAP D-06 감사 추적 확인"

if grep -q "D-06" "$config"; then
  assert_pass "ConfigMap에 D-06 참조"
else
  assert_fail "ConfigMap에 D-06 참조 누락"
fi

if grep -q "D-06" "$esc_doc"; then
  assert_pass "에스컬레이션 정책에 D-06 참조"
else
  assert_fail "에스컬레이션 정책에 D-06 참조 누락"
fi

# ---------------------------------------------------------------------------
# 테스트 12: 로테이션 실행
# ---------------------------------------------------------------------------
log_test "로테이션 실행"

rotate_output=$("$PROJECT_ROOT/scripts/oncall-status.sh" --rotate 2>&1)

if echo "$rotate_output" | grep -q "로테이션"; then
  assert_pass "로테이션 실행 성공"
else
  assert_fail "로테이션 실행 실패"
fi

# ---------------------------------------------------------------------------
# 결과 요약
# ---------------------------------------------------------------------------
echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  MTU-N122 온콜 에스컬레이션 E2E 테스트 결과${NC}"
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
