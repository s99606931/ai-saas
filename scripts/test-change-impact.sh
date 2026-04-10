#!/bin/bash
# ============================================================================
# MTU-N136 변경 관리 자동화 — 검증 테스트
# Plan SC: FR-N136.5
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

PASS=0
FAIL=0

pass() { echo -e "  \033[0;32m[PASS]\033[0m $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  \033[0;31m[FAIL]\033[0m $1"; FAIL=$((FAIL + 1)); }

echo "============================================"
echo "  MTU-N136 변경 관리 자동화 테스트"
echo "============================================"
echo ""

# T1: 스크립트 존재 및 실행 가능
echo "T1: 스크립트 존재 및 실행 가능"
if [ -f "${SCRIPT_DIR}/change-impact-analysis.sh" ]; then
    pass "change-impact-analysis.sh 존재"
else
    fail "change-impact-analysis.sh 없음"
fi
if [ -x "${SCRIPT_DIR}/change-impact-analysis.sh" ]; then
    pass "실행 권한 있음"
else
    fail "실행 권한 없음"
fi

# T2: 도움말 출력
echo ""
echo "T2: 도움말 출력"
if bash "${SCRIPT_DIR}/change-impact-analysis.sh" --help 2>&1 | grep -q "사용법"; then
    pass "도움말 출력 정상"
else
    fail "도움말 출력 실패"
fi

# T3: 전체 분석 실행
echo ""
echo "T3: 전체 분석 실행"
ANALYSIS_OUTPUT=$(bash "${SCRIPT_DIR}/change-impact-analysis.sh" 2>&1 || true)

if echo "${ANALYSIS_OUTPUT}" | grep -q "변경 파일 카테고리 분류"; then
    pass "섹션 1: 카테고리 분류"
else
    fail "섹션 1 누락"
fi

if echo "${ANALYSIS_OUTPUT}" | grep -q "영향 받는 서비스"; then
    pass "섹션 2: 영향 서비스 식별"
else
    fail "섹션 2 누락"
fi

if echo "${ANALYSIS_OUTPUT}" | grep -q "위험도 평가"; then
    pass "섹션 3: 위험도 평가"
else
    fail "섹션 3 누락"
fi

if echo "${ANALYSIS_OUTPUT}" | grep -q "롤백 계획"; then
    pass "섹션 4: 롤백 계획"
else
    fail "섹션 4 누락"
fi

# T4: 위험도 등급 표시
echo ""
echo "T4: 위험도 등급 표시"
if echo "${ANALYSIS_OUTPUT}" | grep -qE "LOW|MEDIUM|HIGH|CRITICAL"; then
    pass "위험 등급 표시됨"
else
    fail "위험 등급 미표시"
fi

if echo "${ANALYSIS_OUTPUT}" | grep -q "위험 점수"; then
    pass "위험 점수 산출됨"
else
    fail "위험 점수 미산출"
fi

# T5: 롤백 명령 포함
echo ""
echo "T5: 롤백 명령 포함"
if echo "${ANALYSIS_OUTPUT}" | grep -q "git revert\|git reset"; then
    pass "Git 롤백 명령 포함"
else
    fail "Git 롤백 명령 누락"
fi

if echo "${ANALYSIS_OUTPUT}" | grep -q "healthcheck"; then
    pass "검증 절차 포함"
else
    fail "검증 절차 누락"
fi

# T6: 카테고리별 가중치 존재
echo ""
echo "T6: 카테고리별 가중치 확인"
if grep -q "x3\|x4\|x2\|x1" "${SCRIPT_DIR}/change-impact-analysis.sh"; then
    pass "가중치 정의 존재"
else
    fail "가중치 정의 없음"
fi

# T7: 감사 로그 기록
echo ""
echo "T7: 감사 로그 기록"
if grep -q "change-impact-analysis" "${PROJECT_ROOT}/.claude/audit.jsonl" 2>/dev/null; then
    pass "감사 로그 기록 존재"
else
    fail "감사 로그 기록 없음"
fi

# T8: Plan + Design 문서 존재
echo ""
echo "T8: Plan + Design 문서 확인"
if [ -f "${PROJECT_ROOT}/docs/01-plan/mtus/MTU-N136.plan.md" ]; then
    pass "Plan 문서 존재"
else
    fail "Plan 문서 없음"
fi
if [ -f "${PROJECT_ROOT}/docs/02-design/mtus/MTU-N136.design.md" ]; then
    pass "Design 문서 존재"
else
    fail "Design 문서 없음"
fi

# 결과 요약
echo ""
echo "============================================"
echo "  테스트 결과 요약"
echo "============================================"
TOTAL=$((PASS + FAIL))
echo "  전체: ${TOTAL} | PASS: ${PASS} | FAIL: ${FAIL}"

if [ ${FAIL} -eq 0 ]; then
    echo -e "  \033[0;32m결과: ALL PASS\033[0m"
    exit 0
else
    echo -e "  \033[0;31m결과: ${FAIL}건 실패\033[0m"
    exit 1
fi
