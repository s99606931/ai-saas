#!/bin/bash
# MTU-N234: OTel Collector 성능 모니터링 — 검증 스크립트
set -euo pipefail
PASS=0; FAIL=0; TOTAL=0
check() { TOTAL=$((TOTAL+1)); if [ "$2" = "true" ]; then echo "[PASS] TC$TOTAL: $1"; PASS=$((PASS+1)); else echo "[FAIL] TC$TOTAL: $1"; FAIL=$((FAIL+1)); fi; }

echo "============================================="
echo "MTU-N234: OTel Collector 성능 모니터링 검증"
echo "============================================="

RULES="infra/monitoring/otel-collector-performance-rules.yaml"
ALERTS="infra/monitoring/otel-collector-performance-alerts.yaml"
DASH="infra/monitoring/dashboards/otel-collector-performance-dashboard.json"

check "Recording Rules 존재" "$([ -f "$RULES" ] && echo true || echo false)"
check "receiver accepted_rate" "$(grep -q 'otelcol:receiver:accepted_rate' "$RULES" && echo true || echo false)"
check "receiver refused_ratio" "$(grep -q 'otelcol:receiver:refused_ratio' "$RULES" && echo true || echo false)"
check "processor dropped_rate" "$(grep -q 'otelcol:processor:dropped_rate' "$RULES" && echo true || echo false)"
check "exporter sent_rate" "$(grep -q 'otelcol:exporter:sent_rate' "$RULES" && echo true || echo false)"
check "exporter failed_rate" "$(grep -q 'otelcol:exporter:failed_rate' "$RULES" && echo true || echo false)"
check "exporter failure_ratio" "$(grep -q 'otelcol:exporter:failure_ratio' "$RULES" && echo true || echo false)"
check "exporter queue_size" "$(grep -q 'otelcol:exporter:queue_size' "$RULES" && echo true || echo false)"

check "Alert Rules 존재" "$([ -f "$ALERTS" ] && echo true || echo false)"
check "OtelCollectorNotRunning" "$(grep -q 'OtelCollectorNotRunning' "$ALERTS" && echo true || echo false)"
check "OtelCollectorExporterFailing" "$(grep -q 'OtelCollectorExporterFailing' "$ALERTS" && echo true || echo false)"
check "OtelCollectorDropping" "$(grep -q 'OtelCollectorDropping' "$ALERTS" && echo true || echo false)"
check "OtelCollectorQueueNearFull" "$(grep -q 'OtelCollectorQueueNearFull' "$ALERTS" && echo true || echo false)"
check "OtelCollectorMemoryHigh" "$(grep -q 'OtelCollectorMemoryHigh' "$ALERTS" && echo true || echo false)"

check "대시보드 존재" "$([ -f "$DASH" ] && echo true || echo false)"
check "유효 JSON" "$(python3 -c 'import json; json.load(open("'"$DASH"'"))' 2>/dev/null && echo true || echo false)"
check "수신 성능 패널" "$(grep -q '수신 성능' "$DASH" && echo true || echo false)"
check "처리 / 내보내기 패널" "$(grep -q '처리' "$DASH" && echo true || echo false)"
check "리소스 패널" "$(grep -q '리소스' "$DASH" && echo true || echo false)"

check "critical severity" "$(grep -q 'severity: critical' "$ALERTS" && echo true || echo false)"
check "warning severity" "$(grep -q 'severity: warning' "$ALERTS" && echo true || echo false)"
check "CSAP D-06 참조" "$(grep -q 'csap_ref.*D-06' "$ALERTS" && echo true || echo false)"

echo ""
echo "결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
[ $FAIL -eq 0 ] && echo "MTU-N234: 모든 검증 통과" || echo "MTU-N234: $FAIL 건 실패"
exit $FAIL
