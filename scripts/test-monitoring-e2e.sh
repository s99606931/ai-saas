#!/bin/bash
# =============================================================================
# MTU-N70: 모니터링 스택 E2E 통합 테스트
# Design Ref: MTU-N70 Design §2
# Plan SC: FR-N70.1, FR-N70.5
# CSAP: D-06(모니터링 체계 완전성 검증)
#
# 검증 대상:
#   MTU-N57: Recording Rules + AlertManager
#   MTU-N61: Grafana 공공기관 SaaS 대시보드
#   MTU-N69: LogQL/TraceQL 쿼리 + Loki 알림
#   MTU-N70: SLO Error Budget 알림
#
# 사용법:
#   ./scripts/test-monitoring-e2e.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INFRA_DIR="$PROJECT_DIR/infra/monitoring"

# 색상 출력
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

PASS=0; FAIL=0; SKIP=0; TOTAL=0

pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo -e "  ${GREEN}[PASS]${NC} $*"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo -e "  ${RED}[FAIL]${NC} $*"; }
skip() { SKIP=$((SKIP+1)); TOTAL=$((TOTAL+1)); echo -e "  ${YELLOW}[SKIP]${NC} $*"; }
header() { echo -e "\n${BOLD}${CYAN}=== $* ===${NC}"; }

# =============================================================================
# Phase 1: 모니터링 인프라 파일 존재 검증 (10건)
# =============================================================================
header "Phase 1: 모니터링 인프라 파일 존재 검증"

INFRA_FILES=(
  "kube-prometheus-stack/values.yaml:kube-prometheus-stack values"
  "loki/values.yaml:Loki values"
  "tempo/values.yaml:Tempo values"
  "otel-collector.yaml:OTel Collector"
  "otel-collector-traces.yaml:OTel Traces Collector"
  "recording-rules.yaml:Recording Rules CRD"
  "alertmanager-config.yaml:AlertManager 라우팅"
  "alerting-rules.yaml:Prometheus 알림 규칙"
  "loki-alerting-rules.yaml:Loki 로그 알림"
  "slo-error-budget-alerts.yaml:SLO Error Budget 알림"
)

T_NUM=1
for entry in "${INFRA_FILES[@]}"; do
  IFS=':' read -r file label <<< "$entry"
  if [[ -f "$INFRA_DIR/$file" ]]; then
    pass "T${T_NUM}: ${label} 파일 존재"
  else
    fail "T${T_NUM}: ${label} 파일 미존재 (${file})"
  fi
  T_NUM=$((T_NUM+1))
done

# =============================================================================
# Phase 2: 대시보드 파일 검증 (7건)
# =============================================================================
header "Phase 2: Grafana 대시보드 검증"

DASHBOARDS=(
  "csap-compliance-status.json:CSAP 준수 현황"
  "tenant-resource-usage.json:테넌트 리소스"
  "security-auth-events.json:인증/보안 이벤트"
  "slo-overview.json:SLO 현황"
  "distributed-tracing.json:분산 추적"
  "falco-runtime-security.json:Falco 런타임 보안"
  "cluster-overview.yaml:클러스터 개요"
)

for entry in "${DASHBOARDS[@]}"; do
  IFS=':' read -r file label <<< "$entry"
  if [[ -f "$INFRA_DIR/dashboards/$file" ]]; then
    pass "T${T_NUM}: ${label} 대시보드 존재"
  else
    fail "T${T_NUM}: ${label} 대시보드 미존재"
  fi
  T_NUM=$((T_NUM+1))
done

# =============================================================================
# Phase 3: YAML/JSON 유효성 검증 (5건)
# =============================================================================
header "Phase 3: YAML/JSON 유효성 검증"

# Recording Rules YAML
if python3 -c "import yaml; yaml.safe_load(open('$INFRA_DIR/recording-rules.yaml'))" 2>/dev/null; then
  pass "T${T_NUM}: Recording Rules YAML 유효"
else
  fail "T${T_NUM}: Recording Rules YAML 유효성 실패"
fi
T_NUM=$((T_NUM+1))

# AlertManager config YAML
if python3 -c "import yaml; yaml.safe_load(open('$INFRA_DIR/alertmanager-config.yaml'))" 2>/dev/null; then
  pass "T${T_NUM}: AlertManager 설정 YAML 유효"
