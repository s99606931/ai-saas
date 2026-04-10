#!/usr/bin/env bash
# =============================================================================
# MTU-N117: 자동 포스트모템 E2E 테스트
# Design Ref: MTU-N117 Design SS5
# Plan SC: FR-N117.6
# CSAP: D-06(침해사고 관리 -- 포스트모템 검증)
#
# 사용법: ./scripts/test-auto-postmortem.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 색상 코드
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
# 테스트 1: 문서 산출물 존재 확인
# ---------------------------------------------------------------------------
log_test "문서 산출물 존재 확인"

docs=(
  "docs/operations/postmortem-template.md"
  "docs/operations/incident-severity-matrix.md"
  "docs/operations/five-whys-guide.md"
  "docs/operations/postmortem-action-tracker.md"
)

for doc in "${docs[@]}"; do
  if [[ -f "$PROJECT_ROOT/$doc" ]]; then
    assert_pass "$doc 존재"
  else
    assert_fail "$doc 누락"
  fi
done

# ---------------------------------------------------------------------------
# 테스트 2: 스크립트 실행 권한 확인
# ---------------------------------------------------------------------------
log_test "스크립트 실행 가능 확인"

if [[ -x "$PROJECT_ROOT/scripts/generate-postmortem.sh" ]]; then
  assert_pass "generate-postmortem.sh 실행 가능"
else
  assert_fail "generate-postmortem.sh 실행 권한 없음"
fi

# ---------------------------------------------------------------------------
# 테스트 3: 도움말 출력 테스트
# ---------------------------------------------------------------------------
log_test "도움말 출력 테스트"

help_output=$("$PROJECT_ROOT/scripts/generate-postmortem.sh" --help 2>&1 || true)

if echo "$help_output" | grep -q "alert-name"; then
  assert_pass "도움말에 --alert-name 포함"
else
  assert_fail "도움말에 --alert-name 미포함"
fi

if echo "$help_output" | grep -q "severity"; then
  assert_pass "도움말에 --severity 포함"
else
  assert_fail "도움말에 --severity 미포함"
fi

if echo "$help_output" | grep -q "dry-run"; then
  assert_pass "도움말에 --dry-run 포함"
else
  assert_fail "도움말에 --dry-run 미포함"
fi

# ---------------------------------------------------------------------------
# 테스트 4: 입력 검증 (빈 인수)
# ---------------------------------------------------------------------------
log_test "입력 검증 -- 필수 인수 누락 시 오류"

if ! "$PROJECT_ROOT/scripts/generate-postmortem.sh" 2>/dev/null; then
  assert_pass "필수 인수 누락 시 오류 반환"
else
  assert_fail "필수 인수 누락인데 성공으로 반환"
fi

# ---------------------------------------------------------------------------
# 테스트 5: 입력 검증 (잘못된 심각도)
# ---------------------------------------------------------------------------
log_test "입력 검증 -- 잘못된 심각도"

if ! "$PROJECT_ROOT/scripts/generate-postmortem.sh" \
  --alert-name "TestAlert" \
  --severity "INVALID" \
  --category "availability" \
  --start "2026-04-10T10:00:00Z" \
  --end "2026-04-10T10:30:00Z" \
  --dry-run 2>/dev/null; then
  assert_pass "잘못된 심각도 시 오류 반환"
else
  assert_fail "잘못된 심각도인데 성공으로 반환"
fi

# ---------------------------------------------------------------------------
# 테스트 6: 입력 검증 (잘못된 카테고리)
# ---------------------------------------------------------------------------
log_test "입력 검증 -- 잘못된 카테고리"

if ! "$PROJECT_ROOT/scripts/generate-postmortem.sh" \
  --alert-name "TestAlert" \
  --severity "P1" \
  --category "invalid-cat" \
  --start "2026-04-10T10:00:00Z" \
  --end "2026-04-10T10:30:00Z" \
  --dry-run 2>/dev/null; then
  assert_pass "잘못된 카테고리 시 오류 반환"
else
  assert_fail "잘못된 카테고리인데 성공으로 반환"
fi

# ---------------------------------------------------------------------------
# 테스트 7: P1 가용성 인시던트 dry-run 생성
# ---------------------------------------------------------------------------
log_test "P1 가용성 인시던트 포스트모템 dry-run 생성"

