#!/bin/bash
# =============================================================================
# 2라운드 CI/CD 고도화 통합 검증 스크립트
# Design Ref: MTU-N52
# Plan SC: 전체 N45~N51 통합 검증
#
# 모든 MTU 테스트 스크립트를 순차 실행하고 결과를 집계합니다.
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_SKIP=0
MTU_PASS=0
MTU_FAIL=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=========================================================="
echo " 2라운드 CI/CD 고도화 통합 검증"
echo " 날짜: $(date +%Y-%m-%d)"
echo "=========================================================="

run_test() {
    local MTU_ID="$1"
    local DESC="$2"
    local SCRIPT="$3"

    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE} ${MTU_ID}: ${DESC}${NC}"
    echo -e "${BLUE}============================================${NC}"

    if [ ! -f "$SCRIPT_DIR/$SCRIPT" ]; then
        echo -e "${RED}  스크립트 없음: $SCRIPT${NC}"
        ((MTU_FAIL++)) || true
        return
    fi

    local OUTPUT
    OUTPUT=$(bash "$SCRIPT_DIR/$SCRIPT" 2>&1)
    local EXIT_CODE=$?

    # PASS/FAIL/SKIP 카운트 추출
    local P=$(echo "$OUTPUT" | grep -oP 'PASS[^:]*: \K\d+' | tail -1 || echo "0")
    local F=$(echo "$OUTPUT" | grep -oP 'FAIL[^:]*: \K\d+' | tail -1 || echo "0")
    local S=$(echo "$OUTPUT" | grep -oP 'SKIP[^:]*: \K\d+' | tail -1 || echo "0")

    TOTAL_PASS=$((TOTAL_PASS + ${P:-0}))
    TOTAL_FAIL=$((TOTAL_FAIL + ${F:-0}))
    TOTAL_SKIP=$((TOTAL_SKIP + ${S:-0}))

    if [ "$EXIT_CODE" -eq 0 ]; then
        echo -e "${GREEN}  ${MTU_ID}: ALL PASS (${P:-0} pass, ${F:-0} fail, ${S:-0} skip)${NC}"
        ((MTU_PASS++)) || true
    else
        echo -e "${RED}  ${MTU_ID}: FAILED (${P:-0} pass, ${F:-0} fail, ${S:-0} skip)${NC}"
        ((MTU_FAIL++)) || true
    fi
}

# =========================================================================
# 개별 MTU 테스트 실행
# =========================================================================
run_test "MTU-N45" "Falco 런타임 보안" "test-falco-runtime.sh"
run_test "MTU-N46" "SLSA L3 빌드 증명" "test-slsa-provenance.sh"
run_test "MTU-N47" "Flux Drift Detection" "test-drift-detection.sh"
run_test "MTU-N48" "분산 추적 (Tempo)" "test-distributed-tracing.sh"
run_test "MTU-N49" "SLO/SLI 자동화" "test-slo-automation.sh"
run_test "MTU-N50" "카오스 엔지니어링" "test-chaos-engineering.sh"
run_test "MTU-N51" "Matrix Build 최적화" "test-matrix-build.sh"

# =========================================================================
# 최종 결과
# =========================================================================
TOTAL=$((TOTAL_PASS + TOTAL_FAIL + TOTAL_SKIP))

echo ""
echo "=========================================================="
echo " 2라운드 CI/CD 고도화 통합 검증 최종 결과"
echo "=========================================================="
echo -e " MTU 수: 7개"
echo -e " MTU 통과: ${GREEN}${MTU_PASS}${NC}개"
echo -e " MTU 실패: ${RED}${MTU_FAIL}${NC}개"
echo "----------------------------------------------------------"
echo -e " 전체 테스트: ${TOTAL}건"
echo -e " ${GREEN}PASS${NC}: ${TOTAL_PASS}건"
echo -e " ${RED}FAIL${NC}: ${TOTAL_FAIL}건"
echo -e " ${YELLOW}SKIP${NC}: ${TOTAL_SKIP}건"
echo "=========================================================="

if [ "$MTU_FAIL" -eq 0 ]; then
    echo -e "${GREEN}ALL MTU TESTS PASSED — 2라운드 완료${NC}"
    exit 0
else
    echo -e "${RED}${MTU_FAIL} MTU FAILED${NC}"
    exit 1
fi