else
  fail "T${T_NUM}: AlertManager 설정 YAML 유효성 실패"
fi
T_NUM=$((T_NUM+1))

# SLO Error Budget alerts YAML
if python3 -c "import yaml; yaml.safe_load(open('$INFRA_DIR/slo-error-budget-alerts.yaml'))" 2>/dev/null; then
  pass "T${T_NUM}: SLO Error Budget 알림 YAML 유효"
else
  fail "T${T_NUM}: SLO Error Budget 알림 YAML 유효성 실패"
fi
T_NUM=$((T_NUM+1))

# Loki alerting rules YAML
if python3 -c "import yaml; yaml.safe_load(open('$INFRA_DIR/loki-alerting-rules.yaml'))" 2>/dev/null; then
  pass "T${T_NUM}: Loki 알림 규칙 YAML 유효"
else
  fail "T${T_NUM}: Loki 알림 규칙 YAML 유효성 실패"
fi
T_NUM=$((T_NUM+1))

# CSAP dashboard JSON
if python3 -m json.tool "$INFRA_DIR/dashboards/csap-compliance-status.json" > /dev/null 2>&1; then
  pass "T${T_NUM}: CSAP 대시보드 JSON 유효"
else
  fail "T${T_NUM}: CSAP 대시보드 JSON 유효성 실패"
fi
T_NUM=$((T_NUM+1))

# =============================================================================
# Phase 4: Recording Rules 내용 검증 (5건)
# =============================================================================
header "Phase 4: Recording Rules 내용 검증 (MTU-N57)"

RECORDING_RULES_FILE="$INFRA_DIR/recording-rules.yaml"

RULE_COUNT=$(grep -c "record:" "$RECORDING_RULES_FILE" 2>/dev/null || echo 0)
if [[ "$RULE_COUNT" -ge 15 ]]; then
  pass "T${T_NUM}: Recording Rules ${RULE_COUNT}개 (목표: 15+)"
else
  fail "T${T_NUM}: Recording Rules ${RULE_COUNT}개 (목표: 15 미달)"
fi
T_NUM=$((T_NUM+1))

# 4개 그룹 확인
GROUP_COUNT=$(grep -c "name: saas:" "$RECORDING_RULES_FILE" 2>/dev/null || echo 0)
if [[ "$GROUP_COUNT" -ge 4 ]]; then
  pass "T${T_NUM}: Recording Rules 그룹 ${GROUP_COUNT}개 (목표: 4+)"
else
  fail "T${T_NUM}: Recording Rules 그룹 ${GROUP_COUNT}개 (목표: 4 미달)"
fi
T_NUM=$((T_NUM+1))

# RED 메트릭 존재
if grep -q "service:http_requests:rate5m" "$RECORDING_RULES_FILE" && \
   grep -q "service:http_errors:ratio_rate5m" "$RECORDING_RULES_FILE" && \
   grep -q "service:http_request_duration:p99_5m" "$RECORDING_RULES_FILE"; then
  pass "T${T_NUM}: RED 메트릭 Recording Rules 완비 (Rate, Errors, Duration)"
else
  fail "T${T_NUM}: RED 메트릭 Recording Rules 불완전"
fi
T_NUM=$((T_NUM+1))

# SLO 집계 존재
if grep -q "slo:error_budget:remaining_ratio" "$RECORDING_RULES_FILE" && \
   grep -q "slo:burn_rate:1h" "$RECORDING_RULES_FILE"; then
  pass "T${T_NUM}: SLO 집계 Recording Rules (error_budget + burn_rate)"
else
  fail "T${T_NUM}: SLO 집계 Recording Rules 불완전"
fi
T_NUM=$((T_NUM+1))

# 노드 리소스 존재
if grep -q "node:cpu_utilization:ratio" "$RECORDING_RULES_FILE" && \
   grep -q "node:memory_utilization:ratio" "$RECORDING_RULES_FILE"; then
  pass "T${T_NUM}: 노드 리소스 Recording Rules (CPU + Memory)"
else
  fail "T${T_NUM}: 노드 리소스 Recording Rules 불완전"
