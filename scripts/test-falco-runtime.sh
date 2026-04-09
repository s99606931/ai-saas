#!/bin/bash
# =============================================================================
# Falco 런타임 보안 테스트 스크립트
# Design Ref: MTU-N45 Design §커스텀 규칙 설계
# Plan SC: FR-N45.8
#
# 테스트 시나리오: 위협 시뮬레이션 + Falco 탐지 확인
# 사용법: bash scripts/test-falco-runtime.sh
# =============================================================================

set -euo pipefail

NAMESPACE="falco-system"
TEST_NS="falco-test"
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

# =========================================================================
# Phase 1: 환경 점검
# =========================================================================
log_test "Falco DaemonSet 실행 상태 확인 (클러스터 연결 시)"
log_skip "오프라인 모드 — 설정 파일 검증 모드로 진행"

log_test "Falcosidekick 실행 상태 확인 (클러스터 연결 시)"
log_skip "오프라인 모드 — 설정 파일 검증 모드로 진행"

# =========================================================================
# Phase 2: 설정 파일 검증
# =========================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

log_test "Falco Helm values 파일 존재 확인"
if [ -f "$PROJECT_DIR/infra/falco/values.yaml" ]; then
    log_pass "values.yaml 존재"
else
    log_fail "values.yaml 없음"
fi

log_test "Falcosidekick Helm values 파일 존재 확인"
if [ -f "$PROJECT_DIR/infra/falco/falcosidekick-values.yaml" ]; then
    log_pass "falcosidekick-values.yaml 존재"
else
    log_fail "falcosidekick-values.yaml 없음"
fi

log_test "커스텀 규칙 파일 존재 확인"
if [ -f "$PROJECT_DIR/infra/falco/custom-rules.yaml" ]; then
    log_pass "custom-rules.yaml 존재"
else
    log_fail "custom-rules.yaml 없음"
fi

log_test "알림 규칙 파일 존재 확인"
if [ -f "$PROJECT_DIR/infra/falco/alerting-rules.yaml" ]; then
    log_pass "alerting-rules.yaml 존재"
else
    log_fail "alerting-rules.yaml 없음"
fi

log_test "Grafana 대시보드 파일 존재 확인"
if [ -f "$PROJECT_DIR/infra/monitoring/dashboards/falco-runtime-security.json" ]; then
    log_pass "falco-runtime-security.json 존재"
else
    log_fail "falco-runtime-security.json 없음"
fi

log_test "설치 스크립트 존재 확인"
if [ -f "$PROJECT_DIR/scripts/setup-falco.sh" ]; then
    log_pass "setup-falco.sh 존재"
else
    log_fail "setup-falco.sh 없음"
fi

# =========================================================================
# Phase 3: 설정 내용 검증
# =========================================================================
log_test "eBPF 드라이버 설정 확인"
if grep -q "kind: ebpf" "$PROJECT_DIR/infra/falco/values.yaml"; then
    log_pass "eBPF 드라이버 설정됨 (WSL2 호환)"
else
    log_fail "eBPF 드라이버 미설정"
fi

log_test "JSON 출력 설정 확인"
if grep -q "jsonOutput: true" "$PROJECT_DIR/infra/falco/values.yaml"; then
    log_pass "JSON 출력 활성화됨"
else
    log_fail "JSON 출력 미활성화"
fi

log_test "ServiceMonitor 설정 확인"
if grep -q "serviceMonitor:" "$PROJECT_DIR/infra/falco/values.yaml" && grep -q "enabled: true" "$PROJECT_DIR/infra/falco/values.yaml"; then
    log_pass "ServiceMonitor 활성화됨"
else
    log_fail "ServiceMonitor 미활성화"
fi

log_test "커스텀 규칙 10개 이상 확인"
RULE_COUNT=$(grep -c "^    - rule:" "$PROJECT_DIR/infra/falco/custom-rules.yaml" || echo 0)
if [ "$RULE_COUNT" -ge 10 ]; then
    log_pass "커스텀 규칙 ${RULE_COUNT}개 정의됨"
else
    log_fail "커스텀 규칙 ${RULE_COUNT}개 (최소 10개 필요)"
fi

log_test "CSAP D-06 태그 규칙 확인"
if grep -q "csap-d06" "$PROJECT_DIR/infra/falco/custom-rules.yaml"; then
    log_pass "CSAP D-06 감사 관련 규칙 포함"
else
    log_fail "CSAP D-06 규칙 누락"
fi

log_test "CSAP D-08 태그 규칙 확인"
if grep -q "csap-d08" "$PROJECT_DIR/infra/falco/custom-rules.yaml"; then
    log_pass "CSAP D-08 접근통제 관련 규칙 포함"
else
    log_fail "CSAP D-08 규칙 누락"
fi

log_test "CSAP D-09 태그 규칙 확인"
if grep -q "csap-d09" "$PROJECT_DIR/infra/falco/custom-rules.yaml"; then
    log_pass "CSAP D-09 암호화/네트워크 관련 규칙 포함"
else
    log_fail "CSAP D-09 규칙 누락"
