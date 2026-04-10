#!/bin/bash
# ============================================================================
# MTU-N134 비용 최적화 보고서 — 검증 테스트
# Plan SC: FR-N134.5
# Design Ref: MTU-N134 Design
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
echo "  MTU-N134 비용 최적화 보고서 테스트"
echo "============================================"
echo ""

# ──────────────────────────────────────────
# T1: 스크립트 존재 및 실행 가능
# ──────────────────────────────────────────
echo "T1: 스크립트 존재 및 실행 가능"
if [ -f "${SCRIPT_DIR}/cost-optimization-report.sh" ]; then
    pass "cost-optimization-report.sh 존재"
else
    fail "cost-optimization-report.sh 없음"
fi

if [ -x "${SCRIPT_DIR}/cost-optimization-report.sh" ]; then
    pass "실행 권한 있음"
else
    fail "실행 권한 없음"
fi

# ──────────────────────────────────────────
# T2: 도움말 출력
# ──────────────────────────────────────────
echo ""
echo "T2: 도움말 출력"
if bash "${SCRIPT_DIR}/cost-optimization-report.sh" --help 2>&1 | grep -q "사용법"; then
    pass "도움말 출력 정상"
else
    fail "도움말 출력 실패"
fi

# ──────────────────────────────────────────
# T3: 전체 보고서 실행
# ──────────────────────────────────────────
echo ""
echo "T3: 전체 보고서 실행"
REPORT_OUTPUT=$(bash "${SCRIPT_DIR}/cost-optimization-report.sh" 2>&1 || true)

if echo "${REPORT_OUTPUT}" | grep -q "Executive Summary"; then
    pass "섹션 1: Executive Summary 존재"
else
    fail "섹션 1: Executive Summary 없음"
fi

if echo "${REPORT_OUTPUT}" | grep -q "테넌트별 비용 분석"; then
    pass "섹션 2: 테넌트별 비용 분석 존재"
else
    fail "섹션 2: 테넌트별 비용 분석 없음"
fi

if echo "${REPORT_OUTPUT}" | grep -q "리소스 효율성 분석"; then
    pass "섹션 3: 리소스 효율성 분석 존재"
else
    fail "섹션 3: 리소스 효율성 분석 없음"
fi

if echo "${REPORT_OUTPUT}" | grep -q "최적화 권고사항"; then
    pass "섹션 4: 최적화 권고사항 존재"
else
    fail "섹션 4: 최적화 권고사항 없음"
fi

if echo "${REPORT_OUTPUT}" | grep -q "기술 부채 비용 영향"; then
    pass "섹션 5: 기술 부채 비용 영향 존재"
else
    fail "섹션 5: 기술 부채 비용 영향 없음"
fi

# ──────────────────────────────────────────
# T4: 비용 추정 항목 확인
# ──────────────────────────────────────────
echo ""
echo "T4: 비용 추정 항목 확인"
if echo "${REPORT_OUTPUT}" | grep -q "CPU 비용"; then
    pass "CPU 비용 항목 존재"
else
    fail "CPU 비용 항목 없음"
fi

if echo "${REPORT_OUTPUT}" | grep -q "메모리 비용"; then
    pass "메모리 비용 항목 존재"
else
    fail "메모리 비용 항목 없음"
fi

if echo "${REPORT_OUTPUT}" | grep -q "효율성 등급"; then
    pass "효율성 등급 항목 존재"
else
    fail "효율성 등급 항목 없음"
fi

# ──────────────────────────────────────────
# T5: 특정 섹션 실행
# ──────────────────────────────────────────
echo ""
echo "T5: 특정 섹션 실행"
for section in summary tenant efficiency recommendations debt; do
    SEC_OUTPUT=$(bash "${SCRIPT_DIR}/cost-optimization-report.sh" --section "${section}" 2>&1 || true)
    if echo "${SEC_OUTPUT}" | grep -q "보고서 저장\|생성 완료"; then
        pass "--section ${section} 실행 정상"
    else
        fail "--section ${section} 실행 실패"
    fi
done

# ──────────────────────────────────────────
# T6: 보고서 파일 생성
# ──────────────────────────────────────────
echo ""
echo "T6: 보고서 파일 생성"
REPORT_DATE=$(date +%Y-%m-%d)
if [ -f "${PROJECT_ROOT}/docs/reports/cost-optimization/cost-report-${REPORT_DATE}.md" ]; then
    pass "보고서 파일 생성 확인"
else
    fail "보고서 파일 미생성"
fi

# ──────────────────────────────────────────
# T7: 감사 로그 기록
# ──────────────────────────────────────────
echo ""
echo "T7: 감사 로그 기록"
if grep -q "cost-optimization-report" "${PROJECT_ROOT}/.claude/audit.jsonl" 2>/dev/null; then
    pass "감사 로그에 비용 보고서 기록 존재"
else
    fail "감사 로그에 비용 보고서 기록 없음"
fi

# ──────────────────────────────────────────
# T8: 비용 모델 상수 확인
# ──────────────────────────────────────────
echo ""
echo "T8: 비용 모델 상수 확인"
if grep -q "0.05" "${SCRIPT_DIR}/cost-optimization-report.sh" && \
   grep -q "0.01" "${SCRIPT_DIR}/cost-optimization-report.sh" && \
   grep -q "0.10" "${SCRIPT_DIR}/cost-optimization-report.sh"; then
    pass "비용 모델 상수 확인 (CPU:0.05, MEM:0.01, STORAGE:0.10)"
else
    fail "비용 모델 상수 누락"
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
