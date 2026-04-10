#!/bin/bash
# MTU-N141 운영 성숙도 종합 보고서 — 검증 테스트
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PASS=0; FAIL=0

pass() { echo -e "  \033[0;32m[PASS]\033[0m $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  \033[0;31m[FAIL]\033[0m $1"; FAIL=$((FAIL + 1)); }

echo "============================================"
echo "  MTU-N141 운영 성숙도 보고서 테스트"
echo "============================================"
echo ""

# T1
echo "T1: 스크립트"
[ -f "${SCRIPT_DIR}/platform-maturity-report.sh" ] && pass "존재" || fail "없음"
[ -x "${SCRIPT_DIR}/platform-maturity-report.sh" ] && pass "실행 가능" || fail "실행 불가"

# T2
echo ""
echo "T2: 도움말"
bash "${SCRIPT_DIR}/platform-maturity-report.sh" --help 2>&1 | grep -q "사용법" && pass "도움말" || fail "도움말"

# T3: 전체 실행
echo ""
echo "T3: 전체 보고서"
OUTPUT=$(bash "${SCRIPT_DIR}/platform-maturity-report.sh" 2>&1 || true)
echo "${OUTPUT}" | grep -q "모니터링" && pass "영역 1: 모니터링" || fail "영역 1"
echo "${OUTPUT}" | grep -q "인시던트" && pass "영역 2: 인시던트" || fail "영역 2"
echo "${OUTPUT}" | grep -q "변경 관리" && pass "영역 3: 변경 관리" || fail "영역 3"
echo "${OUTPUT}" | grep -q "보안" && pass "영역 4: 보안" || fail "영역 4"
echo "${OUTPUT}" | grep -q "FinOps" && pass "영역 5: FinOps" || fail "영역 5"
echo "${OUTPUT}" | grep -q "재해 복구" && pass "영역 6: DR" || fail "영역 6"
echo "${OUTPUT}" | grep -q "자동화" && pass "영역 7: 자동화" || fail "영역 7"

# T4: 종합 결과
echo ""
echo "T4: 종합 결과"
echo "${OUTPUT}" | grep -q "성숙도 종합 결과" && pass "종합 결과" || fail "종합 결과"
echo "${OUTPUT}" | grep -q "종합 성숙도" && pass "종합 점수" || fail "종합 점수"
echo "${OUTPUT}" | grep -q "개선 권고" && pass "개선 권고" || fail "개선 권고"

# T5: 영역별 실행
echo ""
echo "T5: 영역별 실행"
for area in monitoring incident change security finops dr automation; do
    AREA_OUT=$(bash "${SCRIPT_DIR}/platform-maturity-report.sh" --area "${area}" 2>&1 || true)
    echo "${AREA_OUT}" | grep -q "성숙도\|종합\|단계" && pass "--area ${area}" || fail "--area ${area}"
done

# T6: 감사 로그
echo ""
echo "T6: 감사 로그"
grep -q "platform-maturity-report" "${PROJECT_ROOT}/.claude/audit.jsonl" 2>/dev/null && pass "감사 로그" || fail "감사 로그"

echo ""
echo "============================================"
TOTAL=$((PASS + FAIL))
echo "  전체: ${TOTAL} | PASS: ${PASS} | FAIL: ${FAIL}"
[ ${FAIL} -eq 0 ] && echo -e "  \033[0;32m결과: ALL PASS\033[0m" || echo -e "  \033[0;31m결과: ${FAIL}건 실패\033[0m"
[ ${FAIL} -eq 0 ] && exit 0 || exit 1
