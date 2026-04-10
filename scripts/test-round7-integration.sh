#!/usr/bin/env bash
# =============================================================================
# 모니터링 Round 7 최종 통합 검증
# Design Ref: MTU-N100
# Plan SC: FR-N100.1 ~ FR-N100.4
#
# 모든 Round 7 테스트를 일괄 실행하고 최종 결과를 집계합니다.
# =============================================================================
set -euo pipefail

TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_TESTS=0
MTU_RESULTS=()

run_test() {
  local mtu="$1"
  local script="$2"
  local description="$3"

  echo ""
  echo "################################################################"
  echo "  $mtu: $description"
  echo "################################################################"

  if [ ! -f "$script" ]; then
    echo "  [SKIP] 스크립트 없음: $script"
    MTU_RESULTS+=("$mtu|$description|SKIP|0|0")
    return
  fi

  local output
  local exit_code=0
  output=$(bash "$script" 2>&1) || exit_code=$?

  # 결과 추출
  local pass_count=$(echo "$output" | grep -c "\[PASS\]" || echo 0)
  local fail_count=$(echo "$output" | grep -c "\[FAIL\]" || echo 0)

  TOTAL_PASS=$((TOTAL_PASS + pass_count))
  TOTAL_FAIL=$((TOTAL_FAIL + fail_count))
  TOTAL_TESTS=$((TOTAL_TESTS + pass_count + fail_count))

  # 마지막 결과 줄 출력
  echo "$output" | tail -5

  if [ "$exit_code" -eq 0 ]; then
    MTU_RESULTS+=("$mtu|$description|PASS|$pass_count|$fail_count")
  else
    MTU_RESULTS+=("$mtu|$description|FAIL|$pass_count|$fail_count")
  fi
}

echo "================================================================"
echo "  모니터링 Round 7 최종 통합 검증"
echo "  날짜: $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================================"

# Round 7 전체 테스트 실행
run_test "MTU-N89" "scripts/test-victoriametrics.sh" "VictoriaMetrics 저장소"
run_test "MTU-N90" "scripts/test-grafana-performance.sh" "Grafana 성능 최적화"
run_test "MTU-N91" "scripts/test-alert-noise-reduction.sh" "알림 노이즈 감소"
run_test "MTU-N92" "scripts/test-anomaly-detection.sh" "AI 이상 탐지"
run_test "MTU-N93" "scripts/test-predictive-scaling.sh" "예측적 스케일링"
run_test "MTU-N94" "scripts/test-runbook-automation.sh" "Runbook 자동화"
run_test "MTU-N95" "scripts/test-incident-classification.sh" "인시던트 분류"
run_test "MTU-N96" "scripts/test-multitenant-monitoring.sh" "멀티테넌트 모니터링"
run_test "MTU-N97" "scripts/test-finops-dashboard.sh" "FinOps 대시보드"
run_test "MTU-N98" "scripts/test-monitoring-round7-e2e.sh" "E2E 통합 테스트"
run_test "MTU-N99" "scripts/test-csap-audit-monitoring.sh" "CSAP 감사 모니터링"

# 아카이브 상태 검증
echo ""
echo "################################################################"
echo "  아카이브 상태 검증"
echo "################################################################"
ARCHIVE_PASS=0
ARCHIVE_TOTAL=0
for mtu in N89 N90 N91 N92 N93 N94 N95 N96 N97 N98 N99; do
  ARCHIVE_TOTAL=$((ARCHIVE_TOTAL + 1))
  ARCHIVE_DIR=$(ls -d docs/archive/2026-04/MTU-${mtu}-* 2>/dev/null | head -1)
  if [ -n "$ARCHIVE_DIR" ] && [ -d "$ARCHIVE_DIR" ]; then
    echo "  [PASS] MTU-${mtu} 아카이브 존재: $(basename "$ARCHIVE_DIR")"
    ARCHIVE_PASS=$((ARCHIVE_PASS + 1))
    TOTAL_PASS=$((TOTAL_PASS + 1))
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
  else
    echo "  [FAIL] MTU-${mtu} 아카이브 누락"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
  fi
done

# =============================================================================
# 최종 결과
# =============================================================================
echo ""
echo "================================================================"
echo "================================================================"
echo ""
echo "  모니터링 Round 7 최종 통합 검증 결과"
echo ""
echo "================================================================"
echo ""
printf "  %-10s %-30s %-8s %-6s %-6s\n" "MTU" "설명" "결과" "PASS" "FAIL"
echo "  -----------------------------------------------------------"
for result in "${MTU_RESULTS[@]}"; do
  IFS='|' read -r mtu desc status pass fail <<< "$result"
  printf "  %-10s %-30s %-8s %-6s %-6s\n" "$mtu" "$desc" "$status" "$pass" "$fail"
done
echo "  -----------------------------------------------------------"
echo "  아카이브 검증: ${ARCHIVE_PASS}/${ARCHIVE_TOTAL} 완료"
echo ""
echo "================================================================"
echo "  전체 PASS: $TOTAL_PASS"
echo "  전체 FAIL: $TOTAL_FAIL"
echo "  전체 TOTAL: $TOTAL_TESTS"
echo "  전체 RATE: $(( TOTAL_PASS * 100 / TOTAL_TESTS ))%"
echo "================================================================"

if [ "$TOTAL_FAIL" -gt 0 ]; then exit 1; fi
