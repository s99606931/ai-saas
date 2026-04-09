#!/bin/bash
# =============================================================================
# 분산 추적 고도화 테스트 스크립트
# Design Ref: MTU-N48 Design
# Plan SC: FR-N48.7
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
echo " MTU-N48: 분산 추적 고도화 테스트"
echo "========================================="

# Phase 1: 산출물 존재
log_test "Tempo values 존재"
if [ -f "$PROJECT_DIR/infra/monitoring/tempo/values.yaml" ]; then
    log_pass "values.yaml 존재"
else
    log_fail "values.yaml 없음"
fi

log_test "OTel Collector traces 설정 존재"
if [ -f "$PROJECT_DIR/infra/monitoring/otel-collector-traces.yaml" ]; then
    log_pass "otel-collector-traces.yaml 존재"
else
    log_fail "파일 없음"
fi

log_test "분산 추적 대시보드 존재"
if [ -f "$PROJECT_DIR/infra/monitoring/dashboards/distributed-tracing.json" ]; then
    log_pass "distributed-tracing.json 존재"
else
    log_fail "파일 없음"
fi

log_test "TraceQL 예시 문서 존재"
if [ -f "$PROJECT_DIR/docs/operations/traceql-examples.md" ]; then
    log_pass "traceql-examples.md 존재"
else
    log_fail "파일 없음"
fi

# Phase 2: Tempo values 설정 검증
log_test "Tempo OTLP gRPC 수신기 설정"
if grep -q "4317" "$PROJECT_DIR/infra/monitoring/tempo/values.yaml"; then
    log_pass "OTLP gRPC 포트 4317 설정됨"
else
    log_fail "OTLP gRPC 포트 없음"
fi

log_test "Tempo 보존 기간 설정"
if grep -q "retention:" "$PROJECT_DIR/infra/monitoring/tempo/values.yaml"; then
    log_pass "보존 기간 설정됨"
else
    log_fail "보존 기간 없음"
fi

log_test "Tempo 메트릭 생성기 활성화"
if grep -q "metrics_generator:" "$PROJECT_DIR/infra/monitoring/tempo/values.yaml" && grep -q "enabled: true" "$PROJECT_DIR/infra/monitoring/tempo/values.yaml"; then
    log_pass "메트릭 생성기 활성화됨"
else
    log_fail "메트릭 생성기 비활성화"
fi

log_test "Tempo ServiceMonitor 설정"
if grep -q "serviceMonitor:" "$PROJECT_DIR/infra/monitoring/tempo/values.yaml"; then
    log_pass "ServiceMonitor 설정됨"
else
    log_fail "ServiceMonitor 없음"
fi

log_test "Tempo span_metrics 활성화"
if grep -q "span_metrics:" "$PROJECT_DIR/infra/monitoring/tempo/values.yaml"; then
    log_pass "span_metrics 활성화됨"
else
    log_fail "span_metrics 없음"
fi

log_test "Tempo service_graphs 활성화"
if grep -q "service_graphs:" "$PROJECT_DIR/infra/monitoring/tempo/values.yaml"; then
    log_pass "service_graphs 활성화됨"
else
    log_fail "service_graphs 없음"
fi

log_test "Grafana 데이터소스 자동 등록"
if grep -q "grafana_datasource" "$PROJECT_DIR/infra/monitoring/tempo/values.yaml"; then
    log_pass "Grafana 데이터소스 자동 등록 설정됨"
else
    log_fail "Grafana 연동 없음"
fi

log_test "trace-to-log 연결 설정"
if grep -q "tracesToLogsV2" "$PROJECT_DIR/infra/monitoring/tempo/values.yaml"; then
    log_pass "trace-to-log 상호 연결 설정됨"
else
    log_fail "trace-to-log 없음"
fi

# Phase 3: OTel Collector 설정 검증
log_test "OTel PII 필터링 프로세서"
if grep -q "pii_filter" "$PROJECT_DIR/infra/monitoring/otel-collector-traces.yaml"; then
    log_pass "PII 필터링 프로세서 설정됨"
else
    log_fail "PII 필터링 없음"
fi

log_test "OTel tail_sampling 프로세서"
if grep -q "tail_sampling" "$PROJECT_DIR/infra/monitoring/otel-collector-traces.yaml"; then
    log_pass "tail_sampling 설정됨"
else
    log_fail "tail_sampling 없음"
fi

log_test "OTel spanmetrics 프로세서"
if grep -q "spanmetrics" "$PROJECT_DIR/infra/monitoring/otel-collector-traces.yaml"; then
    log_pass "spanmetrics 변환 설정됨"
else
    log_fail "spanmetrics 없음"
fi

log_test "OTel Tempo exporter 설정"
if grep -q "otlp/tempo" "$PROJECT_DIR/infra/monitoring/otel-collector-traces.yaml"; then
    log_pass "Tempo exporter 설정됨"
else
    log_fail "Tempo exporter 없음"
fi

log_test "OTel memory_limiter 설정"
if grep -q "memory_limiter" "$PROJECT_DIR/infra/monitoring/otel-collector-traces.yaml"; then
    log_pass "memory_limiter 설정됨"
else
    log_fail "memory_limiter 없음"
fi

# Phase 4: YAML/JSON 구문 검증
log_test "Tempo values YAML 유효성"
if python3 -c "import yaml; yaml.safe_load(open('$PROJECT_DIR/infra/monitoring/tempo/values.yaml'))" 2>/dev/null; then
    log_pass "YAML 유효"
else
    log_fail "YAML 오류"
fi

log_test "OTel Collector YAML 유효성"
if python3 -c "import yaml; list(yaml.safe_load_all(open('$PROJECT_DIR/infra/monitoring/otel-collector-traces.yaml')))" 2>/dev/null; then
    log_pass "YAML 유효"
else
    log_fail "YAML 오류"
fi

log_test "대시보드 JSON 유효성"
if python3 -c "import json; json.load(open('$PROJECT_DIR/infra/monitoring/dashboards/distributed-tracing.json'))" 2>/dev/null; then
    log_pass "JSON 유효"
else
    log_fail "JSON 오류"
fi

log_test "대시보드 패널 수 확인"
PANEL_COUNT=$(python3 -c "
import json
with open('$PROJECT_DIR/infra/monitoring/dashboards/distributed-tracing.json') as f:
    d = json.load(f)
    panels = [p for p in d['panels'] if p.get('type') != 'row']
    print(len(panels))
" 2>/dev/null || echo 0)
if [ "$PANEL_COUNT" -ge 5 ]; then
    log_pass "대시보드 패널 ${PANEL_COUNT}개"
else
    log_fail "패널 부족 (${PANEL_COUNT}개)"
fi

log_test "TraceQL 예시 5개 이상"
QUERY_COUNT=$(grep -c 'traceql' "$PROJECT_DIR/docs/operations/traceql-examples.md" 2>/dev/null || echo "0")
if [ "$QUERY_COUNT" -ge 5 ]; then
    log_pass "TraceQL 관련 항목 ${QUERY_COUNT}개"
else
    log_fail "TraceQL 예시 부족 (${QUERY_COUNT}개)"
fi

# 결과 요약
echo ""
echo "========================================="
echo " 분산 추적 고도화 테스트 결과"
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
