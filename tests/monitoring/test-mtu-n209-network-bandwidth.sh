#!/bin/bash
# MTU-N209: 네트워크 대역폭 E2E 테스트
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="${SCRIPT_DIR}/../../infra/monitoring"
PASS=0; FAIL=0; TOTAL=0
pass() { PASS=$((PASS + 1)); TOTAL=$((TOTAL + 1)); echo "[PASS] $1"; }
fail() { FAIL=$((FAIL + 1)); TOTAL=$((TOTAL + 1)); echo "[FAIL] $1"; }

echo "=============================================="
echo "MTU-N209: 네트워크 대역폭 E2E 테스트"
echo "=============================================="

RULES="${INFRA_DIR}/network-bandwidth/network-bandwidth-rules.yaml"
ALERTS="${INFRA_DIR}/network-bandwidth/network-bandwidth-alerts.yaml"
DASH="${INFRA_DIR}/dashboards/network-bandwidth-dashboard.json"

echo ""; echo "--- FR-N209.1 노드 대역폭 ---"
for m in "net_bw:node_receive_bytes_rate" "net_bw:node_transmit_bytes_rate"; do
  grep -q "$m" "$RULES" && pass "$m" || fail "$m"
done

echo ""; echo "--- FR-N209.2 에러/드롭 ---"
for m in "net_bw:node_receive_errors_rate" "net_bw:node_transmit_errors_rate" "net_bw:node_receive_drop_rate" "net_bw:node_transmit_drop_rate"; do
  grep -q "$m" "$RULES" && pass "$m" || fail "$m"
done

echo ""; echo "--- FR-N209.3 Pod 대역폭 ---"
for m in "net_bw:pod_receive_bytes_rate" "net_bw:pod_transmit_bytes_rate" "net_bw:namespace_total_bandwidth"; do
  grep -q "$m" "$RULES" && pass "$m" || fail "$m"
done

echo ""; echo "--- FR-N209.4~5 알림 ---"
for a in "NetworkBandwidthHigh" "NetworkErrorsHigh" "NetworkDropsHigh"; do
  grep -q "$a" "$ALERTS" && pass "$a" || fail "$a"
done

echo ""; echo "--- FR-N209.6 대시보드 ---"
[ -f "$DASH" ] && pass "파일 존재" || fail "파일 미존재"
grep -q "net_bw:node_receive_bytes_rate" "$DASH" && pass "노드 대역폭 패널" || fail "노드 대역폭 패널"
grep -q "net_bw:namespace_total_bandwidth" "$DASH" && pass "네임스페이스 패널" || fail "네임스페이스 패널"
grep -q "net_bw:pod_receive_bytes_rate" "$DASH" && pass "Pod 대역폭 패널" || fail "Pod 대역폭 패널"

echo ""; echo "--- 유효성 ---"
python3 -c "import yaml; yaml.safe_load(open('$RULES'))" && pass "Rules YAML" || fail "Rules YAML"
python3 -c "import yaml; yaml.safe_load(open('$ALERTS'))" && pass "Alerts YAML" || fail "Alerts YAML"
python3 -c "import json; json.load(open('$DASH'))" && pass "Dashboard JSON" || fail "Dashboard JSON"
grep -q "csap.*D-10" "$ALERTS" && pass "CSAP D-10" || fail "CSAP D-10"

echo ""
echo "=============================================="
echo "MTU-N209 결과: ${PASS}/${TOTAL} 통과 (실패: ${FAIL})"
echo "=============================================="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
