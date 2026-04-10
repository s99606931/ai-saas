#!/usr/bin/env bash
# =============================================================================
# MTU-N123: 서비스 의존성 토폴로지 E2E 테스트
# Design Ref: MTU-N123 Design
# Plan SC: FR-N123.5
# CSAP: D-06(장애 영향 분석 검증)
#
# 사용법: ./scripts/test-service-topology.sh
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
# 테스트 1: 산출물 존재 확인
# ---------------------------------------------------------------------------
log_test "산출물 존재 확인"

files=(
  "infra/service-dependency/topology.yaml"
  "scripts/service-topology.sh"
  "infra/monitoring/dashboards/service-topology.json"
)

for f in "${files[@]}"; do
  if [[ -f "$PROJECT_ROOT/$f" ]]; then
    assert_pass "$f 존재"
  else
    assert_fail "$f 누락"
  fi
done

# ---------------------------------------------------------------------------
# 테스트 2: 스크립트 실행 확인
# ---------------------------------------------------------------------------
log_test "스크립트 실행 확인"

if [[ -x "$PROJECT_ROOT/scripts/service-topology.sh" ]]; then
  assert_pass "service-topology.sh 실행 가능"
else
  assert_fail "service-topology.sh 실행 권한 없음"
fi

# ---------------------------------------------------------------------------
# 테스트 3: 도움말 출력
# ---------------------------------------------------------------------------
log_test "도움말 출력"

help_output=$("$PROJECT_ROOT/scripts/service-topology.sh" --help 2>&1 || true)

for opt in "list" "deps" "blast" "tier" "critical"; do
  if echo "$help_output" | grep -q "$opt"; then
    assert_pass "도움말에 --$opt 포함"
  else
    assert_fail "도움말에 --$opt 미포함"
  fi
done

# ---------------------------------------------------------------------------
# 테스트 4: 전체 서비스 목록
# ---------------------------------------------------------------------------
log_test "전체 서비스 목록 조회"

list_output=$("$PROJECT_ROOT/scripts/service-topology.sh" --list 2>&1)

services=("api-gateway" "auth-service" "tenant-service" "postgresql" "redis" "prometheus" "grafana")
for svc in "${services[@]}"; do
  if echo "$list_output" | grep -q "$svc"; then
    assert_pass "서비스 표시: $svc"
  else
    assert_fail "서비스 미표시: $svc"
  fi
done

tiers=("gateway" "core" "data" "infra" "monitoring")
for tier in "${tiers[@]}"; do
  if echo "$list_output" | grep -q "$tier"; then
    assert_pass "계층 표시: $tier"
  else
    assert_fail "계층 미표시: $tier"
  fi
done

# ---------------------------------------------------------------------------
# 테스트 5: 서비스 의존성 조회
# ---------------------------------------------------------------------------
log_test "서비스 의존성 조회 (api-gateway)"

deps_output=$("$PROJECT_ROOT/scripts/service-topology.sh" --deps api-gateway 2>&1)

if echo "$deps_output" | grep -q "auth-service"; then
  assert_pass "api-gateway -> auth-service 의존성 표시"
else
  assert_fail "api-gateway -> auth-service 의존성 미표시"
fi

if echo "$deps_output" | grep -q "tenant-service"; then
  assert_pass "api-gateway -> tenant-service 의존성 표시"
else
  assert_fail "api-gateway -> tenant-service 의존성 미표시"
fi

if echo "$deps_output" | grep -q "critical"; then
  assert_pass "의존성 위험도(critical) 표시"
else
  assert_fail "의존성 위험도(critical) 미표시"
fi

# ---------------------------------------------------------------------------
# 테스트 6: 장애 영향 분석 (postgresql)
# ---------------------------------------------------------------------------
log_test "장애 영향 분석 (postgresql)"

blast_output=$("$PROJECT_ROOT/scripts/service-topology.sh" --blast postgresql 2>&1)

if echo "$blast_output" | grep -q "영향 범위"; then
  assert_pass "영향 범위 요약 표시"
else
  assert_fail "영향 범위 요약 미표시"
fi

