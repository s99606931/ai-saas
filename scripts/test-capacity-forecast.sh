#!/bin/bash
# ============================================================================
# MTU-N135 용량 예측 자동화 — 검증 테스트
# Plan SC: FR-N135.5
# Design Ref: MTU-N135 Design
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RULES_FILE="${PROJECT_ROOT}/infra/monitoring/capacity-forecast-rules.yaml"

PASS=0
FAIL=0
SKIP=0

pass() { echo -e "  \033[0;32m[PASS]\033[0m $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  \033[0;31m[FAIL]\033[0m $1"; FAIL=$((FAIL + 1)); }
skip() { echo -e "  \033[1;33m[SKIP]\033[0m $1"; SKIP=$((SKIP + 1)); }

echo "============================================"
echo "  MTU-N135 용량 예측 자동화 테스트"
echo "============================================"
echo ""

# T1: 스크립트 존재 및 실행 가능
echo "T1: 스크립트 존재 및 실행 가능"
if [ -f "${SCRIPT_DIR}/capacity-forecast.sh" ]; then
    pass "capacity-forecast.sh 존재"
else
    fail "capacity-forecast.sh 없음"
fi
if [ -x "${SCRIPT_DIR}/capacity-forecast.sh" ]; then
    pass "실행 권한 있음"
else
    fail "실행 권한 없음"
fi

# T2: Recording Rules 파일 존재 + YAML 유효
echo ""
echo "T2: Recording Rules 파일 검증"
if [ -f "${RULES_FILE}" ]; then
    pass "capacity-forecast-rules.yaml 존재"
    if python3 -c "import yaml; yaml.safe_load(open('${RULES_FILE}'))" 2>/dev/null; then
        pass "YAML 구문 유효"
    else
        fail "YAML 구문 오류"
    fi
else
    fail "capacity-forecast-rules.yaml 없음"
fi

# T3: 필수 Recording Rules 정의 확인
echo ""
echo "T3: 필수 Recording Rules 정의 확인"
REQUIRED_RULES=(
    "capacity_forecast:cpu:14d_usage_ratio"
    "capacity_forecast:cpu:30d_usage_ratio"
    "capacity_forecast:memory:14d_usage_ratio"
    "capacity_forecast:memory:30d_usage_ratio"
    "capacity_forecast:disk:14d_avail_ratio"
    "capacity_forecast:disk:30d_avail_ratio"
    "capacity_forecast:cpu:current_usage_ratio"
    "capacity_forecast:memory:current_usage_ratio"
    "capacity_forecast:disk:current_avail_ratio"
)

for rule in "${REQUIRED_RULES[@]}"; do
    if grep -q "record: ${rule}" "${RULES_FILE}"; then
        pass "Recording Rule: ${rule}"
    else
        fail "Recording Rule 누락: ${rule}"
    fi
done

# T4: 경고 알림 정의 확인
echo ""
echo "T4: 경고 알림 정의 확인"
REQUIRED_ALERTS=(
    "CpuCapacityWarning14d"
    "CpuCapacityCritical14d"
    "MemoryCapacityWarning14d"
    "MemoryCapacityCritical14d"
    "DiskCapacityWarning30d"
    "DiskCapacityCritical30d"
)

for alert in "${REQUIRED_ALERTS[@]}"; do
    if grep -q "alert: ${alert}" "${RULES_FILE}"; then
        pass "알림 정의: ${alert}"
    else
        fail "알림 누락: ${alert}"
    fi
done

# T5: predict_linear 함수 사용 확인
echo ""
echo "T5: predict_linear 함수 사용 확인"
PREDICT_COUNT=$(grep -c "predict_linear" "${RULES_FILE}" || echo "0")
if [ "${PREDICT_COUNT}" -ge 6 ]; then
    pass "predict_linear ${PREDICT_COUNT}회 사용 (6회 이상)"
else
    fail "predict_linear ${PREDICT_COUNT}회 (6회 미만)"
fi

# T6: 보고서 스크립트 실행
echo ""
echo "T6: 보고서 스크립트 실행"
REPORT_OUTPUT=$(bash "${SCRIPT_DIR}/capacity-forecast.sh" 2>&1 || true)

if echo "${REPORT_OUTPUT}" | grep -q "현재 용량 현황"; then
    pass "섹션 1: 현재 용량 현황"
else
    fail "섹션 1 누락"
fi

if echo "${REPORT_OUTPUT}" | grep -q "14일 예측"; then
    pass "섹션 2: 14일 예측"
else
    fail "섹션 2 누락"
fi

if echo "${REPORT_OUTPUT}" | grep -q "30일 예측"; then
    pass "섹션 3: 30일 예측"
else
    fail "섹션 3 누락"
fi

if echo "${REPORT_OUTPUT}" | grep -q "증설 권고"; then
    pass "섹션 4: 증설 권고"
else
    fail "섹션 4 누락"
fi

if echo "${REPORT_OUTPUT}" | grep -q "예측 인프라 검증"; then
    pass "섹션 5: 인프라 검증"
else
    fail "섹션 5 누락"
fi

# T7: 감사 로그 기록
echo ""
echo "T7: 감사 로그 기록"
if grep -q "capacity-forecast" "${PROJECT_ROOT}/.claude/audit.jsonl" 2>/dev/null; then
    pass "감사 로그 기록 존재"
else
    fail "감사 로그 기록 없음"
fi

# 결과 요약
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
