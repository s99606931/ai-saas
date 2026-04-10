#!/bin/bash
# =============================================================================
# MTU-N233: Grafana 자체 성능 모니터링 — 검증 스크립트
# Plan SC: FR-N233.1 ~ FR-N233.6
# =============================================================================
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
check() { TOTAL=$((TOTAL+1)); if [ "$2" = "true" ]; then echo "[PASS] TC$TOTAL: $1"; PASS=$((PASS+1)); else echo "[FAIL] TC$TOTAL: $1"; FAIL=$((FAIL+1)); fi; }

echo "============================================="
echo "MTU-N233: Grafana 자체 성능 모니터링 검증"
echo "============================================="
echo ""

RULES="infra/monitoring/grafana-self-rules.yaml"
ALERTS="infra/monitoring/grafana-self-alerts.yaml"
DASH="infra/monitoring/dashboards/grafana-self-dashboard.json"

check "Recording Rules 파일 존재" "$([ -f "$RULES" ] && echo true || echo false)"
check "api request_duration_p99 rule" "$(grep -q 'grafana:api:request_duration_p99' "$RULES" && echo true || echo false)"
check "api error_rate rule" "$(grep -q 'grafana:api:error_rate' "$RULES" && echo true || echo false)"
check "api request_rate rule" "$(grep -q 'grafana:api:request_rate' "$RULES" && echo true || echo false)"
check "auth login_attempts rule" "$(grep -q 'grafana:auth:login_attempts_rate' "$RULES" && echo true || echo false)"
check "auth login_failures rule" "$(grep -q 'grafana:auth:login_failures_rate' "$RULES" && echo true || echo false)"
check "users active_count rule" "$(grep -q 'grafana:users:active_count' "$RULES" && echo true || echo false)"

check "Alert Rules 파일 존재" "$([ -f "$ALERTS" ] && echo true || echo false)"
check "GrafanaNotRunning 알림" "$(grep -q 'GrafanaNotRunning' "$ALERTS" && echo true || echo false)"
check "GrafanaAPIErrorHigh 알림" "$(grep -q 'GrafanaAPIErrorHigh' "$ALERTS" && echo true || echo false)"
check "GrafanaAPISlowP99 알림" "$(grep -q 'GrafanaAPISlowP99' "$ALERTS" && echo true || echo false)"
check "GrafanaLoginFailureSpike 알림" "$(grep -q 'GrafanaLoginFailureSpike' "$ALERTS" && echo true || echo false)"
check "GrafanaMemoryHigh 알림" "$(grep -q 'GrafanaMemoryHigh' "$ALERTS" && echo true || echo false)"
check "GrafanaCPUHigh 알림" "$(grep -q 'GrafanaCPUHigh' "$ALERTS" && echo true || echo false)"

check "대시보드 JSON 존재" "$([ -f "$DASH" ] && echo true || echo false)"
check "대시보드 유효 JSON" "$(python3 -c 'import json; json.load(open("'"$DASH"'"))' 2>/dev/null && echo true || echo false)"
check "API 성능 패널" "$(grep -q 'API 성능' "$DASH" && echo true || echo false)"
check "인증 패널" "$(grep -q '인증' "$DASH" && echo true || echo false)"
check "리소스 패널" "$(grep -q '리소스' "$DASH" && echo true || echo false)"

check "critical severity" "$(grep -q 'severity: critical' "$ALERTS" && echo true || echo false)"
check "warning severity" "$(grep -q 'severity: warning' "$ALERTS" && echo true || echo false)"
check "CSAP D-06 참조" "$(grep -q 'csap_ref.*D-06' "$ALERTS" && echo true || echo false)"
check "CSAP D-08 참조" "$(grep -q 'csap_ref.*D-08' "$ALERTS" && echo true || echo false)"

echo ""
echo "============================================="
echo "검증 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "============================================="
[ $FAIL -eq 0 ] && echo "MTU-N233: 모든 검증 통과" || echo "MTU-N233: $FAIL 건 실패"
exit $FAIL
