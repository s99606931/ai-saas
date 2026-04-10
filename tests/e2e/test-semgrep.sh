#!/bin/bash
# test-semgrep.sh — Semgrep + 기술 부채 E2E 테스트
# Design Ref: MTU-N91 Design
# Plan SC: FR-N91.5

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
echo "  Semgrep + 기술 부채 E2E 테스트"
echo "=========================================="
echo ""

# 1. Semgrep 워크플로우 존재
run_test "Semgrep 워크플로우 존재" "[ -f .gitea/workflows/semgrep.yaml ]"

# 2. 커스텀 규칙 파일 존재
run_test "CSAP 커스텀 규칙 존재" "[ -f infra/security/semgrep/rules/csap-public-saas.yaml ]"

# 3. 커스텀 규칙 YAML 유효성
run_test "규칙 YAML 유효성" "python3 -c 'import yaml; yaml.safe_load(open(\"infra/security/semgrep/rules/csap-public-saas.yaml\"))'"

# 4. 규칙 수 확인 (10개+)
run_test "규칙 10개 이상" "[ \$(grep -c '^ *- id:' infra/security/semgrep/rules/csap-public-saas.yaml) -ge 10 ]"

# 5. CSAP D-09 규칙 존재 (하드코딩 시크릿)
run_test "D-09 시크릿 탐지 규칙" "grep -q 'hardcoded-secret' infra/security/semgrep/rules/csap-public-saas.yaml"

# 6. CSAP D-12 규칙 존재 (SQL 주입)
run_test "D-12 SQL 주입 탐지 규칙" "grep -q 'sql-injection' infra/security/semgrep/rules/csap-public-saas.yaml"

# 7. N2SF 데이터 유출 규칙 존재
run_test "N2SF 데이터 유출 규칙" "grep -q 'n2sf-data-leak' infra/security/semgrep/rules/csap-public-saas.yaml"

# 8. 기술 부채 측정 스크립트 존재
run_test "기술 부채 스크립트 존재" "[ -f scripts/tech-debt-measure.sh ]"

# 9. 기술 부채 스크립트 실행 가능
run_test "기술 부채 스크립트 실행 가능" "[ -x scripts/tech-debt-measure.sh ]"

# 10. PR 차단 설정 확인
run_test "PR 차단 로직 설정" "grep -q 'exit 1' .gitea/workflows/semgrep.yaml"

# 11. 감사 로그 기록 설정
run_test "감사 로그 기록" "grep -q 'SEMGREP_SCAN' .gitea/workflows/semgrep.yaml"

# 12. PII 보호 규칙 존재
run_test "PII 보호 규칙 존재" "grep -q 'pii-exposure' infra/security/semgrep/rules/csap-public-saas.yaml"

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
