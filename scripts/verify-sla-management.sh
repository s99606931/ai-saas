#!/usr/bin/env bash
# Design Ref: MTU-N167
set -euo pipefail
PASS=0; FAIL=0; WARN=0
check_pass() { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
check_fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }

echo ""
echo "========================================"
echo " SLA 계약 관리 검증"
echo "========================================"

for f in sla-policy.yaml prometheus-rules.yaml grafana-dashboard.json; do
  if [[ -f "/data/ai-saas/infra/sla-management/${f}" ]]; then
    check_pass "${f}"
  else
    check_fail "${f} 없음"
  fi
done

echo ""
echo "========================================"
echo " 결과: PASS=${PASS} FAIL=${FAIL} WARN=${WARN}"
echo "========================================"
[[ ${FAIL} -gt 0 ]] && exit 1 || exit 0
