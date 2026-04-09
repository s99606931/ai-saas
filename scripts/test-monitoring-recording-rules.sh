#!/bin/bash
# =============================================================================
# MTU-N57: Prometheus Recording Rules + AlertManager 라우팅 테스트
# Design Ref: MTU-N57 Design §2, §3
# Plan SC: FR-N57.8
# CSAP: D-06(알림 체계 검증)
#
# 사용법:
#   ./scripts/test-monitoring-recording-rules.sh
#   ./scripts/test-monitoring-recording-rules.sh --live  # 실제 k3s 환경 테스트
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INFRA_DIR="$PROJECT_DIR/infra/monitoring"
KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
LIVE_MODE="${1:-}"

# 색상 출력
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

PASS=0; FAIL=0; SKIP=0; TOTAL=0

pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo -e "  ${GREEN}[PASS]${NC} $*"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo -e "  ${RED}[FAIL]${NC} $*"; }
skip() { SKIP=$((SKIP+1)); TOTAL=$((TOTAL+1)); echo -e "  ${YELLOW}[SKIP]${NC} $*"; }
header() { echo -e "\n${BOLD}${CYAN}=== $* ===${NC}"; }

# =============================================================================
# Phase 1: 파일 존재 및 구조 검증
# =============================================================================
header "Phase 1: 파일 존재 및 구조 검증"

# T1: Recording Rules CRD 파일 존재
if [[ -f "$INFRA_DIR/recording-rules.yaml" ]]; then
  pass "T1: recording-rules.yaml 파일 존재"
else
  fail "T1: recording-rules.yaml 파일 미존재"
fi

# T2: AlertManager 설정 파일 존재
if [[ -f "$INFRA_DIR/alertmanager-config.yaml" ]]; then
  pass "T2: alertmanager-config.yaml 파일 존재"
else
  fail "T2: alertmanager-config.yaml 파일 미존재"
fi

# T3: Recording Rules CRD API 버전 확인
if grep -q "apiVersion: monitoring.coreos.com/v1" "$INFRA_DIR/recording-rules.yaml" 2>/dev/null; then
  pass "T3: Recording Rules CRD API 버전 정확 (monitoring.coreos.com/v1)"
else
  fail "T3: Recording Rules CRD API 버전 누락"
fi

# T4: PrometheusRule kind 확인
if grep -q "kind: PrometheusRule" "$INFRA_DIR/recording-rules.yaml" 2>/dev/null; then
  pass "T4: PrometheusRule kind 올바름"
else
  fail "T4: PrometheusRule kind 누락"
fi

# =============================================================================
# Phase 2: Recording Rules 내용 검증
# =============================================================================
header "Phase 2: Recording Rules 내용 검증 (15개 이상)"

# T5: 서비스 RED 메트릭 - Rate
if grep -q "service:http_requests:rate5m" "$INFRA_DIR/recording-rules.yaml" 2>/dev/null; then
  pass "T5: FR-N57.1 서비스 요청 비율 (rate5m) recording rule"
else
  fail "T5: FR-N57.1 서비스 요청 비율 recording rule 누락"
fi

# T6: 서비스 RED 메트릭 - Errors
if grep -q "service:http_errors:ratio_rate5m" "$INFRA_DIR/recording-rules.yaml" 2>/dev/null; then
  pass "T6: FR-N57.1 서비스 에러 비율 (ratio_rate5m) recording rule"
else
  fail "T6: FR-N57.1 서비스 에러 비율 recording rule 누락"
fi

# T7: 서비스 RED 메트릭 - Duration P99
if grep -q "service:http_request_duration:p99_5m" "$INFRA_DIR/recording-rules.yaml" 2>/dev/null; then
  pass "T7: FR-N57.1 서비스 P99 지연 시간 recording rule"
else
  fail "T7: FR-N57.1 서비스 P99 지연 시간 recording rule 누락"
fi

# T8: 노드 CPU 사용률
if grep -q "node:cpu_utilization:ratio" "$INFRA_DIR/recording-rules.yaml" 2>/dev/null; then
  pass "T8: FR-N57.2 노드 CPU 사용률 recording rule"
else
  fail "T8: FR-N57.2 노드 CPU 사용률 recording rule 누락"
fi

# T9: 노드 메모리 사용률
if grep -q "node:memory_utilization:ratio" "$INFRA_DIR/recording-rules.yaml" 2>/dev/null; then
  pass "T9: FR-N57.2 노드 메모리 사용률 recording rule"
else
  fail "T9: FR-N57.2 노드 메모리 사용률 recording rule 누락"