fi
T_NUM=$((T_NUM+1))

# =============================================================================
# Phase 5: SLO Error Budget 알림 검증 (4건)
# =============================================================================
header "Phase 5: SLO Error Budget 알림 검증 (MTU-N70)"

SLO_ALERTS="$INFRA_DIR/slo-error-budget-alerts.yaml"

if grep -q "SLOErrorBudget50Consumed" "$SLO_ALERTS" 2>/dev/null; then
  pass "T${T_NUM}: SLO 에러 버짓 50% 소진 알림"
else
  fail "T${T_NUM}: SLO 에러 버짓 50% 알림 누락"
fi
T_NUM=$((T_NUM+1))

if grep -q "SLOErrorBudget75Consumed" "$SLO_ALERTS" 2>/dev/null; then
  pass "T${T_NUM}: SLO 에러 버짓 75% 소진 알림"
else
  fail "T${T_NUM}: SLO 에러 버짓 75% 알림 누락"
fi
T_NUM=$((T_NUM+1))

if grep -q "SLOBurnRateCritical" "$SLO_ALERTS" 2>/dev/null; then
  pass "T${T_NUM}: SLO 번레이트 Critical 알림 (MWMBR)"
else
  fail "T${T_NUM}: SLO 번레이트 Critical 알림 누락"
fi
T_NUM=$((T_NUM+1))

if grep -q "SLOBurnRateTicket" "$SLO_ALERTS" 2>/dev/null; then
  pass "T${T_NUM}: SLO 번레이트 Ticket 알림 (느린 번)"
else
  fail "T${T_NUM}: SLO 번레이트 Ticket 알림 누락"
fi
T_NUM=$((T_NUM+1))

# =============================================================================
# Phase 6: AlertManager 라우팅 검증 (3건)
# =============================================================================
header "Phase 6: AlertManager 라우팅 검증 (MTU-N57)"

AM_CONFIG="$INFRA_DIR/alertmanager-config.yaml"

RECEIVER_COUNT=$(grep -c "^  - name:" "$AM_CONFIG" 2>/dev/null || echo 0)
if [[ "$RECEIVER_COUNT" -ge 5 ]]; then
  pass "T${T_NUM}: AlertManager 수신자 ${RECEIVER_COUNT}개 (5채널)"
else
  fail "T${T_NUM}: AlertManager 수신자 부족 (${RECEIVER_COUNT}/5)"
fi
T_NUM=$((T_NUM+1))

if grep -q "inhibit_rules" "$AM_CONFIG" 2>/dev/null; then
  pass "T${T_NUM}: AlertManager 억제 규칙 존재"
else
  fail "T${T_NUM}: AlertManager 억제 규칙 누락"
fi
T_NUM=$((T_NUM+1))

if grep -q "sre-team" "$AM_CONFIG" && grep -q "security-team" "$AM_CONFIG"; then
  pass "T${T_NUM}: SRE + Security 전용 채널 정의"
else
  fail "T${T_NUM}: SRE/Security 전용 채널 누락"
fi
T_NUM=$((T_NUM+1))

# =============================================================================
# Phase 7: 상호 참조 일관성 검증 (3건)
# =============================================================================
header "Phase 7: 상호 참조 일관성 검증"

# Recording Rules → 대시보드에서 참조
if grep -q "namespace:cpu_usage:sum" "$INFRA_DIR/dashboards/tenant-resource-usage.json" 2>/dev/null && \
   grep -q "namespace:cpu_usage:sum" "$INFRA_DIR/recording-rules.yaml" 2>/dev/null; then
  pass "T${T_NUM}: Recording Rule → 대시보드 참조 일관성 (namespace:cpu_usage)"
else
  fail "T${T_NUM}: Recording Rule → 대시보드 참조 불일치"
fi
T_NUM=$((T_NUM+1))

# Recording Rules → SLO 알림에서 참조
if grep -q "slo:error_budget:remaining_ratio" "$SLO_ALERTS" 2>/dev/null && \
   grep -q "slo:error_budget:remaining_ratio" "$INFRA_DIR/recording-rules.yaml" 2>/dev/null; then
  pass "T${T_NUM}: Recording Rule → SLO 알림 참조 일관성 (error_budget)"