"$PROJECT_ROOT/scripts/generate-postmortem.sh" \
  --alert-name "SLORollbackTriggerBurnRate" \
  --severity "P1" \
  --category "availability" \
  --start "2026-04-10T10:00:00Z" \
  --end "2026-04-10T10:30:00Z" \
  --namespace "production" \
  --service "api-server" \
  --responder "SRE팀" \
  --incident-id "INC-TEST-001" \
  --output-dir "$TEST_OUTPUT_DIR" \
  --dry-run > /dev/null 2>&1

if [[ -f "$TEST_OUTPUT_DIR/INC-TEST-001.md" ]]; then
  assert_pass "포스트모템 파일 생성됨"

  # 필수 섹션 확인
  content=$(cat "$TEST_OUTPUT_DIR/INC-TEST-001.md")

  if echo "$content" | grep -q "인시던트 요약"; then
    assert_pass "섹션 1: 인시던트 요약 포함"
  else
    assert_fail "섹션 1: 인시던트 요약 누락"
  fi

  if echo "$content" | grep -q "인시던트 타임라인"; then
    assert_pass "섹션 2: 인시던트 타임라인 포함"
  else
    assert_fail "섹션 2: 인시던트 타임라인 누락"
  fi

  if echo "$content" | grep -q "영향 분석"; then
    assert_pass "섹션 3: 영향 분석 포함"
  else
    assert_fail "섹션 3: 영향 분석 누락"
  fi

  if echo "$content" | grep -q "근본 원인 분석"; then
    assert_pass "섹션 4: 근본 원인 분석 포함"
  else
    assert_fail "섹션 4: 근본 원인 분석 누락"
  fi

  if echo "$content" | grep -q "대응 이력"; then
    assert_pass "섹션 5: 대응 이력 포함"
  else
    assert_fail "섹션 5: 대응 이력 누락"
  fi

  if echo "$content" | grep -q "개선 조치"; then
    assert_pass "섹션 6: 개선 조치 포함"
  else
    assert_fail "섹션 6: 개선 조치 누락"
  fi

  if echo "$content" | grep -q "교훈"; then
    assert_pass "섹션 7: 교훈 포함"
  else
    assert_fail "섹션 7: 교훈 누락"
  fi

  if echo "$content" | grep -q "감사 추적"; then
    assert_pass "섹션 8: 감사 추적 포함"
  else
    assert_fail "섹션 8: 감사 추적 누락"
  fi

  if echo "$content" | grep -q "검토 이력"; then
    assert_pass "섹션 9: 검토 이력 포함"
  else
    assert_fail "섹션 9: 검토 이력 누락"
  fi

  # 인시던트 정보 확인
  if echo "$content" | grep -q "INC-TEST-001"; then
    assert_pass "인시던트 ID 올바름"
  else
    assert_fail "인시던트 ID 누락"
  fi

  if echo "$content" | grep -q "P1"; then
    assert_pass "심각도 P1 표시"
  else
    assert_fail "심각도 P1 미표시"
  fi

  if echo "$content" | grep -q "SLORollbackTriggerBurnRate"; then
    assert_pass "알림 이름 표시"
  else
    assert_fail "알림 이름 미표시"
  fi
else
  assert_fail "포스트모템 파일 미생성"
fi

# ---------------------------------------------------------------------------
# 테스트 8: P2 보안 인시던트 dry-run 생성
# ---------------------------------------------------------------------------
log_test "P2 보안 인시던트 포스트모템 dry-run 생성"

"$PROJECT_ROOT/scripts/generate-postmortem.sh" \
  --alert-name "FalcoRuntimeAnomaly" \
  --severity "P2" \
  --category "security" \
  --start "2026-04-10T14:00:00Z" \
  --end "2026-04-10T14:45:00Z" \
  --service "auth-service" \
  --responder "보안팀" \
  --incident-id "INC-TEST-002" \
  --output-dir "$TEST_OUTPUT_DIR" \
  --dry-run > /dev/null 2>&1

