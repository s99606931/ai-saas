#!/bin/bash
# =============================================================================
# 유휴 리소스 탐지 (0 트래픽 서비스)
# Design Ref: MTU-N59 Section 3.1
# Plan SC: FR-N59.6
# =============================================================================

set -euo pipefail

NAMESPACE="${1:-saas}"
IDLE_THRESHOLD="${2:-0.01}"  # 0.01 RPS 미만 = 유휴

echo "=============================================="
echo " 유휴 리소스 탐지"
echo " 네임스페이스: ${NAMESPACE}"
echo " 유휴 기준: RPS < ${IDLE_THRESHOLD}"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="

PROM_URL="${PROMETHEUS_URL:-http://kube-prometheus-stack-prometheus.monitoring:9090}"

echo ""
echo "[유휴 서비스 탐지]"
IDLE_QUERY="sum by (service) (rate(http_requests_total{namespace=\"${NAMESPACE}\"}[30m]))"

curl -sG "${PROM_URL}/api/v1/query" --data-urlencode "query=${IDLE_QUERY}" 2>/dev/null | \
  python3 -c "
import json, sys
try:
  data = json.load(sys.stdin)
  results = data.get('data', {}).get('result', [])
  idle = []
  active = []
  for r in results:
    svc = r['metric'].get('service', 'unknown')
    rps = float(r['value'][1])
    if rps < ${IDLE_THRESHOLD}:
      idle.append((svc, rps))
    else:
      active.append((svc, rps))
  if idle:
    print(f'  유휴 서비스 {len(idle)}개:')
    for svc, rps in idle:
      print(f'    - {svc}: {rps:.4f} RPS')
    print(f'  권고: KEDA scale-to-zero 적용 검토')
  else:
    print(f'  유휴 서비스 없음 (전체 {len(active)}개 활성)')
except:
  print('  [SKIP] Prometheus 연결 불가')
" 2>/dev/null || echo "  [SKIP] Prometheus 미연결"

echo ""
echo "[Pending/Failed Pod 탐지]"
PENDING=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l || echo "0")
FAILED=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Failed --no-headers 2>/dev/null | wc -l || echo "0")
echo "  Pending Pod: ${PENDING}개"
echo "  Failed Pod: ${FAILED}개"
if [ "$PENDING" -gt 0 ] || [ "$FAILED" -gt 0 ]; then
  echo "  권고: Pending/Failed Pod 정리로 리소스 회수"
fi

echo ""
echo "=============================================="
