#!/usr/bin/env bash
# 10라운드 통합 E2E 테스트
# MTU-N120: 전체 MTU 통합 검증
set -euo pipefail

TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_TESTS=0
MTU_RESULTS=""

run_mtu_test() {
  local mtu_id="$1" test_file="$2"
  echo ""
  echo "=== $mtu_id 테스트 실행 ==="
  if [ -f "$test_file" ]; then
    if bash "$test_file" 2>/dev/null; then
      MTU_RESULTS="${MTU_RESULTS}[PASS] $mtu_id\n"
      TOTAL_PASS=$((TOTAL_PASS + 1))
    else
      MTU_RESULTS="${MTU_RESULTS}[FAIL] $mtu_id\n"
      TOTAL_FAIL=$((TOTAL_FAIL + 1))
    fi
  else
    echo "[SKIP] $test_file 미존재"
    MTU_RESULTS="${MTU_RESULTS}[SKIP] $mtu_id\n"
  fi
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

echo "######################################################"
echo "#  10라운드 통합 E2E 테스트 (N113~N119)              #"
echo "#  $(date '+%Y-%m-%d %H:%M:%S')                      #"
echo "######################################################"

# 각 MTU 테스트 실행
run_mtu_test "MTU-N113 KEDA 오토스케일" "/data/ai-saas/tests/e2e/keda-autoscale.test.sh"
run_mtu_test "MTU-N114 Linkerd 서비스 메시" "/data/ai-saas/tests/e2e/linkerd-mesh.test.sh"
run_mtu_test "MTU-N115 OpenSSF Scorecard CI" "/data/ai-saas/tests/e2e/scorecard-ci.test.sh"
run_mtu_test "MTU-N116 ChatOps 통합" "/data/ai-saas/tests/e2e/chatops.test.sh"
run_mtu_test "MTU-N117 자동 포스트모템" "/data/ai-saas/tests/e2e/auto-postmortem.test.sh"
run_mtu_test "MTU-N118 릴리스 파이프라인 v2" "/data/ai-saas/tests/e2e/release-pipeline-v2.test.sh"
run_mtu_test "MTU-N119 개발자 생산성" "/data/ai-saas/tests/e2e/developer-productivity.test.sh"

# 통합 결과 요약
echo ""
echo "######################################################"
echo "#  10라운드 통합 테스트 결과                          #"
echo "######################################################"
echo ""
echo -e "$MTU_RESULTS"
echo "총 MTU: $TOTAL_TESTS"
echo "통과: $TOTAL_PASS"
echo "실패: $TOTAL_FAIL"
echo "통과율: $(( TOTAL_PASS * 100 / TOTAL_TESTS ))%"
echo ""
echo "######################################################"

if [ "$TOTAL_FAIL" -gt 0 ]; then
  exit 1
fi
