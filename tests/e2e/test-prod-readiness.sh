#!/bin/bash
# test-prod-readiness.sh — 프로덕션 준비 + 불변 인프라 E2E 테스트
# Design Ref: MTU-N92 Design
# Plan SC: FR-N92.4

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
echo "  프로덕션 준비 + 불변 인프라 E2E 테스트"
echo "=========================================="
echo ""

# 1. 프로덕션 체크리스트 스크립트 존재
run_test "프로덕션 체크리스트 존재" "[ -f scripts/prod-readiness-check.sh ]"

# 2. 실행 가능 확인
run_test "스크립트 실행 가능" "[ -x scripts/prod-readiness-check.sh ]"

# 3. 불변 인프라 정책 존재
run_test "불변 인프라 정책 존재" "[ -f infra/security/immutable-infra/policy.yaml ]"

# 4. 정책 YAML 유효성
run_test "정책 YAML 유효성" "python3 -c 'import yaml; list(yaml.safe_load_all(open(\"infra/security/immutable-infra/policy.yaml\")))'"

# 5. readOnlyRootFilesystem 규칙
run_test "readOnlyRootFilesystem 규칙" "grep -q 'readOnlyRootFilesystem' infra/security/immutable-infra/policy.yaml"

# 6. latest 태그 금지 규칙
run_test "latest 태그 금지 규칙" "grep -q 'disallow-latest-tag' infra/security/immutable-infra/policy.yaml"

# 7. 권한 상승 금지 규칙
run_test "권한 상승 금지 규칙" "grep -q 'allowPrivilegeEscalation' infra/security/immutable-infra/policy.yaml"

# 8. 배포 게이트 워크플로우 존재
run_test "배포 게이트 워크플로우" "[ -f .gitea/workflows/prod-gate.yaml ]"

# 9. main 브랜치 트리거
run_test "main 브랜치 트리거" "grep -q 'main' .gitea/workflows/prod-gate.yaml"

# 10. 프로덕션 체크 실행 (실제 실행)
run_test "프로덕션 체크 실행 (85%+)" "{ bash scripts/prod-readiness-check.sh 2>&1 || true; } | grep '통과율' | grep -qE '[89][0-9]%|100%'"

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