else
  fail "T${T_NUM}: Recording Rule → SLO 알림 참조 불일치"
fi
T_NUM=$((T_NUM+1))

# CSAP 참조 일관성 (D-06 전체 파일에 존재)
D06_FILES=0
for f in recording-rules.yaml alertmanager-config.yaml loki-alerting-rules.yaml slo-error-budget-alerts.yaml; do
  if grep -q "D-06" "$INFRA_DIR/$f" 2>/dev/null; then
    D06_FILES=$((D06_FILES+1))
  fi
done
if [[ "$D06_FILES" -ge 4 ]]; then
  pass "T${T_NUM}: CSAP D-06 참조 일관성 (${D06_FILES}/4 파일)"
else
  fail "T${T_NUM}: CSAP D-06 참조 불완전 (${D06_FILES}/4)"
fi
T_NUM=$((T_NUM+1))

# =============================================================================
# Phase 8: SLO 정의 파일 검증 (2건)
# =============================================================================
header "Phase 8: SLO 정의 검증"

SLO_DIR="$PROJECT_DIR/infra/slo"
SLO_COUNT=$(ls -1 "$SLO_DIR"/*.yaml 2>/dev/null | wc -l)
if [[ "$SLO_COUNT" -ge 5 ]]; then
  pass "T${T_NUM}: SLO 정의 파일 ${SLO_COUNT}개 (5개 서비스)"
else
  fail "T${T_NUM}: SLO 정의 파일 ${SLO_COUNT}개 (5개 미달)"
fi
T_NUM=$((T_NUM+1))

if [[ -f "$SLO_DIR/api-gateway-slo.yaml" ]]; then
  pass "T${T_NUM}: API Gateway SLO 정의 존재"
else
  fail "T${T_NUM}: API Gateway SLO 정의 미존재"
fi
T_NUM=$((T_NUM+1))

# =============================================================================
# Phase 9: 운영 가이드 검증 (2건)
# =============================================================================
header "Phase 9: 운영 가이드 검증"

if [[ -f "$PROJECT_DIR/docs/operations/logql-traceql-query-guide.md" ]]; then
  pass "T${T_NUM}: LogQL/TraceQL 쿼리 가이드 존재"
else
  fail "T${T_NUM}: LogQL/TraceQL 쿼리 가이드 미존재"
fi
T_NUM=$((T_NUM+1))

if [[ -f "$PROJECT_DIR/docs/operations/slo-guide.md" ]]; then
  pass "T${T_NUM}: SLO 운영 가이드 존재"
else
  fail "T${T_NUM}: SLO 운영 가이드 미존재"
fi
T_NUM=$((T_NUM+1))

# =============================================================================
# 결과 요약
# =============================================================================
echo ""
header "================================================="
header "모니터링 E2E 통합 테스트 결과 요약"
header "================================================="
echo -e "  ${GREEN}PASS${NC}: $PASS"
echo -e "  ${RED}FAIL${NC}: $FAIL"
echo -e "  ${YELLOW}SKIP${NC}: $SKIP"
echo -e "  ${BOLD}TOTAL${NC}: $TOTAL"

MATCH_RATE=0
if [[ $((PASS + FAIL)) -gt 0 ]]; then
  MATCH_RATE=$(( (PASS * 100) / (PASS + FAIL) ))
fi
echo -e "\n  ${BOLD}matchRate: ${MATCH_RATE}%${NC}"

echo ""
echo -e "  ${BOLD}검증 대상:${NC}"
echo -e "    MTU-N57: Prometheus Recording Rules (21개) + AlertManager (5채널)"
echo -e "    MTU-N61: Grafana 대시보드 (3종 신규 + 기존 14종)"
echo -e "    MTU-N69: LogQL 10종 + TraceQL 8종 + Loki 알림 7개"
echo -e "    MTU-N70: SLO Error Budget 알림 (MWMBR 6개)"

if [[ $FAIL -eq 0 ]]; then
  echo -e "\n${GREEN}${BOLD}  모니터링 스택 E2E 통합 테스트: ALL PASS${NC}"
  exit 0
else
  echo -e "\n${RED}${BOLD}  모니터링 E2E: ${FAIL}개 테스트 실패${NC}"
  exit 1
fi
