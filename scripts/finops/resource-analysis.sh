#!/bin/bash
# =============================================================================
# 네임스페이스별 리소스 사용량 분석
# Design Ref: MTU-N59 Section 3.1
# Plan SC: FR-N59.1
# =============================================================================

set -euo pipefail

echo "=============================================="
echo " 리소스 사용량 분석 리포트"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="

NAMESPACES="${1:-saas default monitoring flux-system}"

for ns in $NAMESPACES; do
  echo ""
  echo "--- 네임스페이스: ${ns} ---"

  # CPU/메모리 요청/제한 합계
  CPU_REQ=$(kubectl get pods -n "$ns" -o json 2>/dev/null | \
    python3 -c "
import json, sys
data = json.load(sys.stdin)
total = 0
for pod in data.get('items', []):
  for c in pod.get('spec', {}).get('containers', []):
    req = c.get('resources', {}).get('requests', {}).get('cpu', '0')
    if 'm' in str(req):
      total += int(str(req).replace('m', ''))
    else:
      total += int(float(str(req)) * 1000)
print(f'{total}m')
" 2>/dev/null || echo "N/A")

  MEM_REQ=$(kubectl get pods -n "$ns" -o json 2>/dev/null | \
    python3 -c "
import json, sys
data = json.load(sys.stdin)
total = 0
for pod in data.get('items', []):
  for c in pod.get('spec', {}).get('containers', []):
    req = c.get('resources', {}).get('requests', {}).get('memory', '0')
    if 'Gi' in str(req):
      total += int(float(str(req).replace('Gi', '')) * 1024)
    elif 'Mi' in str(req):
      total += int(str(req).replace('Mi', ''))
    elif 'Ki' in str(req):
      total += int(int(str(req).replace('Ki', '')) / 1024)
print(f'{total}Mi')
" 2>/dev/null || echo "N/A")

  POD_COUNT=$(kubectl get pods -n "$ns" --no-headers 2>/dev/null | wc -l || echo "0")
  DEPLOY_COUNT=$(kubectl get deploy -n "$ns" --no-headers 2>/dev/null | wc -l || echo "0")

  echo "  Pod 수: ${POD_COUNT}"
  echo "  Deployment 수: ${DEPLOY_COUNT}"
  echo "  CPU 요청 합계: ${CPU_REQ}"
  echo "  메모리 요청 합계: ${MEM_REQ}"
done

echo ""
echo "=============================================="
echo " 분석 완료. 오버프로비저닝 확인: ./overprovisioning-check.sh"
echo "=============================================="
