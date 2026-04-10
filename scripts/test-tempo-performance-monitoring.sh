#!/bin/bash
# =============================================================================
# MTU-N230: Tempo 분산 추적 성능 모니터링 — 검증 스크립트
# Design Ref: MTU-N230 §1
# Plan SC: FR-N230.1 ~ FR-N230.6
# CSAP: D-06(트레이스 파이프라인 무결성 검증)
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
echo "MTU-N230: Tempo 분산 추적 성능 모니터링 검증"
echo "============================================="
echo ""

# TC1: Recording Rules (FR-N230.1)
RULES="infra/monitoring/tempo-performance-rules.yaml"
check "Recording Rules 파일 존재" \
  "$([ -f "$RULES" ] && echo true || echo false)"

check "spans_received recording rule" \
  "$(grep -q 'tempo:ingester:spans_received_rate5m' "$RULES" && echo true || echo false)"

check "span_drop_ratio recording rule" \
  "$(grep -q 'tempo:pipeline:span_drop_ratio' "$RULES" && echo true || echo false)"

check "bytes_received recording rule" \
  "$(grep -q 'tempo:ingester:bytes_received_rate5m_mb' "$RULES" && echo true || echo false)"

# TC2: Query Alert Rules (FR-N230.2)
ALERTS="infra/monitoring/tempo-performance-alerts.yaml"
check "Alert Rules 파일 존재" \
  "$([ -f "$ALERTS" ] && echo true || echo false)"

check "TempoQuerySlowP99 알림" \
  "$(grep -q 'TempoQuerySlowP99' "$ALERTS" && echo true || echo false)"

check "TempoQueryErrors 알림" \
  "$(grep -q 'TempoQueryErrors' "$ALERTS" && echo true || echo false)"

check "TempoNotRunning 알림" \
  "$(grep -q 'TempoNotRunning' "$ALERTS" && echo true || echo false)"

# TC3: Storage Rules (FR-N230.3)
check "live_traces recording rule" \
  "$(grep -q 'tempo:ingester:live_traces' "$RULES" && echo true || echo false)"

check "blocks_count recording rule" \
  "$(grep -q 'tempo:ingester:blocks_count' "$RULES" && echo true || echo false)"

# TC4: Compactor Rules (FR-N230.4)
check "compactor duration recording rule" \
  "$(grep -q 'tempo:compactor:duration_avg_seconds' "$RULES" && echo true || echo false)"

check "blocks_compacted_rate recording rule" \
  "$(grep -q 'tempo:compactor:blocks_compacted_rate' "$RULES" && echo true || echo false)"

# TC5: Dashboard (FR-N230.5)
DASH="infra/monitoring/dashboards/tempo-performance-dashboard.json"
check "대시보드 JSON 존재" \
  "$([ -f "$DASH" ] && echo true || echo false)"

check "대시보드 유효 JSON" \
  "$(python3 -c 'import json; json.load(open("'"$DASH"'"))' 2>/dev/null && echo true || echo false)"

check "수집 현황 패널" \
  "$(grep -q '수집 현황' "$DASH" && echo true || echo false)"

check "WAL / 스토리지 패널" \
  "$(grep -q 'WAL' "$DASH" && echo true || echo false)"

check "쿼리 성능 패널" \
  "$(grep -q '쿼리 성능' "$DASH" && echo true || echo false)"

check "압축 / 리소스 패널" \
  "$(grep -q '압축' "$DASH" && echo true || echo false)"

# TC6: Alert severity (FR-N230.6)
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
  echo "MTU-N230: 모든 검증 통과"
  exit 0
else
  echo "MTU-N230: $FAIL 건 실패"
  exit 1
fi
