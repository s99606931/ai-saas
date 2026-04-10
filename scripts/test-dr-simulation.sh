#!/bin/bash
# ============================================================================
# MTU-N139 장애 복구 시뮬레이션 — 검증 테스트
# Plan SC: FR-N139.5
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

PASS=0
FAIL=0

pass() { echo -e "  \033[0;32m[PASS]\033[0m $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  \033[0;31m[FAIL]\033[0m $1"; FAIL=$((FAIL + 1)); }

echo "============================================"
echo "  MTU-N139 DR 시뮬레이션 테스트"
echo "============================================"
echo ""

# T1: 스크립트
echo "T1: 스크립트"
[ -f "${SCRIPT_DIR}/dr-simulation.sh" ] && pass "존재" || fail "없음"
[ -x "${SCRIPT_DIR}/dr-simulation.sh" ] && pass "실행 가능" || fail "실행 불가"

# T2: 도움말
echo ""
echo "T2: 도움말"
bash "${SCRIPT_DIR}/dr-simulation.sh" --help 2>&1 | grep -q "사용법" && pass "도움말" || fail "도움말"

# T3: 시나리오 목록
echo ""
echo "T3: 시나리오 목록"
OUTPUT=$(bash "${SCRIPT_DIR}/dr-simulation.sh" 2>&1 || true)
echo "${OUTPUT}" | grep -q "DR-01" && pass "DR-01 존재" || fail "DR-01 누락"
echo "${OUTPUT}" | grep -q "DR-05" && pass "DR-05 존재" || fail "DR-05 누락"
echo "${OUTPUT}" | grep -q "RTO" && pass "RTO 표시" || fail "RTO 누락"
echo "${OUTPUT}" | grep -q "RPO" && pass "RPO 표시" || fail "RPO 누락"

# T4: 시나리오별 체크리스트
echo ""
echo "T4: 시나리오별 체크리스트"
for id in DR-01 DR-02 DR-03 DR-04 DR-05; do
    SC_OUTPUT=$(bash "${SCRIPT_DIR}/dr-simulation.sh" --scenario "${id}" 2>&1 || true)
    echo "${SC_OUTPUT}" | grep -q "복구 체크리스트\|체크리스트" && pass "${id} 체크리스트" || fail "${id} 체크리스트"
done

# T5: DR 훈련 모드
echo ""
echo "T5: DR 훈련 모드"
DRILL_OUTPUT=$(bash "${SCRIPT_DIR}/dr-simulation.sh" --drill 2>&1 || true)
echo "${DRILL_OUTPUT}" | grep -q "DR 훈련 모드" && pass "훈련 모드" || fail "훈련 모드"
echo "${DRILL_OUTPUT}" | grep -q "사전 검증" && pass "사전 검증" || fail "사전 검증"

# T6: 감사 로그
echo ""
echo "T6: 감사 로그"
grep -q "dr-simulation" "${PROJECT_ROOT}/.claude/audit.jsonl" 2>/dev/null && pass "감사 로그" || fail "감사 로그"

# 결과
echo ""
echo "============================================"
TOTAL=$((PASS + FAIL))
echo "  전체: ${TOTAL} | PASS: ${PASS} | FAIL: ${FAIL}"
[ ${FAIL} -eq 0 ] && echo -e "  \033[0;32m결과: ALL PASS\033[0m" || echo -e "  \033[0;31m결과: ${FAIL}건 실패\033[0m"
[ ${FAIL} -eq 0 ] && exit 0 || exit 1
