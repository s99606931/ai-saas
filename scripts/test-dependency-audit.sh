#!/bin/bash
# MTU-N140 의존성 보안 감사 — 검증 테스트
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PASS=0; FAIL=0

pass() { echo -e "  \033[0;32m[PASS]\033[0m $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  \033[0;31m[FAIL]\033[0m $1"; FAIL=$((FAIL + 1)); }

echo "============================================"
echo "  MTU-N140 의존성 보안 감사 테스트"
echo "============================================"
echo ""

# T1
echo "T1: 스크립트"
[ -f "${SCRIPT_DIR}/dependency-security-audit.sh" ] && pass "존재" || fail "없음"
[ -x "${SCRIPT_DIR}/dependency-security-audit.sh" ] && pass "실행 가능" || fail "실행 불가"

# T2
echo ""
echo "T2: 도움말"
bash "${SCRIPT_DIR}/dependency-security-audit.sh" --help 2>&1 | grep -q "사용법" && pass "도움말" || fail "도움말"

# T3: 전체 실행
echo ""
echo "T3: 전체 감사"
OUTPUT=$(bash "${SCRIPT_DIR}/dependency-security-audit.sh" 2>&1 || true)
echo "${OUTPUT}" | grep -q "취약점 스캔" && pass "섹션 1: 취약점" || fail "섹션 1"
echo "${OUTPUT}" | grep -q "라이선스" && pass "섹션 2: 라이선스" || fail "섹션 2"
echo "${OUTPUT}" | grep -q "업데이트" && pass "섹션 3: 업데이트" || fail "섹션 3"
echo "${OUTPUT}" | grep -q "공급망 보안" && pass "섹션 4: 공급망" || fail "섹션 4"
echo "${OUTPUT}" | grep -q "감사 요약" && pass "요약" || fail "요약"

# T4: 개별 체크
echo ""
echo "T4: 개별 체크"
for check in vulns licenses outdated supply-chain; do
    CHK=$(bash "${SCRIPT_DIR}/dependency-security-audit.sh" --check "${check}" 2>&1 || true)
    echo "${CHK}" | grep -q "감사 요약\|PASS\|WARN\|FAIL" && pass "--check ${check}" || fail "--check ${check}"
done

# T5: 감사 로그
echo ""
echo "T5: 감사 로그"
grep -q "dependency-security-audit" "${PROJECT_ROOT}/.claude/audit.jsonl" 2>/dev/null && pass "감사 로그" || fail "감사 로그"

echo ""
echo "============================================"
TOTAL=$((PASS + FAIL))
echo "  전체: ${TOTAL} | PASS: ${PASS} | FAIL: ${FAIL}"
[ ${FAIL} -eq 0 ] && echo -e "  \033[0;32m결과: ALL PASS\033[0m" || echo -e "  \033[0;31m결과: ${FAIL}건 실패\033[0m"
[ ${FAIL} -eq 0 ] && exit 0 || exit 1
