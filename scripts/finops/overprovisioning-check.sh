#!/bin/bash
# =============================================================================
# 리소스 오버프로비저닝 탐지
# Design Ref: MTU-N59 Section 3.2
# Plan SC: FR-N59.2
#
# CPU/메모리 사용률이 요청 대비 20% 미만인 서비스를 탐지합니다.
# =============================================================================

set -euo pipefail

THRESHOLD="${1:-20}"      # 기본 20% 미만이면 오버프로비저닝
NAMESPACE="${2:-saas}"

echo "=============================================="
echo " 오버프로비저닝 탐지 (임계값: ${THRESHOLD}%)"
echo " 네임스페이스: ${NAMESPACE}"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="

# Prometheus에서 실제 사용률 조회
PROM_URL="${PROMETHEUS_URL:-http://kube-prometheus-stack-prometheus.monitoring:9090}"

echo ""
echo "[CPU 오버프로비저닝 탐지]"
# CPU 사용률 대비 요청 비율
CPU_QUERY="100 * sum by (pod, namespace) (rate(container_cpu_usage_seconds_total{namespace=\"${NAMESPACE}\"}[5m])) / sum by (pod, namespace) (kube_pod_container_resource_requests{namespace=\"${NAMESPACE}\", resource=\"cpu\"})"

curl -sG "${PROM_URL}/api/v1/query" --data-urlencode "query=${CPU_QUERY}" 2>/dev/null | \
  python3 -c "
import json, sys
try:
  data = json.load(sys.stdin)
  results = data.get('data', {}).get('result', [])
  overprovisioned = []
  for r in results:
    pod = r['metric'].get('pod', 'unknown')
    usage = float(r['value'][1])
    if usage < ${THRESHOLD}:
      overprovisioned.append((pod, usage))
  if overprovisioned:
    for pod, usage in sorted(overprovisioned, key=lambda x: x[1]):
      print(f'  [OVER] {pod}: CPU 사용률 {usage:.1f}% (요청 대비)')
  else:
    print('  모든 서비스 CPU 사용률 정상')
except:
  print('  [SKIP] Prometheus 연결 불가 (오프라인 모드)')
" 2>/dev/null || echo "  [SKIP] Prometheus 미연결"

echo ""
echo "[메모리 오버프로비저닝 탐지]"
MEM_QUERY="100 * sum by (pod, namespace) (container_memory_working_set_bytes{namespace=\"${NAMESPACE}\"}) / sum by (pod, namespace) (kube_pod_container_resource_requests{namespace=\"${NAMESPACE}\", resource=\"memory\"})"

curl -sG "${PROM_URL}/api/v1/query" --data-urlencode "query=${MEM_QUERY}" 2>/dev/null | \
  python3 -c "
import json, sys
try:
  data = json.load(sys.stdin)
  results = data.get('data', {}).get('result', [])
  overprovisioned = []
  for r in results:
    pod = r['metric'].get('pod', 'unknown')
    usage = float(r['value'][1])
    if usage < ${THRESHOLD}:
      overprovisioned.append((pod, usage))
  if overprovisioned:
    for pod, usage in sorted(overprovisioned, key=lambda x: x[1]):
      print(f'  [OVER] {pod}: 메모리 사용률 {usage:.1f}% (요청 대비)')
  else:
    print('  모든 서비스 메모리 사용률 정상')
except:
  print('  [SKIP] Prometheus 연결 불가')
" 2>/dev/null || echo "  [SKIP] Prometheus 미연결"

echo ""
echo "[최적화 권고]"
echo "  1. 오버프로비저닝된 서비스의 requests 하향 조정"
echo "  2. VPA 추천값 참고: kubectl get vpa -n ${NAMESPACE}"
echo "  3. 상세 Runbook: scripts/finops/optimization-runbook.md"
echo ""
echo "=============================================="
