#!/bin/bash
# OpenCost 설치 스크립트
# Design Ref: MTU-N72 §2

set -euo pipefail

echo "=== OpenCost 설치 시작 ==="

# Helm 레포 추가
helm repo add opencost https://opencost.github.io/opencost-helm-chart 2>/dev/null || true
helm repo update

# OpenCost 설치
helm upgrade --install opencost opencost/opencost \
  --namespace opencost --create-namespace \
  --values /data/ai-saas/infra/finops/opencost/values.yaml \
  --wait --timeout 5m

echo "=== OpenCost 설치 완료 ==="
echo "UI: kubectl port-forward -n opencost svc/opencost 9090:9090"
