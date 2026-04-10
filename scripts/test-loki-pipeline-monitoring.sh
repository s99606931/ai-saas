#!/bin/bash
# =============================================================================
# MTU-N229: Loki 로그 수집 파이프라인 모니터링 — 검증 스크립트
# Design Ref: MTU-N229 §1
# Plan SC: FR-N229.1 ~ FR-N229.6
# CSAP: D-06(로그 파이프라인 무결성 검증)
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
echo "MTU-N229: Loki 로그 파이프라인 모니터링 검증"
echo "============================================="
echo ""

# ---------------------------------------------------------------------------
# TC1: Recording Rules 파일 존재 및 구조 검증 (FR-N229.1)
# ---------------------------------------------------------------------------
RULES_FILE="infra/monitoring/loki-pipeline-rules.yaml"
check "Recording Rules 파일 존재" \
  "$([ -f "$RULES_FILE" ] && echo true || echo false)"

check "ingester lines_received recording rule 정의" \
  "$(grep -q 'loki:ingester:lines_received_rate5m' "$RULES_FILE" && echo true || echo false)"

check "pipeline drop_ratio recording rule 정의" \
  "$(grep -q 'loki:pipeline:drop_ratio' "$RULES_FILE" && echo true || echo false)"

check "promtail request_latency_p99 recording rule 정의" \
  "$(grep -q 'loki:promtail:request_latency_p99' "$RULES_FILE" && echo true || echo false)"

# ---------------------------------------------------------------------------
# TC2: Promtail 알림 규칙 검증 (FR-N229.2)
# ---------------------------------------------------------------------------
ALERTS_FILE="infra/monitoring/loki-pipeline-alerts.yaml"
check "Alert Rules 파일 존재" \
  "$([ -f "$ALERTS_FILE" ] && echo true || echo false)"

check "PromtailTargetsDown 알림 정의" \
  "$(grep -q 'PromtailTargetsDown' "$ALERTS_FILE" && echo true || echo false)"

check "PromtailRequestLatencyHigh 알림 정의" \
  "$(grep -q 'PromtailRequestLatencyHigh' "$ALERTS_FILE" && echo true || echo false)"

check "PromtailRequestErrors 알림 정의" \
  "$(grep -q 'PromtailRequestErrors' "$ALERTS_FILE" && echo true || echo false)"

check "PromtailNotRunning 알림 정의" \
  "$(grep -q 'PromtailNotRunning' "$ALERTS_FILE" && echo true || echo false)"

# ---------------------------------------------------------------------------
# TC3: 스토리지/압축 Recording Rule 검증 (FR-N229.3)
# ---------------------------------------------------------------------------
check "storage active_chunks recording rule 정의" \
  "$(grep -q 'loki:storage:active_chunks' "$RULES_FILE" && echo true || echo false)"

check "compactor duration recording rule 정의" \
  "$(grep -q 'loki:compactor:duration_avg_seconds' "$RULES_FILE" && echo true || echo false)"

# ---------------------------------------------------------------------------
# TC4: 쿼리 성능 알림 검증 (FR-N229.4)
# ---------------------------------------------------------------------------
check "LokiQuerySlowP99 알림 정의" \
  "$(grep -q 'LokiQuerySlowP99' "$ALERTS_FILE" && echo true || echo false)"

check "LokiQueryRetriesHigh 알림 정의" \
  "$(grep -q 'LokiQueryRetriesHigh' "$ALERTS_FILE" && echo true || echo false)"

# ---------------------------------------------------------------------------
# TC5: Grafana 대시보드 검증 (FR-N229.5)
# ---------------------------------------------------------------------------
DASHBOARD_FILE="infra/monitoring/dashboards/loki-pipeline-dashboard.json"
check "대시보드 JSON 파일 존재" \
  "$([ -f "$DASHBOARD_FILE" ] && echo true || echo false)"

check "대시보드 유효 JSON" \
  "$(python3 -c 'import json; json.load(open("'"$DASHBOARD_FILE"'"))' 2>/dev/null && echo true || echo false)"

check "대시보드에 수집 현황 패널 포함" \
  "$(grep -q '수집 현황' "$DASHBOARD_FILE" && echo true || echo false)"

check "대시보드에 드롭/에러 패널 포함" \
  "$(grep -q '드롭/에러' "$DASHBOARD_FILE" && echo true || echo false)"

check "대시보드에 스토리지 패널 포함" \
  "$(grep -q '스토리지' "$DASHBOARD_FILE" && echo true || echo false)"

check "대시보드에 쿼리 성능 패널 포함" \
  "$(grep -q '쿼리 성능' "$DASHBOARD_FILE" && echo true || echo false)"

# ---------------------------------------------------------------------------
# TC6: 알림 severity 분류 검증 (FR-N229.6)
# ---------------------------------------------------------------------------
check "critical severity 알림 존재" \
  "$(grep -q 'severity: critical' "$ALERTS_FILE" && echo true || echo false)"

check "warning severity 알림 존재" \
  "$(grep -q 'severity: warning' "$ALERTS_FILE" && echo true || echo false)"

check "CSAP D-06 참조 포함" \
  "$(grep -q 'csap_ref.*D-06' "$ALERTS_FILE" && echo true || echo false)"

check "Design Ref 주석 포함" \
  "$(grep -q 'Design Ref' "$ALERTS_FILE" && echo true || echo false)"

check "Plan SC 주석 포함" \
  "$(grep -q 'Plan SC' "$ALERTS_FILE" && echo true || echo false)"

# ---------------------------------------------------------------------------
# 결과 요약
# ---------------------------------------------------------------------------
echo ""
echo "============================================="
echo "검증 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "============================================="

if [ $FAIL -eq 0 ]; then
  echo "MTU-N229: 모든 검증 통과"
  exit 0
else
  echo "MTU-N229: $FAIL 건 실패 — 확인 필요"
  exit 1
fi
