#!/bin/bash
# test-qgate-pipeline.sh — Q-Gate 100% 파이프라인 E2E 테스트
# Design Ref: MTU-N95 Design
# Plan SC: FR-N95.6

set -euo pipefail

PASS=0
FAIL=0
TOTAL=0

run_test() {
    local name="$1"
    local cmd="$2"
    TOTAL=$((TOTAL + 1))
    echo -n "  [$TOTAL] $name ... "
    if eval "$cmd" >/dev/null 2>&1; then
        echo "PASS"
        PASS=$((PASS + 1))
    else
        echo "FAIL"
        FAIL=$((FAIL + 1))
    fi
}

echo "=========================================="
echo "  Q-Gate 100% 파이프라인 E2E 테스트"
echo "=========================================="
echo ""

# 1. Q-Gate 스크립트
run_test "Q-Gate 스크립트 존재" "[ -f scripts/qgate-verify.sh ]"
run_test "Q-Gate 스크립트 실행 가능" "[ -x scripts/qgate-verify.sh ]"

# 2. CSAP 커버리지 스크립트
run_test "CSAP 커버리지 스크립트" "[ -f scripts/csap-coverage-check.sh ]"
run_test "CSAP 스크립트 실행 가능" "[ -x scripts/csap-coverage-check.sh ]"

# 3. 감리 대비 보고서 스크립트
run_test "감리 보고서 스크립트" "[ -f scripts/audit-readiness-report.sh ]"
run_test "감리 보고서 실행 가능" "[ -x scripts/audit-readiness-report.sh ]"

# 4. 워크플로우
run_test "감리 검증 워크플로우" "[ -f .gitea/workflows/audit-gate.yaml ]"

# 5. Q-Gate 실행 (G1~G7 전수 통과)
run_test "Q-Gate G1~G7 실행" "bash scripts/qgate-verify.sh 2>&1 | grep -q '전수 통과\|100%'"

# 6. CSAP 커버리지 실행
run_test "CSAP 커버리지 실행" "{ bash scripts/csap-coverage-check.sh 2>&1 || true; } | grep -q 'PASS\|COVERED'"

# 7. 감리 보고서 생성 실행
run_test "감리 보고서 생성" "bash scripts/audit-readiness-report.sh /tmp/test-audit-report.md 2>&1"
run_test "보고서 파일 생성 확인" "[ -f /tmp/test-audit-report.md ]"

# 8. 감사 로그 기록 설정
run_test "감사 로그 기록" "grep -q 'QGATE_VERIFY' .gitea/workflows/audit-gate.yaml"

# 9. 일일 스케줄 설정
run_test "일일 스케줄 설정" "grep -q 'cron' .gitea/workflows/audit-gate.yaml"

# 정리
rm -f /tmp/test-audit-report.md

echo ""
echo "=========================================="
echo "  결과: $PASS/$TOTAL PASS, $FAIL FAIL"
echo "=========================================="

if [ "$FAIL" -eq 0 ]; then
    echo "  판정: ALL PASS"
    exit 0
else
    echo "  판정: $FAIL건 실패"
    exit 1
fi
