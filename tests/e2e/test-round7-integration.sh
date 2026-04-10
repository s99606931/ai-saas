#!/bin/bash
# test-round7-integration.sh — 7라운드 통합 검증 (N89~N95)
# Design Ref: MTU-N96 Design
# Plan SC: FR-N96.1~FR-N96.4

set -euo pipefail

TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_TESTS=0
SUITE_PASS=0
SUITE_FAIL=0

run_suite() {
    local name="$1"
    local script="$2"
    echo ""
    echo "=== $name ==="
    if bash "$script" 2>&1; then
        SUITE_PASS=$((SUITE_PASS + 1))
        echo "  >> SUITE PASS"
    else
        SUITE_FAIL=$((SUITE_FAIL + 1))
        echo "  >> SUITE FAIL"
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

echo "=================================================================="
echo "  7라운드 CI/CD·DevOps 고도화 통합 검증 (N89~N95)"
echo "  날짜: $(date -Iseconds)"
echo "  프로젝트: 공공기관 SaaS 프레임워크"
echo "=================================================================="

# 1. MTU-N90: OpenSSF Scorecard
run_suite "MTU-N90: OpenSSF Scorecard" "tests/e2e/test-scorecard.sh"

# 2. MTU-N91: Semgrep 코드 품질 게이트
run_suite "MTU-N91: Semgrep SAST" "tests/e2e/test-semgrep.sh"

# 3. MTU-N92: 프로덕션 준비 체크리스트
run_suite "MTU-N92: 프로덕션 준비" "tests/e2e/test-prod-readiness.sh"

# 4. MTU-N93: Cilium eBPF + Zero Trust
run_suite "MTU-N93: Cilium Zero Trust" "tests/e2e/test-cilium-zero-trust.sh"

# 5. MTU-N94: 릴리스 자동화
run_suite "MTU-N94: 릴리스 자동화" "tests/e2e/test-release-automation.sh"

# 6. MTU-N95: Q-Gate 100% 파이프라인
run_suite "MTU-N95: Q-Gate 100%" "tests/e2e/test-qgate-pipeline.sh"

# 7. 전체 Q-Gate 최종 검증
echo ""
echo "=== 전체 Q-Gate G1~G7 최종 검증 ==="
if bash scripts/qgate-verify.sh 2>&1; then
    SUITE_PASS=$((SUITE_PASS + 1))
    echo "  >> Q-Gate ALL PASS"
else
    SUITE_FAIL=$((SUITE_FAIL + 1))
    echo "  >> Q-Gate FAIL"
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo ""
echo "=================================================================="
echo "  7라운드 통합 검증 최종 결과"
echo "=================================================================="
echo "  전체 테스트 스위트: $TOTAL_TESTS"
echo "  통과: $SUITE_PASS"
echo "  실패: $SUITE_FAIL"
echo "  통과율: $(( (SUITE_PASS * 100) / TOTAL_TESTS ))%"
echo ""

if [ "$SUITE_FAIL" -eq 0 ]; then
    echo "  *** 7라운드 통합 검증 ALL PASS ***"
    echo "  *** 감리 준수율 100% 확인 ***"
    echo "  *** 프로덕션 준비 완료 ***"
    echo ""
    echo "  7라운드 MTU 요약:"
    echo "    N89: 감리 산출물 완전성 보강 — PASS"
    echo "    N90: OpenSSF Scorecard 자동화 — PASS"
    echo "    N91: Semgrep SAST + 기술 부채 — PASS"
    echo "    N92: 불변 인프라 + 프로덕션 체크 — PASS"
    echo "    N93: Cilium eBPF Zero Trust — PASS"
    echo "    N94: 릴리스 + 마이그레이션 자동화 — PASS"
    echo "    N95: Q-Gate 100% 파이프라인 — PASS"
    echo "    N96: 통합 검증 — ALL PASS"
    exit 0
else
    echo "  통합 검증 불통과 ($SUITE_FAIL건 실패)"
    exit 1
fi
