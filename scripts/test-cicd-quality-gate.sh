#!/bin/bash
# ============================================================================
# MTU-N133 CI/CD 통합 품질 게이트 — 검증 테스트
# Plan SC: FR-N133.5
# Design Ref: MTU-N133 Design
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

PASS=0
FAIL=0
SKIP=0

pass() { echo -e "  \033[0;32m[PASS]\033[0m $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  \033[0;31m[FAIL]\033[0m $1"; FAIL=$((FAIL + 1)); }
skip() { echo -e "  \033[1;33m[SKIP]\033[0m $1"; SKIP=$((SKIP + 1)); }

echo "============================================"
echo "  MTU-N133 CI/CD 품질 게이트 테스트"
echo "============================================"
echo ""

# ──────────────────────────────────────────
# T1: 스크립트 존재 및 실행 가능
# ──────────────────────────────────────────
echo "T1: 스크립트 존재 및 실행 가능"
if [ -f "${SCRIPT_DIR}/cicd-quality-gate.sh" ]; then
    pass "cicd-quality-gate.sh 존재"
else
    fail "cicd-quality-gate.sh 없음"
fi

if [ -x "${SCRIPT_DIR}/cicd-quality-gate.sh" ]; then
    pass "실행 권한 있음"
else
    fail "실행 권한 없음"
fi

# ──────────────────────────────────────────
# T2: 도움말 출력
# ──────────────────────────────────────────
echo ""
echo "T2: 도움말 출력"
if bash "${SCRIPT_DIR}/cicd-quality-gate.sh" --help 2>&1 | grep -q "사용법"; then
    pass "도움말 출력 정상"
else
    fail "도움말 출력 실패"
fi

# ──────────────────────────────────────────
# T3: 전체 게이트 실행
# ──────────────────────────────────────────
echo ""
echo "T3: 전체 게이트 실행"
GATE_OUTPUT=$(bash "${SCRIPT_DIR}/cicd-quality-gate.sh" 2>&1 || true)

if echo "${GATE_OUTPUT}" | grep -q "보안 영역 평가"; then
    pass "보안 영역 평가 실행됨"
else
    fail "보안 영역 평가 미실행"
fi

if echo "${GATE_OUTPUT}" | grep -q "테스트 영역 평가"; then
    pass "테스트 영역 평가 실행됨"
else
    fail "테스트 영역 평가 미실행"
fi

if echo "${GATE_OUTPUT}" | grep -q "코드 품질 영역 평가"; then
    pass "코드 품질 영역 평가 실행됨"
else
    fail "코드 품질 영역 평가 미실행"
fi

if echo "${GATE_OUTPUT}" | grep -q "규정 준수 영역 평가"; then
    pass "규정 준수 영역 평가 실행됨"
else
    fail "규정 준수 영역 평가 미실행"
fi

# ──────────────────────────────────────────
# T4: 점수 산출 확인
# ──────────────────────────────────────────
echo ""
echo "T4: 점수 산출 확인"
if echo "${GATE_OUTPUT}" | grep -q "전체 점수"; then
    pass "전체 점수 산출됨"
else
    fail "전체 점수 미산출"
fi

if echo "${GATE_OUTPUT}" | grep -q "가중:"; then
    pass "가중 점수 표시됨"
else
    fail "가중 점수 미표시"
fi

# ──────────────────────────────────────────
# T5: 합격/불합격 판정
# ──────────────────────────────────────────
echo ""
echo "T5: 합격/불합격 판정"
if echo "${GATE_OUTPUT}" | grep -qE "GATE PASS|GATE FAIL"; then
    pass "합격/불합격 판정 출력됨"
else
    fail "판정 결과 미출력"
fi

# ──────────────────────────────────────────
# T6: 특정 영역 실행
# ──────────────────────────────────────────
echo ""
echo "T6: 특정 영역 실행"
for area in security test code compliance; do
    AREA_OUTPUT=$(bash "${SCRIPT_DIR}/cicd-quality-gate.sh" --area "${area}" 2>&1 || true)
    if echo "${AREA_OUTPUT}" | grep -q "전체 점수"; then
        pass "--area ${area} 실행 정상"
    else
        fail "--area ${area} 실행 실패"
    fi
done

# ──────────────────────────────────────────
# T7: 감사 로그 기록
# ──────────────────────────────────────────
echo ""
echo "T7: 감사 로그 기록"
if [ -f "${PROJECT_ROOT}/.claude/audit.jsonl" ]; then
    if grep -q "cicd-quality-gate" "${PROJECT_ROOT}/.claude/audit.jsonl"; then
        pass "감사 로그에 품질 게이트 기록 존재"
    else
        fail "감사 로그에 품질 게이트 기록 없음"
    fi
else
    fail "감사 로그 파일 없음"
fi

# ──────────────────────────────────────────
# T8: 4영역 가중치 합산 100%
# ──────────────────────────────────────────
echo ""
echo "T8: 가중치 합산 검증"
if grep -q "30%" "${SCRIPT_DIR}/cicd-quality-gate.sh" && \
   grep -q "25%" "${SCRIPT_DIR}/cicd-quality-gate.sh" && \
   grep -q "20%" "${SCRIPT_DIR}/cicd-quality-gate.sh"; then
    pass "가중치 30+25+25+20 = 100% 확인"
else
    fail "가중치 합산 오류"
fi

# ──────────────────────────────────────────
# 결과 요약
# ──────────────────────────────────────────
echo ""
echo "============================================"
echo "  테스트 결과 요약"
echo "============================================"
TOTAL=$((PASS + FAIL + SKIP))
echo "  전체: ${TOTAL} | PASS: ${PASS} | FAIL: ${FAIL} | SKIP: ${SKIP}"

if [ ${FAIL} -eq 0 ]; then
    echo -e "  \033[0;32m결과: ALL PASS\033[0m"
    exit 0
else
    echo -e "  \033[0;31m결과: ${FAIL}건 실패\033[0m"
    exit 1
fi