if [[ -f "$TEST_OUTPUT_DIR/INC-TEST-002.md" ]]; then
  content=$(cat "$TEST_OUTPUT_DIR/INC-TEST-002.md")

  if echo "$content" | grep -q "보안"; then
    assert_pass "보안 카테고리 표시"
  else
    assert_fail "보안 카테고리 미표시"
  fi

  if echo "$content" | grep -q "접근 통제 정책"; then
    assert_pass "보안 5 Whys 질문 생성됨"
  else
    assert_fail "보안 5 Whys 질문 미생성"
  fi

  if echo "$content" | grep -q "접근 권한 검토"; then
    assert_pass "보안 개선 조치 생성됨"
  else
    assert_fail "보안 개선 조치 미생성"
  fi
else
  assert_fail "보안 인시던트 포스트모템 미생성"
fi

# ---------------------------------------------------------------------------
# 테스트 9: P3 성능 인시던트 dry-run 생성
# ---------------------------------------------------------------------------
log_test "P3 성능 인시던트 포스트모템 dry-run 생성"

"$PROJECT_ROOT/scripts/generate-postmortem.sh" \
  --alert-name "HighLatencyAnomaly" \
  --severity "P3" \
  --category "performance" \
  --start "2026-04-10T08:00:00Z" \
  --end "2026-04-10T08:15:00Z" \
  --incident-id "INC-TEST-003" \
  --output-dir "$TEST_OUTPUT_DIR" \
  --dry-run > /dev/null 2>&1

if [[ -f "$TEST_OUTPUT_DIR/INC-TEST-003.md" ]]; then
  content=$(cat "$TEST_OUTPUT_DIR/INC-TEST-003.md")

  if echo "$content" | grep -q "성능"; then
    assert_pass "성능 카테고리 표시"
  else
    assert_fail "성능 카테고리 미표시"
  fi

  if echo "$content" | grep -q "부하 테스트"; then
    assert_pass "성능 5 Whys 질문 생성됨"
  else
    assert_fail "성능 5 Whys 질문 미생성"
  fi
else
  assert_fail "성능 인시던트 포스트모템 미생성"
fi

# ---------------------------------------------------------------------------
# 테스트 10: 인프라 인시던트 dry-run 생성
# ---------------------------------------------------------------------------
log_test "인프라 인시던트 포스트모템 dry-run 생성"

"$PROJECT_ROOT/scripts/generate-postmortem.sh" \
  --alert-name "NodeNotReady" \
  --severity "P1" \
  --category "infrastructure" \
  --start "2026-04-10T02:00:00Z" \
  --end "2026-04-10T02:25:00Z" \
  --incident-id "INC-TEST-004" \
  --output-dir "$TEST_OUTPUT_DIR" \
  --dry-run > /dev/null 2>&1

if [[ -f "$TEST_OUTPUT_DIR/INC-TEST-004.md" ]]; then
  content=$(cat "$TEST_OUTPUT_DIR/INC-TEST-004.md")

  if echo "$content" | grep -q "인프라"; then
    assert_pass "인프라 카테고리 표시"
  else
    assert_fail "인프라 카테고리 미표시"
  fi

  if echo "$content" | grep -q "이중화"; then
    assert_pass "인프라 5 Whys 질문 생성됨"
  else
    assert_fail "인프라 5 Whys 질문 미생성"
  fi

  if echo "$content" | grep -q "카오스 엔지니어링"; then
    assert_pass "P1 장기 조치에 카오스 엔지니어링 포함"
  else
    assert_fail "P1 장기 조치에 카오스 엔지니어링 미포함"
  fi
else
  assert_fail "인프라 인시던트 포스트모템 미생성"
fi

# ---------------------------------------------------------------------------
# 테스트 11: PrometheusRule 파일 존재 및 유효성
# ---------------------------------------------------------------------------
log_test "PrometheusRule 파일 검증"

prom_rule="$PROJECT_ROOT/infra/monitoring/postmortem-trigger-rules.yaml"

