#!/bin/bash
# =============================================================================
# MTU-N231: Prometheus 자체 성능/리소스 모니터링 — 검증 스크립트
# Design Ref: MTU-N231 §1
# Plan SC: FR-N231.1 ~ FR-N231.6
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
echo "MTU-N231: Prometheus 자체 성능 모니터링 검증"
echo "============================================="
echo ""

# TC1: 스크랩 성능 Recording Rules (FR-N231.1)
RULES="infra/monitoring/prometheus-self-rules.yaml"
check "Recording Rules 파일 존재" \
  "$([ -f "$RULES" ] && echo true || echo false)"

check "scrape success_ratio rule" \
  "$(grep -q 'prometheus:scrape:success_ratio' "$RULES" && echo true || echo false)"

check "target active_count rule" \
  "$(grep -q 'prometheus:target:active_count' "$RULES" && echo true || echo false)"

check "scrape samples_rate rule" \
  "$(grep -q 'prometheus:scrape:samples_rate' "$RULES" && echo true || echo false)"

# TC2: TSDB Recording Rules (FR-N231.2)
check "tsdb head_series rule" \
  "$(grep -q 'prometheus:tsdb:head_series' "$RULES" && echo true || echo false)"

check "tsdb head_chunks rule" \
  "$(grep -q 'prometheus:tsdb:head_chunks' "$RULES" && echo true || echo false)"

check "tsdb wal_size rule" \
  "$(grep -q 'prometheus:tsdb:wal_size_mb' "$RULES" && echo true || echo false)"

check "tsdb compaction rule" \
  "$(grep -q 'prometheus:tsdb:compaction_duration_avg' "$RULES" && echo true || echo false)"

# TC3: 규칙 평가 알림 (FR-N231.3)
ALERTS="infra/monitoring/prometheus-self-alerts.yaml"
check "Alert Rules 파일 존재" \
  "$([ -f "$ALERTS" ] && echo true || echo false)"

check "PrometheusRuleEvaluationSlow 알림" \
  "$(grep -q 'PrometheusRuleEvaluationSlow' "$ALERTS" && echo true || echo false)"

check "PrometheusRuleFailures 알림" \
  "$(grep -q 'PrometheusRuleFailures' "$ALERTS" && echo true || echo false)"

# TC4: 리소스 알림 (FR-N231.4)
check "PrometheusMemoryHigh 알림" \
  "$(grep -q 'PrometheusMemoryHigh' "$ALERTS" && echo true || echo false)"

check "PrometheusNotRunning 알림" \
  "$(grep -q 'PrometheusNotRunning' "$ALERTS" && echo true || echo false)"

check "PrometheusHighCardinality 알림" \
  "$(grep -q 'PrometheusHighCardinality' "$ALERTS" && echo true || echo false)"

check "PrometheusWALLarge 알림" \
  "$(grep -q 'PrometheusWALLarge' "$ALERTS" && echo true || echo false)"

# TC5: 대시보드 (FR-N231.5)
DASH="infra/monitoring/dashboards/prometheus-self-dashboard.json"
check "대시보드 JSON 존재" \
  "$([ -f "$DASH" ] && echo true || echo false)"

check "대시보드 유효 JSON" \
  "$(python3 -c 'import json; json.load(open("'"$DASH"'"))' 2>/dev/null && echo true || echo false)"

check "스크랩 성능 패널" \
  "$(grep -q '스크랩 성능' "$DASH" && echo true || echo false)"

check "TSDB / WAL 패널" \
  "$(grep -q 'TSDB' "$DASH" && echo true || echo false)"

check "규칙 평가 패널" \
  "$(grep -q '규칙 평가' "$DASH" && echo true || echo false)"

check "리소스 사용량 패널" \
  "$(grep -q '리소스 사용량' "$DASH" && echo true || echo false)"

# TC6: 알림 severity (FR-N231.6)
check "critical severity" \
  "$(grep -q 'severity: critical' "$ALERTS" && echo true || echo false)"

check "warning severity" \
  "$(grep -q 'severity: warning' "$ALERTS" && echo true || echo false)"

check "CSAP D-06 참조" \
  "$(grep -q 'csap_ref.*D-06' "$ALERTS" && echo true || echo false)"

check "Design Ref 주석" \
  "$(grep -q 'Design Ref' "$ALERTS" && echo true || echo false)"

echo ""
echo "============================================="
echo "검증 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "============================================="

if [ $FAIL -eq 0 ]; then
  echo "MTU-N231: 모든 검증 통과"
  exit 0
else
  echo "MTU-N231: $FAIL 건 실패"
  exit 1
fi