fi

# T10: 노드 디스크 사용률
if grep -q "node:disk_utilization:ratio" "$INFRA_DIR/recording-rules.yaml" 2>/dev/null; then
  pass "T10: FR-N57.2 노드 디스크 사용률 recording rule"
else
  fail "T10: FR-N57.2 노드 디스크 사용률 recording rule 누락"
fi

# T11: SLO 에러 버짓 잔여율
if grep -q "slo:error_budget:remaining_ratio" "$INFRA_DIR/recording-rules.yaml" 2>/dev/null; then
  pass "T11: FR-N57.3 SLO 에러 버짓 잔여율 recording rule"
else
  fail "T11: FR-N57.3 SLO 에러 버짓 잔여율 recording rule 누락"
fi

# T12: SLO 번레이트
if grep -q "slo:burn_rate:1h" "$INFRA_DIR/recording-rules.yaml" 2>/dev/null; then
  pass "T12: FR-N57.3 SLO 번레이트 1h recording rule"
else
  fail "T12: FR-N57.3 SLO 번레이트 1h recording rule 누락"
fi

# T13: 클러스터 Pod Ready 비율
if grep -q "cluster:pod_ready:ratio" "$INFRA_DIR/recording-rules.yaml" 2>/dev/null; then
  pass "T13: FR-N57.4 클러스터 Pod Ready 비율 recording rule"
else
  fail "T13: FR-N57.4 클러스터 Pod Ready 비율 recording rule 누락"
fi

# T14: 네임스페이스 CPU 사용량
if grep -q "namespace:cpu_usage:sum" "$INFRA_DIR/recording-rules.yaml" 2>/dev/null; then
  pass "T14: FR-N57.4 네임스페이스 CPU 사용량 recording rule"
else
  fail "T14: FR-N57.4 네임스페이스 CPU 사용량 recording rule 누락"
fi

# T15: Recording Rules 총 개수 확인 (15개 이상)
RULE_COUNT=$(grep -c "record:" "$INFRA_DIR/recording-rules.yaml" 2>/dev/null || echo 0)
if [[ "$RULE_COUNT" -ge 15 ]]; then
  pass "T15: Recording Rules 총 ${RULE_COUNT}개 (목표: 15개 이상)"
else
  fail "T15: Recording Rules 총 ${RULE_COUNT}개 (목표: 15개 이상 미달)"
fi

# =============================================================================
# Phase 3: AlertManager 라우팅 검증
# =============================================================================
header "Phase 3: AlertManager 라우팅 검증"

# T16: 5개 수신자 정의 확인
RECEIVER_COUNT=$(grep -c "^  - name:" "$INFRA_DIR/alertmanager-config.yaml" 2>/dev/null || echo 0)
if [[ "$RECEIVER_COUNT" -ge 5 ]]; then
  pass "T16: FR-N57.5 AlertManager 수신자 ${RECEIVER_COUNT}개 정의 (목표: 5개)"
else
  fail "T16: FR-N57.5 AlertManager 수신자 ${RECEIVER_COUNT}개 (목표: 5개 미달)"
fi

# T17: devops-default 수신자
if grep -q "devops-default" "$INFRA_DIR/alertmanager-config.yaml" 2>/dev/null; then
  pass "T17: FR-N57.5 devops-default 수신자 정의"
else
  fail "T17: FR-N57.5 devops-default 수신자 누락"
fi

# T18: sre-team 수신자
if grep -q "sre-team" "$INFRA_DIR/alertmanager-config.yaml" 2>/dev/null; then
  pass "T18: FR-N57.5 sre-team 수신자 정의"
else
  fail "T18: FR-N57.5 sre-team 수신자 누락"
fi

# T19: security-team 수신자
if grep -q "security-team" "$INFRA_DIR/alertmanager-config.yaml" 2>/dev/null; then
  pass "T19: FR-N57.5 security-team 수신자 정의"
else
  fail "T19: FR-N57.5 security-team 수신자 누락"
fi

# T20: management-escalation 수신자
if grep -q "management-escalation" "$INFRA_DIR/alertmanager-config.yaml" 2>/dev/null; then
  pass "T20: FR-N57.5 management-escalation 수신자 정의"
else
  fail "T20: FR-N57.5 management-escalation 수신자 누락"
fi

# T21: 억제 규칙 존재
if grep -q "inhibit_rules" "$INFRA_DIR/alertmanager-config.yaml" 2>/dev/null; then
  pass "T21: FR-N57.6 억제 규칙 (inhibit_rules) 정의"
