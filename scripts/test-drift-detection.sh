#!/bin/bash
# =============================================================================
# Flux Drift Detection 테스트 스크립트
# Design Ref: MTU-N47 Design
# Plan SC: FR-N47.7
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PASS=0
FAIL=0
SKIP=0
TOTAL=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_test()  { echo -e "\n${BLUE}[TEST $((++TOTAL))]${NC} $1"; }
log_pass()  { echo -e "${GREEN}  [PASS]${NC} $1"; ((PASS++)) || true; }
log_fail()  { echo -e "${RED}  [FAIL]${NC} $1"; ((FAIL++)) || true; }
log_skip()  { echo -e "${YELLOW}  [SKIP]${NC} $1"; ((SKIP++)) || true; }

echo "========================================="
echo " MTU-N47: Flux Drift Detection 테스트"
echo "========================================="

# Phase 1: 산출물 존재 확인
log_test "Production drift detection 패치 존재"
if [ -f "$PROJECT_DIR/infra/flux/drift-detection/helmrelease-patch-prod.yaml" ]; then
    log_pass "helmrelease-patch-prod.yaml 존재"
else
    log_fail "파일 없음"
fi

log_test "Staging drift detection 패치 존재"
if [ -f "$PROJECT_DIR/infra/flux/drift-detection/helmrelease-patch-stg.yaml" ]; then
    log_pass "helmrelease-patch-stg.yaml 존재"
else
    log_fail "파일 없음"
fi

log_test "Dev drift detection 패치 존재"
if [ -f "$PROJECT_DIR/infra/flux/drift-detection/helmrelease-patch-dev.yaml" ]; then
    log_pass "helmrelease-patch-dev.yaml 존재"
else
    log_fail "파일 없음"
fi

log_test "알림 규칙 파일 존재"
if [ -f "$PROJECT_DIR/infra/flux/drift-detection/alerting-rules.yaml" ]; then
    log_pass "alerting-rules.yaml 존재"
else
    log_fail "파일 없음"
fi

log_test "Grafana 대시보드 존재"
if [ -f "$PROJECT_DIR/infra/monitoring/dashboards/flux-drift-detection.json" ]; then
    log_pass "flux-drift-detection.json 존재"
else
    log_fail "파일 없음"
fi

log_test "운영 가이드 존재"
if [ -f "$PROJECT_DIR/docs/operations/drift-detection-guide.md" ]; then
    log_pass "drift-detection-guide.md 존재"
else
    log_fail "파일 없음"
fi

# Phase 2: 설정 내용 검증
log_test "Production: drift mode = enabled"
if grep -q "mode: enabled" "$PROJECT_DIR/infra/flux/drift-detection/helmrelease-patch-prod.yaml"; then
    log_pass "Production drift mode: enabled"
else
    log_fail "Production drift mode 설정 없음"
fi

log_test "Staging: drift mode = warn"
if grep -q "mode: warn" "$PROJECT_DIR/infra/flux/drift-detection/helmrelease-patch-stg.yaml"; then
    log_pass "Staging drift mode: warn"
else
    log_fail "Staging drift mode 설정 없음"
fi

log_test "Dev: drift mode = disabled"
if grep -q "mode: disabled" "$PROJECT_DIR/infra/flux/drift-detection/helmrelease-patch-dev.yaml"; then
    log_pass "Dev drift mode: disabled"
else
    log_fail "Dev drift mode 설정 없음"
fi

log_test "Production interval 5분 설정"
if grep -q "interval: 5m" "$PROJECT_DIR/infra/flux/drift-detection/helmrelease-patch-prod.yaml"; then
    log_pass "5분 interval 설정됨"
else
    log_fail "interval 설정 없음"
fi

log_test "Replica drift 무시 설정"
if grep -q "/spec/replicas" "$PROJECT_DIR/infra/flux/drift-detection/helmrelease-patch-prod.yaml"; then
    log_pass "replica drift 무시 설정됨"
else
    log_fail "replica drift 무시 없음"
fi

log_test "Production force: true 설정"
if grep -q "force: true" "$PROJECT_DIR/infra/flux/drift-detection/helmrelease-patch-prod.yaml"; then
    log_pass "force: true 설정됨"
