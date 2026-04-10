#!/bin/bash
# MTU-N200: API 서버 레이턴시 모니터링 E2E 테스트
# Design Ref: MTU-N200.design.md
# Plan SC: FR-N200.6
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
echo "MTU-N200: API 서버 레이턴시 모니터링 테스트"
echo "========================================"
echo ""

echo "[1/4] Recording Rules 파일 검증"
FILE="infra/monitoring/apiserver-latency-rules.yaml"
test -f "$FILE"; check "apiserver-latency-rules.yaml 파일 존재" $?
grep -q "apiserver_latency:p50_by_verb" "$FILE"; check "FR-N200.1: p50_by_verb recording rule" $?
grep -q "apiserver_latency:p90_by_verb" "$FILE"; check "FR-N200.1: p90_by_verb recording rule" $?
grep -q "apiserver_latency:p99_by_verb" "$FILE"; check "FR-N200.1: p99_by_verb recording rule" $?
grep -q "apiserver_latency:p99_by_resource" "$FILE"; check "FR-N200.2: p99_by_resource recording rule" $?
grep -q "apiserver_latency:p99_by_resource_verb" "$FILE"; check "FR-N200.2: p99_by_resource_verb recording rule" $?
grep -q "apiserver_latency:request_rate" "$FILE"; check "FR-N200.4: request_rate recording rule" $?
grep -q "apiserver_latency:request_rate_by_verb" "$FILE"; check "FR-N200.4: request_rate_by_verb recording rule" $?
grep -q "apiserver_latency:error_rate" "$FILE"; check "FR-N200.4: error_rate recording rule" $?
grep -q "apiserver_latency:request_rate_by_code" "$FILE"; check "FR-N200.4: request_rate_by_code recording rule" $?
grep -q "apiserver_latency:avg_latency" "$FILE"; check "avg_latency recording rule" $?
grep -q "apiserver_request_duration_seconds" "$FILE"; check "apiserver_request_duration_seconds 메트릭 참조" $?
grep -q "mtu: N200" "$FILE"; check "MTU 라벨 존재" $?
echo ""

echo "[2/4] Alerting Rules 파일 검증"
FILE="infra/monitoring/apiserver-latency-alerts.yaml"
test -f "$FILE"; check "apiserver-latency-alerts.yaml 파일 존재" $?
grep -q "APIServerLatencyHigh" "$FILE"; check "FR-N200.3: APIServerLatencyHigh 알림" $?
grep -q "APIServerLatencyCritical" "$FILE"; check "FR-N200.3: APIServerLatencyCritical 알림" $?
grep -q "APIServerErrorRateHigh" "$FILE"; check "FR-N200.4: APIServerErrorRateHigh 알림" $?
grep -q "APIServerRequestRateSpike" "$FILE"; check "APIServerRequestRateSpike 알림" $?
grep -q "APIServerResourceLatencyAnomaly" "$FILE"; check "APIServerResourceLatencyAnomaly 알림" $?
grep -q "severity: critical" "$FILE"; check "critical 심각도 존재" $?
grep -q "severity: warning" "$FILE"; check "warning 심각도 존재" $?
grep -q "csap: D-10" "$FILE"; check "CSAP D-10 매핑" $?
grep -q "runbook_url" "$FILE"; check "Runbook URL 포함" $?
grep -q "mtu: N200" "$FILE"; check "MTU 라벨 존재" $?
echo ""

echo "[3/4] Grafana 대시보드 검증"
FILE="infra/monitoring/dashboards/apiserver-latency-dashboard.json"
test -f "$FILE"; check "apiserver-latency-dashboard.json 파일 존재" $?
python3 -c "import json; json.load(open('$FILE'))" 2>/dev/null; check "JSON 형식 유효성" $?
grep -q "apiserver_latency:p99_by_verb" "$FILE"; check "동사별 p99 패널 존재" $?
grep -q "apiserver_latency:p99_by_resource" "$FILE"; check "리소스별 p99 패널 존재" $?
grep -q "apiserver_latency:error_rate" "$FILE"; check "에러율 패널 존재" $?
grep -q "apiserver_latency:request_rate" "$FILE"; check "요청률 패널 존재" $?
grep -q "apiserver_latency:request_rate_by_code" "$FILE"; check "코드별 분포 패널 존재" $?
echo ""

echo "[4/4] YAML 유효성 검증"
for f in infra/monitoring/apiserver-latency-rules.yaml infra/monitoring/apiserver-latency-alerts.yaml; do
  python3 -c "import yaml; yaml.safe_load(open('$f'))" 2>/dev/null; check "$f YAML 유효성" $?
done
echo ""

echo "========================================"
echo "테스트 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "========================================"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
