#!/bin/bash
# MTU-N198: Endpoint 가용성 모니터링 E2E 테스트
# Design Ref: MTU-N198.design.md
# Plan SC: FR-N198.6
set -euo pipefail

PASS=0
FAIL=0
TOTAL=0

check() {
  local desc="$1"
  local result="$2"
  TOTAL=$((TOTAL + 1))
  if [ "$result" = "0" ]; then
    echo "  [PASS] $desc"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $desc"
    FAIL=$((FAIL + 1))
  fi
}

echo "========================================"
echo "MTU-N198: Endpoint 가용성 모니터링 테스트"
echo "========================================"
echo ""

echo "[1/4] Recording Rules 파일 검증"
FILE="infra/monitoring/endpoint-availability-rules.yaml"
test -f "$FILE"; check "endpoint-availability-rules.yaml 파일 존재" $?
grep -q "endpoint:ready_count_by_service" "$FILE"; check "FR-N198.1: ready_count recording rule" $?
grep -q "endpoint:not_ready_count_by_service" "$FILE"; check "FR-N198.1: not_ready_count recording rule" $?
grep -q "endpoint:ready_ratio" "$FILE"; check "FR-N198.1: ready_ratio recording rule" $?
grep -q "endpoint:zero_endpoint_services" "$FILE"; check "FR-N198.2: zero_endpoint_services recording rule" $?
grep -q "endpoint:total_addresses" "$FILE"; check "total_addresses recording rule" $?
grep -q "endpoint:total_not_ready" "$FILE"; check "total_not_ready recording rule" $?
grep -q "endpoint:count_by_namespace" "$FILE"; check "count_by_namespace recording rule" $?
grep -q "endpoint:overall_availability" "$FILE"; check "overall_availability recording rule" $?
grep -q "kube_endpoint_address" "$FILE"; check "kube_endpoint_address 메트릭 참조" $?
grep -q "mtu: N198" "$FILE"; check "MTU 라벨 존재" $?
echo ""

echo "[2/4] Alerting Rules 파일 검증"
FILE="infra/monitoring/endpoint-availability-alerts.yaml"
test -f "$FILE"; check "endpoint-availability-alerts.yaml 파일 존재" $?
grep -q "EndpointZero" "$FILE"; check "FR-N198.2: EndpointZero 알림" $?
grep -q "EndpointReadyRatioLow" "$FILE"; check "FR-N198.3: EndpointReadyRatioLow 알림" $?
grep -q "EndpointNotReadySpike" "$FILE"; check "EndpointNotReadySpike 알림" $?
grep -q "EndpointOverallAvailabilityLow" "$FILE"; check "EndpointOverallAvailabilityLow 알림" $?
grep -q "MultipleServicesNoEndpoints" "$FILE"; check "MultipleServicesNoEndpoints 알림" $?
grep -q "severity: critical" "$FILE"; check "critical 심각도 존재" $?
grep -q "severity: warning" "$FILE"; check "warning 심각도 존재" $?
grep -q "csap: D-10" "$FILE"; check "CSAP D-10 매핑" $?
grep -q "runbook_url" "$FILE"; check "Runbook URL 포함" $?
grep -q "mtu: N198" "$FILE"; check "MTU 라벨 존재" $?
echo ""

echo "[3/4] Grafana 대시보드 검증"
FILE="infra/monitoring/dashboards/endpoint-availability-dashboard.json"
test -f "$FILE"; check "endpoint-availability-dashboard.json 파일 존재" $?
python3 -c "import json; json.load(open('$FILE'))" 2>/dev/null; check "JSON 형식 유효성" $?
grep -q "endpoint:overall_availability" "$FILE"; check "가용성 패널 존재" $?
grep -q "endpoint:ready_ratio" "$FILE"; check "Ready 비율 패널 존재" $?
grep -q "endpoint:not_ready_count_by_service" "$FILE"; check "NotReady 패널 존재" $?
grep -q "endpoint:zero_endpoint_services" "$FILE"; check "Endpoint 0 패널 존재" $?
grep -q "endpoint:count_by_namespace" "$FILE"; check "네임스페이스별 패널 존재" $?
echo ""

echo "[4/4] YAML 유효성 검증"
for f in infra/monitoring/endpoint-availability-rules.yaml infra/monitoring/endpoint-availability-alerts.yaml; do
  python3 -c "import yaml; yaml.safe_load(open('$f'))" 2>/dev/null; check "$f YAML 유효성" $?
done
echo ""

echo "========================================"
echo "테스트 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "========================================"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