else
    log_fail "force: true 없음"
fi

# Phase 3: 알림 규칙 검증
log_test "FluxDriftDetected 알림 존재"
if grep -q "FluxDriftDetected" "$PROJECT_DIR/infra/flux/drift-detection/alerting-rules.yaml"; then
    log_pass "FluxDriftDetected 알림 정의됨"
else
    log_fail "알림 누락"
fi

log_test "FluxReconcileFailure 알림 존재"
if grep -q "FluxReconcileFailure" "$PROJECT_DIR/infra/flux/drift-detection/alerting-rules.yaml"; then
    log_pass "FluxReconcileFailure 알림 정의됨"
else
    log_fail "알림 누락"
fi

log_test "FluxControllerDown 알림 존재"
if grep -q "FluxControllerDown" "$PROJECT_DIR/infra/flux/drift-detection/alerting-rules.yaml"; then
    log_pass "FluxControllerDown 알림 정의됨"
else
    log_fail "알림 누락"
fi

log_test "CSAP D-06 라벨 확인"
if grep -q "csap.compliance/domain" "$PROJECT_DIR/infra/flux/drift-detection/alerting-rules.yaml"; then
    log_pass "CSAP 라벨 포함"
else
    log_fail "CSAP 라벨 누락"
fi

# Phase 4: YAML/JSON 구문 검증
log_test "prod 패치 YAML 유효성"
if python3 -c "import yaml; list(yaml.safe_load_all(open('$PROJECT_DIR/infra/flux/drift-detection/helmrelease-patch-prod.yaml')))" 2>/dev/null; then
    log_pass "YAML 유효"
else
    log_fail "YAML 오류"
fi

log_test "stg 패치 YAML 유효성"
if python3 -c "import yaml; list(yaml.safe_load_all(open('$PROJECT_DIR/infra/flux/drift-detection/helmrelease-patch-stg.yaml')))" 2>/dev/null; then
    log_pass "YAML 유효"
else
    log_fail "YAML 오류"
fi

log_test "dev 패치 YAML 유효성"
if python3 -c "import yaml; list(yaml.safe_load_all(open('$PROJECT_DIR/infra/flux/drift-detection/helmrelease-patch-dev.yaml')))" 2>/dev/null; then
    log_pass "YAML 유효"
else
    log_fail "YAML 오류"
fi

log_test "알림 규칙 YAML 유효성"
if python3 -c "import yaml; yaml.safe_load(open('$PROJECT_DIR/infra/flux/drift-detection/alerting-rules.yaml'))" 2>/dev/null; then
    log_pass "YAML 유효"
else
    log_fail "YAML 오류"
fi

log_test "대시보드 JSON 유효성"
if python3 -c "import json; json.load(open('$PROJECT_DIR/infra/monitoring/dashboards/flux-drift-detection.json'))" 2>/dev/null; then
    log_pass "JSON 유효"
else
    log_fail "JSON 오류"
fi

log_test "대시보드 패널 수 확인"
PANEL_COUNT=$(python3 -c "
import json
with open('$PROJECT_DIR/infra/monitoring/dashboards/flux-drift-detection.json') as f:
    d = json.load(f)
    panels = [p for p in d['panels'] if p.get('type') != 'row']
    print(len(panels))
" 2>/dev/null || echo 0)
if [ "$PANEL_COUNT" -ge 5 ]; then
    log_pass "대시보드 패널 ${PANEL_COUNT}개"
else
    log_fail "패널 부족 (${PANEL_COUNT}개)"
fi

# 결과 요약
echo ""
echo "========================================="
echo " Flux Drift Detection 테스트 결과"
echo "========================================="
echo -e " 전체: ${TOTAL}건"
echo -e " ${GREEN}PASS${NC}: ${PASS}건"
echo -e " ${RED}FAIL${NC}: ${FAIL}건"
echo -e " ${YELLOW}SKIP${NC}: ${SKIP}건"
echo "========================================="

if [ "$FAIL" -eq 0 ]; then
    echo -e "${GREEN}ALL TESTS PASSED${NC}"
    exit 0
else
    echo -e "${RED}${FAIL} TESTS FAILED${NC}"
    exit 1
fi