else
  fail "T21: FR-N57.6 억제 규칙 누락"
fi

# T22: critical→warning 억제
if grep -q 'severity="critical"' "$INFRA_DIR/alertmanager-config.yaml" 2>/dev/null && \
   grep -q 'severity="warning"' "$INFRA_DIR/alertmanager-config.yaml" 2>/dev/null; then
  pass "T22: FR-N57.6 critical→warning 억제 규칙"
else
  fail "T22: FR-N57.6 critical→warning 억제 규칙 누락"
fi

# =============================================================================
# Phase 4: CSAP 준수 검증
# =============================================================================
header "Phase 4: CSAP 준수 검증"

# T23: CSAP D-06 참조 존재
if grep -q "D-06" "$INFRA_DIR/recording-rules.yaml" 2>/dev/null; then
  pass "T23: CSAP D-06 참조 (Recording Rules)"
else
  fail "T23: CSAP D-06 참조 누락"
fi

# T24: Design 참조 존재
if grep -q "Design Ref" "$INFRA_DIR/recording-rules.yaml" 2>/dev/null; then
  pass "T24: Design Ref 주석 (Recording Rules)"
else
  fail "T24: Design Ref 주석 누락"
fi

# T25: Plan SC 참조 존재
if grep -q "Plan SC" "$INFRA_DIR/recording-rules.yaml" 2>/dev/null; then
  pass "T25: Plan SC 주석 (Recording Rules)"
else
  fail "T25: Plan SC 주석 누락"
fi

# T26: send_resolved 활성화 (알림 해소 통보)
SEND_RESOLVED_COUNT=$(grep -c "send_resolved: true" "$INFRA_DIR/alertmanager-config.yaml" 2>/dev/null || echo 0)
if [[ "$SEND_RESOLVED_COUNT" -ge 3 ]]; then
  pass "T26: send_resolved 활성화 (${SEND_RESOLVED_COUNT}개 수신자)"
else
  fail "T26: send_resolved 미활성화"
fi

# =============================================================================
# Phase 5: 실제 환경 테스트 (--live 옵션)
# =============================================================================
if [[ "$LIVE_MODE" == "--live" ]]; then
  header "Phase 5: 실제 k3s 환경 테스트"

  # T27: Recording Rules 적용 확인
  if kubectl --kubeconfig="$KUBECONFIG" get prometheusrule saas-recording-rules -n monitoring &>/dev/null; then
    pass "T27: Recording Rules CRD 적용 확인 (k3s)"
  else
    fail "T27: Recording Rules CRD 미적용"
  fi

  # T28: Prometheus에서 recording rule 메트릭 확인
  PROM_URL="http://localhost:30090"
  if curl -sf "$PROM_URL/api/v1/rules" | grep -q "saas:service:red_metrics" 2>/dev/null; then
    pass "T28: Prometheus에서 recording rules 활성화 확인"
  else
    fail "T28: Prometheus에서 recording rules 미확인"
  fi

  # T29: AlertManager 라우팅 적용 확인
  AM_URL="http://localhost:30093"
  if curl -sf "$AM_URL/api/v2/status" | grep -q "devops-default" 2>/dev/null; then
    pass "T29: AlertManager 라우팅 적용 확인"
  else
    fail "T29: AlertManager 라우팅 미적용"
  fi
else
  skip "T27: Recording Rules CRD 적용 (--live 모드 필요)"
  skip "T28: Prometheus recording rules 활성화 (--live 모드 필요)"
  skip "T29: AlertManager 라우팅 적용 (--live 모드 필요)"
fi

# =============================================================================
# 결과 요약
# =============================================================================
echo ""
header "테스트 결과 요약"
echo -e "  ${GREEN}PASS${NC}: $PASS"
echo -e "  ${RED}FAIL${NC}: $FAIL"
echo -e "  ${YELLOW}SKIP${NC}: $SKIP"
echo -e "  ${BOLD}TOTAL${NC}: $TOTAL"

MATCH_RATE=0
if [[ $TOTAL -gt 0 ]]; then
  MATCH_RATE=$(( (PASS * 100) / (PASS + FAIL) ))
fi
echo -e "\n  ${BOLD}matchRate: ${MATCH_RATE}%${NC}"

if [[ $FAIL -eq 0 ]]; then
  echo -e "\n${GREEN}${BOLD}  MTU-N57 Recording Rules + AlertManager 라우팅: ALL PASS${NC}"
  exit 0
else
  echo -e "\n${RED}${BOLD}  MTU-N57: ${FAIL}개 테스트 실패${NC}"
  exit 1
fi
