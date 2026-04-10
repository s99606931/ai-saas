#!/bin/bash
# ============================================================================
# MTU-N138 환경별 구성 관리 — 검증 테스트
# Plan SC: FR-N138.5
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

PASS=0
FAIL=0

pass() { echo -e "  \033[0;32m[PASS]\033[0m $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  \033[0;31m[FAIL]\033[0m $1"; FAIL=$((FAIL + 1)); }

echo "============================================"
echo "  MTU-N138 환경별 구성 관리 테스트"
echo "============================================"
echo ""

# T1: 스크립트 존재
echo "T1: 스크립트 존재"
[ -f "${SCRIPT_DIR}/env-config-audit.sh" ] && pass "존재" || fail "없음"
[ -x "${SCRIPT_DIR}/env-config-audit.sh" ] && pass "실행 가능" || fail "실행 불가"

# T2: 도움말
echo ""
echo "T2: 도움말"
bash "${SCRIPT_DIR}/env-config-audit.sh" --help 2>&1 | grep -q "사용법" && pass "도움말" || fail "도움말 실패"

# T3: 전체 감사 실행
echo ""
echo "T3: 전체 감사 실행"
OUTPUT=$(bash "${SCRIPT_DIR}/env-config-audit.sh" 2>&1 || true)
echo "${OUTPUT}" | grep -q "환경별 구성 파일 목록" && pass "섹션 1: 구성 목록" || fail "섹션 1 누락"
echo "${OUTPUT}" | grep -q "시크릿 관리 검증" && pass "섹션 2: 시크릿" || fail "섹션 2 누락"
echo "${OUTPUT}" | grep -q "리소스 제한 일관성" && pass "섹션 3: 리소스" || fail "섹션 3 누락"
echo "${OUTPUT}" | grep -q "이미지 태그 정책" && pass "섹션 4: 이미지" || fail "섹션 4 누락"
echo "${OUTPUT}" | grep -q "환경 구성 감사 요약" && pass "요약 섹션" || fail "요약 누락"

# T4: 특정 검증
echo ""
echo "T4: 특정 검증"
for check in secrets resources images; do
    CHK=$(bash "${SCRIPT_DIR}/env-config-audit.sh" --check "${check}" 2>&1 || true)
    echo "${CHK}" | grep -q "감사 요약\|결과" && pass "--check ${check}" || fail "--check ${check}"
done

# T5: 감사 로그
echo ""
echo "T5: 감사 로그"
grep -q "env-config-audit" "${PROJECT_ROOT}/.claude/audit.jsonl" 2>/dev/null && pass "감사 로그" || fail "감사 로그 없음"

# 결과
echo ""
echo "============================================"
TOTAL=$((PASS + FAIL))
echo "  전체: ${TOTAL} | PASS: ${PASS} | FAIL: ${FAIL}"
[ ${FAIL} -eq 0 ] && echo -e "  \033[0;32m결과: ALL PASS\033[0m" || echo -e "  \033[0;31m결과: ${FAIL}건 실패\033[0m"
[ ${FAIL} -eq 0 ] && exit 0 || exit 1
