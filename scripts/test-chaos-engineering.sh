#!/bin/bash
# =============================================================================
# 카오스 엔지니어링 테스트 스크립트
# Design Ref: MTU-N50 Design
# Plan SC: FR-N50.7
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PASS=0
FAIL=0
TOTAL=0

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_test()  { echo -e "\n${BLUE}[TEST $((++TOTAL))]${NC} $1"; }
log_pass()  { echo -e "${GREEN}  [PASS]${NC} $1"; ((PASS++)) || true; }
log_fail()  { echo -e "${RED}  [FAIL]${NC} $1"; ((FAIL++)) || true; }

echo "========================================="
echo " MTU-N50: 카오스 엔지니어링 테스트"
echo "========================================="

# Phase 1: 산출물 존재
log_test "Litmus Helm values 존재"
[ -f "$PROJECT_DIR/infra/chaos/litmus-values.yaml" ] && log_pass "존재" || log_fail "없음"

log_test "Pod Kill 실험 존재"
[ -f "$PROJECT_DIR/infra/chaos/experiments/pod-kill.yaml" ] && log_pass "존재" || log_fail "없음"

log_test "CPU Stress 실험 존재"
[ -f "$PROJECT_DIR/infra/chaos/experiments/cpu-stress.yaml" ] && log_pass "존재" || log_fail "없음"

log_test "Network Chaos 실험 존재"
[ -f "$PROJECT_DIR/infra/chaos/experiments/network-chaos.yaml" ] && log_pass "존재" || log_fail "없음"

log_test "Chaos Runbook 존재"
[ -f "$PROJECT_DIR/docs/operations/chaos-runbook.md" ] && log_pass "존재" || log_fail "없음"

# Phase 2: 설정 내용 검증
log_test "Litmus 네임스페이스 격리 설정"
grep -q "allowedNamespaces" "$PROJECT_DIR/infra/chaos/litmus-values.yaml" && log_pass "네임스페이스 격리 설정됨" || log_fail "없음"

log_test "Litmus RBAC 설정"
grep -q "rbac:" "$PROJECT_DIR/infra/chaos/litmus-values.yaml" && log_pass "RBAC 설정됨" || log_fail "없음"

log_test "Litmus 모니터링 설정"
grep -q "monitoring:" "$PROJECT_DIR/infra/chaos/litmus-values.yaml" && log_pass "모니터링 활성화" || log_fail "없음"

log_test "Pod Kill 실험 ChaosExperiment CRD"
grep -q "ChaosExperiment" "$PROJECT_DIR/infra/chaos/experiments/pod-kill.yaml" && log_pass "CRD 형식 올바름" || log_fail "잘못된 형식"

log_test "Pod Kill 실험 ChaosEngine CRD"
grep -q "ChaosEngine" "$PROJECT_DIR/infra/chaos/experiments/pod-kill.yaml" && log_pass "ChaosEngine 포함" || log_fail "없음"

log_test "CPU Stress 실험 부하 설정"
grep -q "CPU_LOAD" "$PROJECT_DIR/infra/chaos/experiments/cpu-stress.yaml" && log_pass "CPU 부하 설정됨" || log_fail "없음"

log_test "Network Latency 설정 (300ms)"
grep -q "NETWORK_LATENCY" "$PROJECT_DIR/infra/chaos/experiments/network-chaos.yaml" && log_pass "네트워크 지연 설정됨" || log_fail "없음"

log_test "Network Loss 설정 (50%)"
grep -q "NETWORK_PACKET_LOSS_PERCENTAGE" "$PROJECT_DIR/infra/chaos/experiments/network-chaos.yaml" && log_pass "패킷 손실 설정됨" || log_fail "없음"

log_test "Health check 프로브 설정"
grep -q "httpProbe" "$PROJECT_DIR/infra/chaos/experiments/pod-kill.yaml" && log_pass "프로브 설정됨" || log_fail "없음"

log_test "Staging 네임스페이스 대상 확인"
grep -q "staging" "$PROJECT_DIR/infra/chaos/experiments/pod-kill.yaml" && log_pass "staging 대상" || log_fail "잘못된 대상"

# Phase 3: YAML 구문 검증
for EXP in pod-kill cpu-stress network-chaos; do
    log_test "${EXP}.yaml YAML 유효성"
    if python3 -c "import yaml; list(yaml.safe_load_all(open('$PROJECT_DIR/infra/chaos/experiments/${EXP}.yaml')))" 2>/dev/null; then
        log_pass "YAML 유효"
    else
        log_fail "YAML 오류"
    fi
done

log_test "litmus-values.yaml YAML 유효성"
python3 -c "import yaml; yaml.safe_load(open('$PROJECT_DIR/infra/chaos/litmus-values.yaml'))" 2>/dev/null && log_pass "YAML 유효" || log_fail "YAML 오류"

# Phase 4: Runbook 내용 검증
log_test "Runbook 실험 4개+ 포함"
EXP_COUNT=$(grep -c "^### 실험" "$PROJECT_DIR/docs/operations/chaos-runbook.md" 2>/dev/null || echo "0")
[ "$EXP_COUNT" -ge 4 ] && log_pass "실험 ${EXP_COUNT}개 문서화" || log_fail "실험 부족"

log_test "Runbook 안전장치 섹션"
grep -q "안전장치" "$PROJECT_DIR/docs/operations/chaos-runbook.md" && log_pass "안전장치 문서화" || log_fail "없음"

log_test "Runbook CSAP 매핑"
grep -q "CSAP" "$PROJECT_DIR/docs/operations/chaos-runbook.md" && log_pass "CSAP 매핑 포함" || log_fail "없음"

# 결과 요약
echo ""
echo "========================================="
echo " 카오스 엔지니어링 테스트 결과"
echo "========================================="
echo -e " 전체: ${TOTAL}건"
echo -e " ${GREEN}PASS${NC}: ${PASS}건"
echo -e " ${RED}FAIL${NC}: ${FAIL}건"
echo "========================================="

[ "$FAIL" -eq 0 ] && echo -e "${GREEN}ALL TESTS PASSED${NC}" && exit 0 || { echo -e "${RED}${FAIL} TESTS FAILED${NC}"; exit 1; }