if echo "$blast_output" | grep -q "auth-service"; then
  assert_pass "postgresql 장애 시 auth-service 영향"
else
  assert_fail "postgresql 장애 시 auth-service 영향 미표시"
fi

if echo "$blast_output" | grep -q "위험도"; then
  assert_pass "위험도 판단 표시"
else
  assert_fail "위험도 판단 미표시"
fi

# ---------------------------------------------------------------------------
# 테스트 7: 계층별 서비스 조회
# ---------------------------------------------------------------------------
log_test "계층별 서비스 조회"

tier_output=$("$PROJECT_ROOT/scripts/service-topology.sh" --tier core 2>&1)

if echo "$tier_output" | grep -q "auth-service"; then
  assert_pass "core 계층에 auth-service 표시"
else
  assert_fail "core 계층에 auth-service 미표시"
fi

# ---------------------------------------------------------------------------
# 테스트 8: SPOF 분석
# ---------------------------------------------------------------------------
log_test "SPOF 분석"

critical_output=$("$PROJECT_ROOT/scripts/service-topology.sh" --critical 2>&1)

if echo "$critical_output" | grep -q "SPOF"; then
  assert_pass "SPOF 분석 헤더 표시"
else
  assert_fail "SPOF 분석 헤더 미표시"
fi

if echo "$critical_output" | grep -q "postgresql"; then
  assert_pass "postgresql이 핵심 의존 서비스로 표시"
else
  assert_fail "postgresql이 핵심 의존 서비스로 미표시"
fi

# ---------------------------------------------------------------------------
# 테스트 9: 요약 통계
# ---------------------------------------------------------------------------
log_test "요약 통계"

summary_output=$("$PROJECT_ROOT/scripts/service-topology.sh" --summary 2>&1)

if echo "$summary_output" | grep -q "전체 서비스"; then
  assert_pass "전체 서비스 수 표시"
else
  assert_fail "전체 서비스 수 미표시"
fi

if echo "$summary_output" | grep -q "전체 의존성"; then
  assert_pass "전체 의존성 수 표시"
else
  assert_fail "전체 의존성 수 미표시"
fi

if echo "$summary_output" | grep -q "핵심 의존성"; then
  assert_pass "핵심 의존성 수 표시"
else
  assert_fail "핵심 의존성 수 미표시"
fi

# ---------------------------------------------------------------------------
# 테스트 10: ConfigMap 유효성
# ---------------------------------------------------------------------------
log_test "ConfigMap 유효성"

config="$PROJECT_ROOT/infra/service-dependency/topology.yaml"

if grep -q "apiVersion: v1" "$config"; then
  assert_pass "유효한 ConfigMap API 버전"
else
  assert_fail "유효하지 않은 ConfigMap API 버전"
fi

if grep -q "kind: ConfigMap" "$config"; then
  assert_pass "kind: ConfigMap"
else
  assert_fail "kind: ConfigMap 누락"
fi

# ---------------------------------------------------------------------------
# 테스트 11: Grafana 대시보드 유효성
# ---------------------------------------------------------------------------
log_test "Grafana 대시보드 유효성"

dashboard="$PROJECT_ROOT/infra/monitoring/dashboards/service-topology.json"

if python3 -c "import json; json.load(open('$dashboard'))" 2>/dev/null; then
  assert_pass "유효한 JSON 형식"
else
  assert_fail "유효하지 않은 JSON 형식"
fi

if grep -q "service-topology" "$dashboard"; then
  assert_pass "대시보드 UID 존재"
else
  assert_fail "대시보드 UID 누락"
fi

# ---------------------------------------------------------------------------
# 테스트 12: CSAP D-06 참조
# ---------------------------------------------------------------------------
log_test "CSAP D-06 참조 확인"

if grep -q "D-06" "$config"; then
  assert_pass "ConfigMap에 D-06 참조"
else
  assert_fail "ConfigMap에 D-06 참조 누락"
fi

# ---------------------------------------------------------------------------
# 결과 요약
# ---------------------------------------------------------------------------
echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  MTU-N123 서비스 토폴로지 E2E 테스트 결과${NC}"
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