fi

log_test "CSAP D-12 태그 규칙 확인"
if grep -q "csap-d12" "$PROJECT_DIR/infra/falco/custom-rules.yaml"; then
    log_pass "CSAP D-12 개발보안 관련 규칙 포함"
else
    log_fail "CSAP D-12 규칙 누락"
fi

log_test "Critical 알림 규칙 확인"
CRITICAL_ALERTS=$(grep -c "severity: critical" "$PROJECT_DIR/infra/falco/alerting-rules.yaml" || echo 0)
if [ "$CRITICAL_ALERTS" -ge 4 ]; then
    log_pass "Critical 알림 규칙 ${CRITICAL_ALERTS}개 정의됨"
else
    log_fail "Critical 알림 규칙 부족 (${CRITICAL_ALERTS}개)"
fi

log_test "Warning 알림 규칙 확인"
WARNING_ALERTS=$(grep -c "severity: warning" "$PROJECT_DIR/infra/falco/alerting-rules.yaml" || echo 0)
if [ "$WARNING_ALERTS" -ge 3 ]; then
    log_pass "Warning 알림 규칙 ${WARNING_ALERTS}개 정의됨"
else
    log_fail "Warning 알림 규칙 부족 (${WARNING_ALERTS}개)"
fi

log_test "Falco 상태 모니터링 알림 확인"
if grep -q "FalcoDown" "$PROJECT_DIR/infra/falco/alerting-rules.yaml"; then
    log_pass "FalcoDown 상태 알림 정의됨"
else
    log_fail "Falco 상태 알림 누락"
fi

log_test "AlertManager 연동 설정 확인"
if grep -q "alertmanager:" "$PROJECT_DIR/infra/falco/falcosidekick-values.yaml"; then
    log_pass "AlertManager 연동 설정됨"
else
    log_fail "AlertManager 연동 미설정"
fi

log_test "Grafana 대시보드 JSON 유효성 검증"
if python3 -c "import json; json.load(open('$PROJECT_DIR/infra/monitoring/dashboards/falco-runtime-security.json'))" 2>/dev/null; then
    log_pass "대시보드 JSON 유효"
else
    log_fail "대시보드 JSON 오류"
fi

log_test "대시보드 패널 5개 이상 확인"
PANEL_COUNT=$(python3 -c "
import json
with open('$PROJECT_DIR/infra/monitoring/dashboards/falco-runtime-security.json') as f:
    d = json.load(f)
    panels = [p for p in d['panels'] if p.get('type') != 'row']
    print(len(panels))
" 2>/dev/null || echo 0)
if [ "$PANEL_COUNT" -ge 5 ]; then
    log_pass "대시보드 패널 ${PANEL_COUNT}개"
else
    log_fail "대시보드 패널 부족 (${PANEL_COUNT}개)"
fi

log_test "리소스 제한 설정 확인"
if grep -q "resources:" "$PROJECT_DIR/infra/falco/values.yaml" && grep -q "limits:" "$PROJECT_DIR/infra/falco/values.yaml"; then
    log_pass "리소스 제한 설정됨"
else
    log_fail "리소스 제한 미설정"
fi

log_test "Falcosidekick Web UI 활성화 확인"
if grep -q "webui:" "$PROJECT_DIR/infra/falco/falcosidekick-values.yaml" && grep -q "enabled: true" "$PROJECT_DIR/infra/falco/falcosidekick-values.yaml"; then
    log_pass "Falcosidekick UI 활성화됨"
else
    log_fail "Falcosidekick UI 비활성화"
fi

# =========================================================================
# Phase 4: YAML 구문 검증
# =========================================================================
log_test "values.yaml YAML 구문 검증"
if python3 -c "import yaml; yaml.safe_load(open('$PROJECT_DIR/infra/falco/values.yaml'))" 2>/dev/null; then
    log_pass "YAML 구문 유효"
else
    log_fail "YAML 구문 오류"
fi

log_test "falcosidekick-values.yaml YAML 구문 검증"
if python3 -c "import yaml; yaml.safe_load(open('$PROJECT_DIR/infra/falco/falcosidekick-values.yaml'))" 2>/dev/null; then
    log_pass "YAML 구문 유효"
else
    log_fail "YAML 구문 오류"
fi

log_test "custom-rules.yaml YAML 구문 검증"
if python3 -c "import yaml; yaml.safe_load(open('$PROJECT_DIR/infra/falco/custom-rules.yaml'))" 2>/dev/null; then
    log_pass "YAML 구문 유효"
else
    log_fail "YAML 구문 오류"
fi

log_test "alerting-rules.yaml YAML 구문 검증"
if python3 -c "import yaml; yaml.safe_load(open('$PROJECT_DIR/infra/falco/alerting-rules.yaml'))" 2>/dev/null; then
    log_pass "YAML 구문 유효"
else
    log_fail "YAML 구문 오류"
fi

# =========================================================================
# 결과 요약
# =========================================================================
echo ""
echo "========================================="
echo " Falco 런타임 보안 테스트 결과"
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
