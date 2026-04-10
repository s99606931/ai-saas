#!/bin/bash
# ============================================================================
# MTU-N137 운영 런북 인덱스 — 검증 테스트
# Plan SC: FR-N137.5
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

PASS=0
FAIL=0

pass() { echo -e "  \033[0;32m[PASS]\033[0m $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  \033[0;31m[FAIL]\033[0m $1"; FAIL=$((FAIL + 1)); }

echo "============================================"
echo "  MTU-N137 런북 인덱스 테스트"
echo "============================================"
echo ""

# T1: 스크립트 존재 및 실행 가능
echo "T1: 스크립트 존재 및 실행 가능"
if [ -f "${SCRIPT_DIR}/runbook-index.sh" ]; then pass "존재"; else fail "없음"; fi
if [ -x "${SCRIPT_DIR}/runbook-index.sh" ]; then pass "실행 가능"; else fail "실행 불가"; fi

# T2: 도움말 출력
echo ""
echo "T2: 도움말"
if bash "${SCRIPT_DIR}/runbook-index.sh" --help 2>&1 | grep -q "사용법"; then
    pass "도움말 정상"
else
    fail "도움말 실패"
fi

# T3: 전체 인덱스 실행
echo ""
echo "T3: 전체 인덱스"
INDEX_OUTPUT=$(bash "${SCRIPT_DIR}/runbook-index.sh" 2>&1 || true)

if echo "${INDEX_OUTPUT}" | grep -q "런북 목록"; then
    pass "런북 목록 표시"
else
    fail "런북 목록 누락"
fi

if echo "${INDEX_OUTPUT}" | grep -q "runbook-auto-crashloop"; then
    pass "crashloop 런북 인덱싱"
else
    fail "crashloop 런북 누락"
fi

if echo "${INDEX_OUTPUT}" | grep -q "알림-런북 매핑"; then
    pass "매핑 테이블 표시"
else
    fail "매핑 테이블 누락"
fi

# T4: 알림 기반 추천
echo ""
echo "T4: 알림 기반 추천"

for alert in "OOMKilled" "DiskPressure" "CrashLoop" "HighLatency"; do
    REC_OUTPUT=$(bash "${SCRIPT_DIR}/runbook-index.sh" --alert "${alert}" 2>&1 || true)
    if echo "${REC_OUTPUT}" | grep -q "추천"; then
        pass "--alert ${alert} 추천 정상"
    else
        fail "--alert ${alert} 추천 실패"
    fi
done

# T5: 미매핑 알림 처리
echo ""
echo "T5: 미매핑 알림 처리"
UNKNOWN_OUTPUT=$(bash "${SCRIPT_DIR}/runbook-index.sh" --alert "UnknownAlert" 2>&1 || true)
if echo "${UNKNOWN_OUTPUT}" | grep -q "미매핑"; then
    pass "미매핑 알림 안내 정상"
else
    fail "미매핑 알림 처리 실패"
fi

# T6: 런북 상태 검증
echo ""
echo "T6: 런북 상태 검증"
VERIFY_OUTPUT=$(bash "${SCRIPT_DIR}/runbook-index.sh" --verify 2>&1 || true)
if echo "${VERIFY_OUTPUT}" | grep -q "런북 상태 검증"; then
    pass "검증 모드 실행"
else
    fail "검증 모드 실패"
fi
if echo "${VERIFY_OUTPUT}" | grep -q "총:"; then
    pass "검증 결과 요약"
else
    fail "검증 결과 누락"
fi

# T7: 감사 로그
echo ""
echo "T7: 감사 로그"
if grep -q "runbook-index" "${PROJECT_ROOT}/.claude/audit.jsonl" 2>/dev/null; then
    pass "감사 로그 기록"
else
    fail "감사 로그 없음"
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
