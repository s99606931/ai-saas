#!/bin/bash
# MTU-N179: 네트워크 품질 모니터링 검증 스크립트
# Design Ref: DESIGN-N179
# Plan SC: FR-N179.1 ~ FR-N179.6
# CSAP: D-13 (네트워크 보안), D-06 (감사 로깅)
set -euo pipefail

PASS=0
FAIL=0
TOTAL=0

check() {
  local desc="$1"
  local result="$2"
  TOTAL=$((TOTAL + 1))
  if [ "$result" = "0" ]; then
    echo "[PASS] $desc"
    PASS=$((PASS + 1))
  else
    echo "[FAIL] $desc"
    FAIL=$((FAIL + 1))
  fi
}

echo "============================================"
echo "MTU-N179: 네트워크 품질 모니터링 검증"
echo "일시: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
echo ""

# TC-N179.1: PrometheusRule YAML 유효성
echo "--- TC-N179.1: PrometheusRule 파일 검증 ---"
RULES_FILE="infra/monitoring/network-quality-rules.yaml"
check "PrometheusRule 파일 존재" "$(test -f "$RULES_FILE" && echo 0 || echo 1)"
check "YAML 구조 유효성 (kind: PrometheusRule)" "$(grep -q 'kind: PrometheusRule' "$RULES_FILE" && echo 0 || echo 1)"
check "recording rules 그룹 존재" "$(grep -q 'network-quality.recording' "$RULES_FILE" && echo 0 || echo 1)"
check "alerting rules 그룹 존재" "$(grep -q 'network-quality.alerts' "$RULES_FILE" && echo 0 || echo 1)"
check "CSAP D-13 라벨 존재" "$(grep -q 'csap-control: D-13' "$RULES_FILE" && echo 0 || echo 1)"
check "N2SF 라벨 존재" "$(grep -q 'n2sf-domain: network' "$RULES_FILE" && echo 0 || echo 1)"

# TC-N179.1: TCP 재전송률 recording rule
echo ""
echo "--- TC-N179.1: TCP 재전송률 모니터링 ---"
check "tcp_retransmit_rate recording rule" "$(grep -q 'node:network:tcp_retransmit_rate' "$RULES_FILE" && echo 0 || echo 1)"
check "tcp_retransmit_per_sec recording rule" "$(grep -q 'node:network:tcp_retransmit_per_sec' "$RULES_FILE" && echo 0 || echo 1)"
check "NetworkTcpRetransmitRateHigh 알림" "$(grep -q 'NetworkTcpRetransmitRateHigh' "$RULES_FILE" && echo 0 || echo 1)"
check "NetworkTcpRetransmitRateCritical 알림" "$(grep -q 'NetworkTcpRetransmitRateCritical' "$RULES_FILE" && echo 0 || echo 1)"

# TC-N179.2: 대역폭 사용률 모니터링
echo ""
echo "--- TC-N179.2: 대역폭 사용률 모니터링 ---"
check "bandwidth_utilization recording rule" "$(grep -q 'node:network:bandwidth_utilization' "$RULES_FILE" && echo 0 || echo 1)"
check "receive_bandwidth_bytes recording rule" "$(grep -q 'node:network:receive_bandwidth_bytes' "$RULES_FILE" && echo 0 || echo 1)"
check "transmit_bandwidth_bytes recording rule" "$(grep -q 'node:network:transmit_bandwidth_bytes' "$RULES_FILE" && echo 0 || echo 1)"
check "NetworkBandwidthUtilizationHigh 알림 (80%)" "$(grep -q 'NetworkBandwidthUtilizationHigh' "$RULES_FILE" && echo 0 || echo 1)"
check "NetworkBandwidthUtilizationCritical 알림 (95%)" "$(grep -q 'NetworkBandwidthUtilizationCritical' "$RULES_FILE" && echo 0 || echo 1)"

# TC-N179.3: 패킷 손실률 모니터링
echo ""
echo "--- TC-N179.3: 패킷 손실률 모니터링 ---"
check "packet_loss_rate recording rule" "$(grep -q 'node:network:packet_loss_rate' "$RULES_FILE" && echo 0 || echo 1)"
check "error_rate recording rule" "$(grep -q 'node:network:error_rate' "$RULES_FILE" && echo 0 || echo 1)"
check "NetworkPacketLossRateHigh 알림" "$(grep -q 'NetworkPacketLossRateHigh' "$RULES_FILE" && echo 0 || echo 1)"
check "NetworkPacketLossRateCritical 알림" "$(grep -q 'NetworkPacketLossRateCritical' "$RULES_FILE" && echo 0 || echo 1)"
check "NetworkInterfaceErrors 알림" "$(grep -q 'NetworkInterfaceErrors' "$RULES_FILE" && echo 0 || echo 1)"

