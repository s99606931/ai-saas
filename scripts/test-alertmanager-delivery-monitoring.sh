#!/bin/bash
# =============================================================================
# MTU-N232: AlertManager 알림 전달 성능 모니터링 — 검증 스크립트
# Design Ref: MTU-N232 §1
# Plan SC: FR-N232.1 ~ FR-N232.6
# CSAP: D-06
# =============================================================================
set -euo pipefail

PASS=0
FAIL=0
TOTAL=0

check() {
  TOTAL=$((TOTAL + 1))
  local desc="$1"
  local result="$2"
  if [ "$result" = "true" ]; then
    echo "[PASS] TC$TOTAL: $desc"
    PASS=$((PASS + 1))
  else
    echo "[FAIL] TC$TOTAL: $desc"
    FAIL=$((FAIL + 1))
  fi
}

echo "============================================="
echo "MTU-N232: AlertManager 알림 전달 성능 검증"
echo "============================================="
echo ""

# TC1: 전달 성공/실패 Recording Rules (FR-N232.1)
RULES="infra/monitoring/alertmanager-delivery-rules.yaml"
check "Recording Rules 파일 존재" \
  "$([ -f "$RULES" ] && echo true || echo false)"

check "notifications total_rate5m rule" \
  "$(grep -q 'alertmanager:notifications:total_rate5m' "$RULES" && echo true || echo false)"

check "notifications success_rate5m rule" \
  "$(grep -q 'alertmanager:notifications:success_rate5m' "$RULES" && echo true || echo false)"

check "notifications failure_rate5m rule" \
  "$(grep -q 'alertmanager:notifications:failure_rate5m' "$RULES" && echo true || echo false)"

check "notifications failure_ratio rule" \
  "$(grep -q 'alertmanager:notifications:failure_ratio' "$RULES" && echo true || echo false)"

# TC2: 전달 지연 Recording Rules (FR-N232.2)
check "notification latency_p50 rule" \
  "$(grep -q 'alertmanager:notification:latency_p50' "$RULES" && echo true || echo false)"

check "notification latency_p99 rule" \
  "$(grep -q 'alertmanager:notification:latency_p99' "$RULES" && echo true || echo false)"

# TC3: 억제/무음 Recording Rules (FR-N232.3)
check "alerts active_count rule" \
  "$(grep -q 'alertmanager:alerts:active_count' "$RULES" && echo true || echo false)"

check "alerts suppressed_count rule" \
  "$(grep -q 'alertmanager:alerts:suppressed_count' "$RULES" && echo true || echo false)"

check "silences active_count rule" \
  "$(grep -q 'alertmanager:silences:active_count' "$RULES" && echo true || echo false)"

check "dispatch groups_count rule" \
  "$(grep -q 'alertmanager:dispatch:groups_count' "$RULES" && echo true || echo false)"

# TC4: AlertManager 자체 상태 알림 (FR-N232.4)
ALERTS="infra/monitoring/alertmanager-delivery-alerts.yaml"
check "Alert Rules 파일 존재" \
  "$([ -f "$ALERTS" ] && echo true || echo false)"

check "AlertManagerNotificationFailing 알림" \
  "$(grep -q 'AlertManagerNotificationFailing' "$ALERTS" && echo true || echo false)"

check "AlertManagerNotRunning 알림" \
  "$(grep -q 'AlertManagerNotRunning' "$ALERTS" && echo true || echo false)"

check "AlertManagerHighLatency 알림" \
  "$(grep -q 'AlertManagerHighLatency' "$ALERTS" && echo true || echo false)"

check "AlertManagerAlertStorm 알림" \
  "$(grep -q 'AlertManagerAlertStorm' "$ALERTS" && echo true || echo false)"

# TC5: 대시보드 (FR-N232.5)
DASH="infra/monitoring/dashboards/alertmanager-delivery-dashboard.json"
check "대시보드 JSON 존재" \
  "$([ -f "$DASH" ] && echo true || echo false)"

check "대시보드 유효 JSON" \
  "$(python3 -c 'import json; json.load(open("'"$DASH"'"))' 2>/dev/null && echo true || echo false)"

check "전달 성공/실패 패널" \
  "$(grep -q '전달 성공/실패' "$DASH" && echo true || echo false)"

check "전달 지연 패널" \
  "$(grep -q '전달 지연' "$DASH" && echo true || echo false)"

check "억제 / 무음 패널" \
  "$(grep -q '억제' "$DASH" && echo true || echo false)"

check "클러스터 / 리소스 패널" \
  "$(grep -q '클러스터' "$DASH" && echo true || echo false)"

# TC6: severity 분류 (FR-N232.6)
check "critical severity" \
  "$(grep -q 'severity: critical' "$ALERTS" && echo true || echo false)"

check "warning severity" \
  "$(grep -q 'severity: warning' "$ALERTS" && echo true || echo false)"

check "CSAP D-06 참조" \
  "$(grep -q 'csap_ref.*D-06' "$ALERTS" && echo true || echo false)"

check "Design Ref 주석" \
  "$(grep -q 'Design Ref' "$ALERTS" && echo true || echo false)"

check "Plan SC 주석" \
  "$(grep -q 'Plan SC' "$ALERTS" && echo true || echo false)"

echo ""
echo "============================================="
echo "검증 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "============================================="

if [ $FAIL -eq 0 ]; then
  echo "MTU-N232: 모든 검증 통과"
  exit 0
else
  echo "MTU-N232: $FAIL 건 실패"
  exit 1
fi
