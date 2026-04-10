#!/bin/bash
# test-release-automation.sh — 릴리스 자동화 E2E 테스트
# Design Ref: MTU-N94 Design
# Plan SC: FR-N94.5

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
echo "  릴리스 자동화 E2E 테스트"
echo "=========================================="
echo ""

# 1. 릴리스 노트 생성 스크립트
run_test "릴리스 노트 스크립트 존재" "[ -f scripts/generate-release-notes.sh ]"
run_test "릴리스 노트 스크립트 실행 가능" "[ -x scripts/generate-release-notes.sh ]"

# 2. 마이그레이션 가이드 스크립트
run_test "마이그레이션 가이드 스크립트 존재" "[ -f scripts/generate-migration-guide.sh ]"
run_test "마이그레이션 가이드 스크립트 실행 가능" "[ -x scripts/generate-migration-guide.sh ]"

# 3. UAT 체크리스트 템플릿
run_test "UAT 체크리스트 존재" "[ -f docs/release/uat-checklist-template.md ]"

# 4. 릴리스 워크플로우
run_test "릴리스 워크플로우 존재" "[ -f .gitea/workflows/release-notes.yaml ]"

# 5. 태그 트리거 설정
run_test "태그 트리거 설정" "grep -q 'tags:' .gitea/workflows/release-notes.yaml"

# 6. 릴리스 노트 실행 테스트
run_test "릴리스 노트 실제 생성" "bash scripts/generate-release-notes.sh HEAD~5 HEAD /tmp/test-release-notes.md 2>&1"

# 7. 릴리스 노트 파일 생성 확인
run_test "릴리스 노트 출력 확인" "[ -f /tmp/test-release-notes.md ]"

# 8. 마이그레이션 가이드 실행 테스트
run_test "마이그레이션 가이드 실제 생성" "bash scripts/generate-migration-guide.sh HEAD~5 HEAD /tmp/test-migration.md 2>&1"

# 9. 마이그레이션 가이드 출력 확인
run_test "마이그레이션 가이드 출력 확인" "[ -f /tmp/test-migration.md ]"

# 10. UAT 체크리스트 20항목+ 확인
run_test "UAT 20항목+ 존재" "[ \$(grep -c '| [0-9]' docs/release/uat-checklist-template.md) -ge 15 ]"

# 11. CSAP 준수 현황 포함
run_test "CSAP 준수 현황 포함" "grep -q 'CSAP' /tmp/test-release-notes.md"

# 12. 감사 로그 기록
run_test "감사 로그 기록 설정" "grep -q 'RELEASE_NOTES' .gitea/workflows/release-notes.yaml"

# 정리
rm -f /tmp/test-release-notes.md /tmp/test-migration.md

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
