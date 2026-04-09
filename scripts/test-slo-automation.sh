#!/bin/bash
# =============================================================================
# SLO/SLI 자동화 테스트 스크립트
# Design Ref: MTU-N49 Design
# Plan SC: FR-N49.8
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
echo " MTU-N49: SLO/SLI 자동화 테스트"
echo "========================================="

# Phase 1: SLO CRD 파일 존재
log_test "API Gateway SLO 정의 존재"
[ -f "$PROJECT_DIR/infra/slo/api-gateway-slo.yaml" ] && log_pass "존재" || log_fail "없음"

log_test "Auth Service SLO 정의 존재"
[ -f "$PROJECT_DIR/infra/slo/auth-service-slo.yaml" ] && log_pass "존재" || log_fail "없음"

log_test "Tenant Service SLO 정의 존재"
[ -f "$PROJECT_DIR/infra/slo/tenant-service-slo.yaml" ] && log_pass "존재" || log_fail "없음"

log_test "Audit Service SLO 정의 존재"
[ -f "$PROJECT_DIR/infra/slo/audit-service-slo.yaml" ] && log_pass "존재" || log_fail "없음"

log_test "AI Gateway SLO 정의 존재"
[ -f "$PROJECT_DIR/infra/slo/ai-gateway-slo.yaml" ] && log_pass "존재" || log_fail "없음"

log_test "SLO 대시보드 존재"
[ -f "$PROJECT_DIR/infra/monitoring/dashboards/slo-overview.json" ] && log_pass "존재" || log_fail "없음"

log_test "SLO 운영 가이드 존재"
[ -f "$PROJECT_DIR/docs/operations/slo-guide.md" ] && log_pass "존재" || log_fail "없음"

# Phase 2: SLO 내용 검증
log_test "API Gateway 가용성 SLO 99.9%"
grep -q "objective: 99.9" "$PROJECT_DIR/infra/slo/api-gateway-slo.yaml" && log_pass "99.9% 설정됨" || log_fail "없음"

log_test "Auth Service SLO 99.95%"
grep -q "objective: 99.95" "$PROJECT_DIR/infra/slo/auth-service-slo.yaml" && log_pass "99.95% 설정됨" || log_fail "없음"

log_test "Audit Service SLO 99.99%"
grep -q "objective: 99.99" "$PROJECT_DIR/infra/slo/audit-service-slo.yaml" && log_pass "99.99% 설정됨" || log_fail "없음"

log_test "AI Gateway SLO 99.5%"
grep -q "objective: 99.5" "$PROJECT_DIR/infra/slo/ai-gateway-slo.yaml" && log_pass "99.5% 설정됨" || log_fail "없음"

log_test "API Gateway 지연시간 SLO 존재"
grep -q "latency" "$PROJECT_DIR/infra/slo/api-gateway-slo.yaml" && log_pass "지연시간 SLO 포함" || log_fail "없음"

log_test "Sloth CRD API 버전 확인"
grep -q "sloth.slok.dev" "$PROJECT_DIR/infra/slo/api-gateway-slo.yaml" && log_pass "Sloth CRD 형식" || log_fail "잘못된 형식"

log_test "알림 설정 확인 (pageAlert)"
grep -q "pageAlert" "$PROJECT_DIR/infra/slo/api-gateway-slo.yaml" && log_pass "pageAlert 설정됨" || log_fail "없음"

log_test "알림 설정 확인 (ticketAlert)"
grep -q "ticketAlert" "$PROJECT_DIR/infra/slo/api-gateway-slo.yaml" && log_pass "ticketAlert 설정됨" || log_fail "없음"

log_test "CSAP D-06 라벨 (Audit Service)"
grep -q "csap.compliance/domain" "$PROJECT_DIR/infra/slo/audit-service-slo.yaml" && log_pass "CSAP 라벨 포함" || log_fail "없음"

log_test "CSAP D-08 라벨 (Auth Service)"
grep -q "csap.compliance/domain" "$PROJECT_DIR/infra/slo/auth-service-slo.yaml" && log_pass "CSAP 라벨 포함" || log_fail "없음"

# Phase 3: YAML/JSON 구문 검증
for SLO_FILE in api-gateway-slo auth-service-slo tenant-service-slo audit-service-slo ai-gateway-slo; do
    log_test "${SLO_FILE}.yaml YAML 유효성"
    if python3 -c "import yaml; yaml.safe_load(open('$PROJECT_DIR/infra/slo/${SLO_FILE}.yaml'))" 2>/dev/null; then
        log_pass "YAML 유효"
    else
        log_fail "YAML 오류"
    fi
done

log_test "대시보드 JSON 유효성"
python3 -c "import json; json.load(open('$PROJECT_DIR/infra/monitoring/dashboards/slo-overview.json'))" 2>/dev/null && log_pass "JSON 유효" || log_fail "JSON 오류"

log_test "대시보드 패널 수 확인"
PANEL_COUNT=$(python3 -c "
import json
with open('$PROJECT_DIR/infra/monitoring/dashboards/slo-overview.json') as f:
    d = json.load(f)
    panels = [p for p in d['panels'] if p.get('type') != 'row']
    print(len(panels))
" 2>/dev/null || echo 0)
[ "$PANEL_COUNT" -ge 5 ] && log_pass "대시보드 패널 ${PANEL_COUNT}개" || log_fail "패널 부족"

# 결과 요약
echo ""
echo "========================================="
echo " SLO/SLI 자동화 테스트 결과"
echo "========================================="
echo -e " 전체: ${TOTAL}건"
echo -e " ${GREEN}PASS${NC}: ${PASS}건"
echo -e " ${RED}FAIL${NC}: ${FAIL}건"
echo "========================================="

[ "$FAIL" -eq 0 ] && echo -e "${GREEN}ALL TESTS PASSED${NC}" && exit 0 || { echo -e "${RED}${FAIL} TESTS FAILED${NC}"; exit 1; }