# TC-N179.4: Grafana 대시보드 검증
echo ""
echo "--- TC-N179.4: Grafana 대시보드 검증 ---"
DASHBOARD_FILE="infra/monitoring/dashboards/network-quality.json"
check "대시보드 파일 존재" "$(test -f "$DASHBOARD_FILE" && echo 0 || echo 1)"
check "대시보드 JSON 유효성" "$(python3 -c 'import json; json.load(open("'"$DASHBOARD_FILE"'"))' 2>/dev/null && echo 0 || echo 1)"
check "TCP 재전송률 패널" "$(grep -q 'tcp_retransmit_rate' "$DASHBOARD_FILE" && echo 0 || echo 1)"
check "대역폭 사용률 패널" "$(grep -q 'bandwidth_utilization' "$DASHBOARD_FILE" && echo 0 || echo 1)"
check "패킷 손실률 패널" "$(grep -q 'packet_loss_rate' "$DASHBOARD_FILE" && echo 0 || echo 1)"
check "RTT 패널" "$(grep -q 'tcp_rtt_avg_seconds' "$DASHBOARD_FILE" && echo 0 || echo 1)"
check "네트워크 품질 종합 점수 패널" "$(grep -q 'quality_score' "$DASHBOARD_FILE" && echo 0 || echo 1)"
check "N2SF 등급별 트래픽 패널" "$(grep -q 'traffic_by_grade' "$DASHBOARD_FILE" && echo 0 || echo 1)"

# TC-N179.5: N2SF 영역별 네트워크 모니터링
echo ""
echo "--- TC-N179.5: N2SF 영역별 네트워크 모니터링 ---"
check "n2sf traffic_by_grade_receive recording rule" "$(grep -q 'n2sf:network:traffic_by_grade_receive' "$RULES_FILE" && echo 0 || echo 1)"
check "n2sf traffic_by_grade_transmit recording rule" "$(grep -q 'n2sf:network:traffic_by_grade_transmit' "$RULES_FILE" && echo 0 || echo 1)"
check "N2SF C등급 이상 트래픽 알림" "$(grep -q 'N2sfGradeCNetworkAnomaly' "$RULES_FILE" && echo 0 || echo 1)"

# TC-N179.6: RTT 모니터링
echo ""
echo "--- TC-N179.6: RTT 모니터링 ---"
check "tcp_rtt_avg_seconds recording rule" "$(grep -q 'node:network:tcp_rtt_avg_seconds' "$RULES_FILE" && echo 0 || echo 1)"
check "tcp_rtt_p99_seconds recording rule" "$(grep -q 'node:network:tcp_rtt_p99_seconds' "$RULES_FILE" && echo 0 || echo 1)"
check "NetworkHighLatency 알림 (100ms)" "$(grep -q 'NetworkHighLatency' "$RULES_FILE" && echo 0 || echo 1)"
check "NetworkHighLatencyCritical 알림 (500ms)" "$(grep -q 'NetworkHighLatencyCritical' "$RULES_FILE" && echo 0 || echo 1)"

# 종합 점수 알림 검증
echo ""
echo "--- 종합 품질 점수 알림 ---"
check "NetworkQualityScoreLow 알림" "$(grep -q 'NetworkQualityScoreLow' "$RULES_FILE" && echo 0 || echo 1)"
check "NetworkQualityScoreCritical 알림" "$(grep -q 'NetworkQualityScoreCritical' "$RULES_FILE" && echo 0 || echo 1)"

# 보안 검증
echo ""
echo "--- 보안 검증 ---"
check "하드코딩 시크릿 없음 (rules)" "$(grep -qiE '(password|secret|token|api.?key)\s*[:=]' "$RULES_FILE" && echo 1 || echo 0)"
check "하드코딩 시크릿 없음 (dashboard)" "$(grep -qiE '(password|secret|token|api.?key)\s*[:=]' "$DASHBOARD_FILE" && echo 1 || echo 0)"

echo ""
echo "============================================"
echo "검증 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
echo "모든 검증 통과"
