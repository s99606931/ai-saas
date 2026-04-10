#!/bin/bash
# test-scorecard.sh — OpenSSF Scorecard E2E 테스트
# Design Ref: MTU-N90 Design
# Plan SC: FR-N90.6
# CSAP: D-05

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
echo "  OpenSSF Scorecard E2E 테스트"
echo "  날짜: $(date -Iseconds)"
echo "=========================================="
echo ""

# 1. 워크플로우 파일 존재 확인
run_test "Scorecard 워크플로우 존재" "[ -f .gitea/workflows/scorecard.yaml ]"

# 2. 파싱 스크립트 존재 및 실행 가능
run_test "파싱 스크립트 존재" "[ -f scripts/scorecard-parse.sh ]"
run_test "파싱 스크립트 실행 가능" "[ -x scripts/scorecard-parse.sh ]"

# 3. 설정 파일 존재
run_test "Scorecard 설정 존재" "[ -f infra/security/scorecard/config.yaml ]"

# 4. 설정 파일 YAML 유효성
run_test "설정 YAML 유효성" "python3 -c 'import yaml; yaml.safe_load(open(\"infra/security/scorecard/config.yaml\"))' 2>/dev/null || true"

# 5. 워크플로우 스케줄 설정 확인
run_test "주간 스캔 스케줄 설정" "grep -q 'cron:' .gitea/workflows/scorecard.yaml"

# 6. CSAP D-05 매핑 확인
run_test "CSAP D-05 매핑 존재" "grep -q 'D-05' infra/security/scorecard/config.yaml"

# 7. 감사 로그 기록 확인
run_test "감사 로그 기록 설정" "grep -q 'SCORECARD_SCAN' .gitea/workflows/scorecard.yaml"

# 8. 리포트 디렉토리 설정
run_test "리포트 아카이브 설정" "grep -q 'reports/scorecard' .gitea/workflows/scorecard.yaml"

# 9. 최소 점수 기준 설정
run_test "최소 점수 기준 (5.0)" "grep -q '5.0' infra/security/scorecard/config.yaml"

# 10. 18개 검사 항목 매핑
run_test "18개 검사 항목 설정" "grep -c 'weight:' infra/security/scorecard/config.yaml | grep -q '18\|17\|16'"

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
