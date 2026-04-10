#!/bin/bash
# test-round8-integration.sh -- 8라운드 통합 검증 (N97~N103)
# Design Ref: MTU-N104 Design
# Plan SC: FR-N104.1~FR-N104.4
set -euo pipefail

SUITE_PASS=0
SUITE_FAIL=0
TOTAL_TESTS=0

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
echo "  8라운드 엔터프라이즈 성숙도 고도화 통합 검증 (N97~N103)"
echo "  날짜: $(date -Iseconds)"
echo "  프로젝트: 공공기관 SaaS 프레임워크"
echo "=================================================================="

# 1. MTU-N97: 스토리지 계층화
run_suite "MTU-N97: 스토리지 계층화" "tests/e2e/test-storage-tiering.sh"

# 2. MTU-N98: Cilium 대역폭 관리
run_suite "MTU-N98: Cilium 대역폭" "tests/e2e/test-cilium-bandwidth.sh"

# 3. MTU-N99: Crossplane IaC
run_suite "MTU-N99: Crossplane IaC" "tests/e2e/test-crossplane.sh"

# 4. MTU-N100: Backstage IDP
run_suite "MTU-N100: Backstage IDP" "tests/e2e/test-backstage-idp.sh"

# 5. MTU-N101: Argo Rollouts
run_suite "MTU-N101: Argo Rollouts" "tests/e2e/test-argo-rollouts.sh"

# 6. MTU-N102: Thanos 메트릭
run_suite "MTU-N102: Thanos 메트릭" "tests/e2e/test-thanos-metrics.sh"

# 7. MTU-N103: 시크릿 회전
run_suite "MTU-N103: 시크릿 회전" "tests/e2e/test-secret-rotation.sh"

# 8. 전체 Q-Gate 검증
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
echo "  8라운드 통합 검증 최종 결과"
echo "=================================================================="
echo "  전체 테스트 스위트: $TOTAL_TESTS"
echo "  통과: $SUITE_PASS"
echo "  실패: $SUITE_FAIL"
if [ "$TOTAL_TESTS" -gt 0 ]; then
    echo "  통과율: $(( (SUITE_PASS * 100) / TOTAL_TESTS ))%"
fi
echo ""

if [ "$SUITE_FAIL" -eq 0 ]; then
    echo "  *** 8라운드 통합 검증 ALL PASS ***"
    echo "  *** 감리 준수율 100% 유지 ***"
    echo ""
    echo "  8라운드 MTU 요약:"
    echo "    N97:  스토리지 계층화 (Hot/Warm/Cold) -- PASS"
    echo "    N98:  Cilium 대역폭 + BBR 최적화 -- PASS"
    echo "    N99:  Crossplane IaC 멀티클라우드 -- PASS"
    echo "    N100: Backstage IDP 서비스 카탈로그 -- PASS"
    echo "    N101: Argo Rollouts B/G + A/B -- PASS"
    echo "    N102: Thanos 장기 메트릭 저장소 -- PASS"
    echo "    N103: 시크릿 회전 자동화 -- PASS"
    echo "    N104: 통합 검증 -- ALL PASS"
    exit 0
else
    echo "  통합 검증 불통과 ($SUITE_FAIL건 실패)"
    exit 1
fi