if [[ -f "$prom_rule" ]]; then
  assert_pass "postmortem-trigger-rules.yaml 존재"

  if grep -q "PostmortemRequiredP1" "$prom_rule"; then
    assert_pass "P1 포스트모템 트리거 알림 정의"
  else
    assert_fail "P1 포스트모템 트리거 알림 미정의"
  fi

  if grep -q "PostmortemRequiredP2Long" "$prom_rule"; then
    assert_pass "P2 장기 포스트모템 트리거 알림 정의"
  else
    assert_fail "P2 장기 포스트모템 트리거 알림 미정의"
  fi

  if grep -q "RepeatedIncidentPattern" "$prom_rule"; then
    assert_pass "반복 인시던트 경고 알림 정의"
  else
    assert_fail "반복 인시던트 경고 알림 미정의"
  fi

  if grep -q "MTTRExceeded" "$prom_rule"; then
    assert_pass "MTTR 초과 경고 알림 정의"
  else
    assert_fail "MTTR 초과 경고 알림 미정의"
  fi

  if grep -q "apiVersion: monitoring.coreos.com/v1" "$prom_rule"; then
    assert_pass "유효한 PrometheusRule API 버전"
  else
    assert_fail "유효하지 않은 PrometheusRule API 버전"
  fi
else
  assert_fail "postmortem-trigger-rules.yaml 누락"
fi

# ---------------------------------------------------------------------------
# 테스트 12: 포스트모템 템플릿 필수 섹션 확인
# ---------------------------------------------------------------------------
log_test "포스트모템 템플릿 필수 섹션 확인"

template="$PROJECT_ROOT/docs/operations/postmortem-template.md"

if [[ -f "$template" ]]; then
  sections=("인시던트 요약" "인시던트 타임라인" "영향 분석" "근본 원인 분석" "대응 이력" "개선 조치" "교훈" "감사 추적" "검토 이력")

  for section in "${sections[@]}"; do
    if grep -q "$section" "$template"; then
      assert_pass "템플릿 섹션: $section"
    else
      assert_fail "템플릿 섹션 누락: $section"
    fi
  done
else
  assert_fail "포스트모템 템플릿 누락"
fi

# ---------------------------------------------------------------------------
# 테스트 13: CSAP D-06 감사 추적 확인
# ---------------------------------------------------------------------------
log_test "CSAP D-06 감사 추적 확인"

if grep -q "D-06" "$PROJECT_ROOT/docs/operations/postmortem-template.md"; then
  assert_pass "포스트모템 템플릿에 D-06 참조"
fi

if grep -q "D-06" "$PROJECT_ROOT/infra/monitoring/postmortem-trigger-rules.yaml"; then
  assert_pass "PrometheusRule에 D-06 참조"
fi

if grep -q "D-06" "$PROJECT_ROOT/docs/operations/incident-severity-matrix.md"; then
  assert_pass "인시던트 분류 체계에 D-06 참조"
fi

# ---------------------------------------------------------------------------
# 테스트 14: 5 Whys 가이드 카테고리별 질문 확인
# ---------------------------------------------------------------------------
log_test "5 Whys 가이드 카테고리별 질문 확인"

whys_guide="$PROJECT_ROOT/docs/operations/five-whys-guide.md"

if [[ -f "$whys_guide" ]]; then
  categories=("보안 인시던트" "가용성 인시던트" "성능 인시던트" "인프라 인시던트" "배포 인시던트")

  for cat in "${categories[@]}"; do
    if grep -q "$cat" "$whys_guide"; then
      assert_pass "5 Whys 카테고리: $cat"
    else
      assert_fail "5 Whys 카테고리 누락: $cat"
    fi
  done
else
  assert_fail "5 Whys 가이드 누락"
fi

# ---------------------------------------------------------------------------
# 테스트 15: 배포/데이터 카테고리 포스트모템 생성
# ---------------------------------------------------------------------------
log_test "배포/데이터 카테고리 포스트모템 생성"

for cat in deployment data; do
  "$PROJECT_ROOT/scripts/generate-postmortem.sh" \
    --alert-name "Test${cat}Alert" \
    --severity "P2" \
    --category "$cat" \
    --start "2026-04-10T12:00:00Z" \
    --end "2026-04-10T12:20:00Z" \
    --incident-id "INC-TEST-${cat}" \
    --output-dir "$TEST_OUTPUT_DIR" \
    --dry-run > /dev/null 2>&1

  if [[ -f "$TEST_OUTPUT_DIR/INC-TEST-${cat}.md" ]]; then
    assert_pass "${cat} 카테고리 포스트모템 생성"
  else
    assert_fail "${cat} 카테고리 포스트모템 미생성"
  fi
done

# ---------------------------------------------------------------------------
# 결과 요약
# ---------------------------------------------------------------------------
echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  MTU-N117 자동 포스트모템 E2E 테스트 결과${NC}"
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
