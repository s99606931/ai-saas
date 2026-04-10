#!/bin/bash
# =============================================================================
# MTU-N235: Round 24 통합 점검 — 검증 스크립트
# Design Ref: MTU-N235 §1
# Plan SC: FR-N235.1 ~ FR-N235.4
# =============================================================================
set -euo pipefail
PASS=0; FAIL=0; TOTAL=0
check() { TOTAL=$((TOTAL+1)); if [ "$2" = "true" ]; then echo "[PASS] TC$TOTAL: $1"; PASS=$((PASS+1)); else echo "[FAIL] TC$TOTAL: $1"; FAIL=$((FAIL+1)); fi; }

echo "============================================="
echo "MTU-N235: Round 24 통합 점검 검증"
echo "============================================="
echo ""

# FR-N235.1: 전체 MTU 산출물 존재 확인
echo "--- MTU-N229: Loki 파이프라인 ---"
check "N229 Recording Rules" "$([ -f infra/monitoring/loki-pipeline-rules.yaml ] && echo true || echo false)"
check "N229 Alert Rules" "$([ -f infra/monitoring/loki-pipeline-alerts.yaml ] && echo true || echo false)"
check "N229 대시보드" "$([ -f infra/monitoring/dashboards/loki-pipeline-dashboard.json ] && echo true || echo false)"

echo "--- MTU-N230: Tempo 성능 ---"
check "N230 Recording Rules" "$([ -f infra/monitoring/tempo-performance-rules.yaml ] && echo true || echo false)"
check "N230 Alert Rules" "$([ -f infra/monitoring/tempo-performance-alerts.yaml ] && echo true || echo false)"
check "N230 대시보드" "$([ -f infra/monitoring/dashboards/tempo-performance-dashboard.json ] && echo true || echo false)"

echo "--- MTU-N231: Prometheus 자체 ---"
check "N231 Recording Rules" "$([ -f infra/monitoring/prometheus-self-rules.yaml ] && echo true || echo false)"
check "N231 Alert Rules" "$([ -f infra/monitoring/prometheus-self-alerts.yaml ] && echo true || echo false)"
check "N231 대시보드" "$([ -f infra/monitoring/dashboards/prometheus-self-dashboard.json ] && echo true || echo false)"

echo "--- MTU-N232: AlertManager 전달 ---"
check "N232 Recording Rules" "$([ -f infra/monitoring/alertmanager-delivery-rules.yaml ] && echo true || echo false)"
check "N232 Alert Rules" "$([ -f infra/monitoring/alertmanager-delivery-alerts.yaml ] && echo true || echo false)"
check "N232 대시보드" "$([ -f infra/monitoring/dashboards/alertmanager-delivery-dashboard.json ] && echo true || echo false)"

echo "--- MTU-N233: Grafana 자체 ---"
check "N233 Recording Rules" "$([ -f infra/monitoring/grafana-self-rules.yaml ] && echo true || echo false)"
check "N233 Alert Rules" "$([ -f infra/monitoring/grafana-self-alerts.yaml ] && echo true || echo false)"
check "N233 대시보드" "$([ -f infra/monitoring/dashboards/grafana-self-dashboard.json ] && echo true || echo false)"

echo "--- MTU-N234: OTel Collector ---"
check "N234 Recording Rules" "$([ -f infra/monitoring/otel-collector-performance-rules.yaml ] && echo true || echo false)"
check "N234 Alert Rules" "$([ -f infra/monitoring/otel-collector-performance-alerts.yaml ] && echo true || echo false)"
check "N234 대시보드" "$([ -f infra/monitoring/dashboards/otel-collector-performance-dashboard.json ] && echo true || echo false)"

# FR-N235.2 & FR-N235.3: 교차 참조 규칙
echo ""
echo "--- Round 24 교차 참조 ---"
XREF="infra/monitoring/round24-cross-reference-rules.yaml"
check "교차 참조 규칙 존재" "$([ -f "$XREF" ] && echo true || echo false)"
check "healthy_components rule" "$(grep -q 'observability:stack:healthy_components' "$XREF" && echo true || echo false)"
check "MultipleFailures 알림" "$(grep -q 'ObservabilityStackMultipleFailures' "$XREF" && echo true || echo false)"
check "TotalFailure 알림" "$(grep -q 'ObservabilityStackTotalFailure' "$XREF" && echo true || echo false)"
check "CSAP D-06 참조" "$(grep -q 'csap_ref.*D-06' "$XREF" && echo true || echo false)"

# 모든 대시보드 유효 JSON 확인
echo ""
echo "--- JSON 유효성 ---"
R24_JSON_OK="true"
for jf in \
  infra/monitoring/dashboards/loki-pipeline-dashboard.json \
  infra/monitoring/dashboards/tempo-performance-dashboard.json \
  infra/monitoring/dashboards/prometheus-self-dashboard.json \
  infra/monitoring/dashboards/alertmanager-delivery-dashboard.json \
  infra/monitoring/dashboards/grafana-self-dashboard.json \
  infra/monitoring/dashboards/otel-collector-performance-dashboard.json; do
  python3 -c "import json; json.load(open('$jf'))" 2>/dev/null || R24_JSON_OK="false"
done
check "Round 24 대시보드 JSON 유효" "$R24_JSON_OK"

# 아카이브 확인
echo ""
echo "--- 아카이브 확인 ---"
check "N229 아카이브" "$([ -d docs/archive/2026-04/MTU-N229-loki-log-pipeline ] && echo true || echo false)"
check "N230 아카이브" "$([ -d docs/archive/2026-04/MTU-N230-tempo-tracing-perf ] && echo true || echo false)"
check "N231 아카이브" "$([ -d docs/archive/2026-04/MTU-N231-prometheus-self-monitoring ] && echo true || echo false)"
check "N232 아카이브" "$([ -d docs/archive/2026-04/MTU-N232-alertmanager-delivery-perf ] && echo true || echo false)"
check "N233 아카이브" "$([ -d docs/archive/2026-04/MTU-N233-grafana-self-monitoring ] && echo true || echo false)"
check "N234 아카이브" "$([ -d docs/archive/2026-04/MTU-N234-otel-collector-monitoring ] && echo true || echo false)"

echo ""
echo "============================================="
echo "검증 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "============================================="
[ $FAIL -eq 0 ] && echo "MTU-N235: Round 24 통합 점검 모든 검증 통과" || echo "MTU-N235: $FAIL 건 실패"
exit $FAIL
