#!/bin/bash
# MTU-N195: Webhook 호출 성능 모니터링 E2E 테스트
# Design Ref: MTU-N195.design.md
# Plan SC: FR-N195.7
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
echo "MTU-N195: Webhook 호출 성능 모니터링 테스트"
echo "========================================"
echo ""

# --- Recording Rules ---
echo "[1/4] Recording Rules 파일 검증"
FILE="infra/monitoring/webhook-performance-rules.yaml"
test -f "$FILE"; check "webhook-performance-rules.yaml 파일 존재" $?
grep -q "webhook_perf:latency_p50" "$FILE"; check "FR-N195.1: latency_p50 recording rule" $?
grep -q "webhook_perf:latency_p90" "$FILE"; check "FR-N195.1: latency_p90 recording rule" $?
grep -q "webhook_perf:latency_p99" "$FILE"; check "FR-N195.1: latency_p99 recording rule" $?
grep -q "webhook_perf:rejection_rate_5m" "$FILE"; check "FR-N195.3: rejection_rate recording rule" $?
grep -q "webhook_perf:total_requests_rate_5m" "$FILE"; check "FR-N195.3: total_requests_rate recording rule" $?
grep -q "webhook_perf:error_rate_5m" "$FILE"; check "FR-N195.5: error_rate recording rule" $?
grep -q "webhook_perf:avg_latency" "$FILE"; check "avg_latency recording rule" $?
grep -q "webhook_perf:requests_by_type" "$FILE"; check "requests_by_type recording rule" $?
grep -q "webhook_perf:slowest_p99" "$FILE"; check "slowest_p99 recording rule" $?
grep -q "apiserver_admission_webhook" "$FILE"; check "apiserver admission webhook 메트릭 참조" $?
grep -q "mtu: N195" "$FILE"; check "MTU 라벨 존재" $?
echo ""

# --- Alerting Rules ---
echo "[2/4] Alerting Rules 파일 검증"
FILE="infra/monitoring/webhook-performance-alerts.yaml"
test -f "$FILE"; check "webhook-performance-alerts.yaml 파일 존재" $?
grep -q "WebhookLatencyHigh" "$FILE"; check "FR-N195.2: WebhookLatencyHigh 알림" $?
grep -q "WebhookLatencyCritical" "$FILE"; check "FR-N195.2: WebhookLatencyCritical 알림" $?
grep -q "WebhookRejectionRateHigh" "$FILE"; check "FR-N195.4: WebhookRejectionRateHigh 알림" $?
grep -q "WebhookRejectionSpike" "$FILE"; check "FR-N195.4: WebhookRejectionSpike 알림" $?
grep -q "WebhookErrorsDetected" "$FILE"; check "FR-N195.5: WebhookErrorsDetected 알림" $?
grep -q "WebhookOverallLatencyHigh" "$FILE"; check "WebhookOverallLatencyHigh 알림" $?
grep -q "severity: critical" "$FILE"; check "critical 심각도 존재" $?
grep -q "severity: warning" "$FILE"; check "warning 심각도 존재" $?
grep -q "csap: D-08" "$FILE"; check "CSAP D-08 매핑" $?
grep -q "csap: D-10" "$FILE"; check "CSAP D-10 매핑" $?
grep -q "runbook_url" "$FILE"; check "Runbook URL 포함" $?
grep -q "mtu: N195" "$FILE"; check "MTU 라벨 존재" $?
echo ""

# --- 대시보드 ---
echo "[3/4] Grafana 대시보드 검증"
FILE="infra/monitoring/dashboards/webhook-performance-dashboard.json"
test -f "$FILE"; check "webhook-performance-dashboard.json 파일 존재" $?
python3 -c "import json; json.load(open('$FILE'))" 2>/dev/null; check "JSON 형식 유효성" $?
grep -q "webhook_perf:latency_p99" "$FILE"; check "p99 레이턴시 패널 존재" $?
grep -q "webhook_perf:rejection_rate_5m" "$FILE"; check "거부율 패널 존재" $?
grep -q "webhook_perf:error_rate_5m" "$FILE"; check "에러율 패널 존재" $?
grep -q "webhook_perf:total_requests_rate_5m" "$FILE"; check "요청률 패널 존재" $?
grep -q "webhook_perf:requests_by_type" "$FILE"; check "유형별 분포 패널 존재" $?
echo ""

# --- YAML 유효성 ---
echo "[4/4] YAML 유효성 검증"
for f in infra/monitoring/webhook-performance-rules.yaml infra/monitoring/webhook-performance-alerts.yaml; do
  python3 -c "import yaml; yaml.safe_load(open('$f'))" 2>/dev/null; check "$f YAML 유효성" $?
done
echo ""

# --- 결과 ---
echo "========================================"
echo "테스트 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "========================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
