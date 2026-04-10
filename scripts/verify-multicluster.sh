#!/usr/bin/env bash
# Design Ref: MTU-N162
# Plan SC: FR-N162.6
# 멀티클러스터 페더레이션 검증 스크립트

set -euo pipefail

PASS=0; FAIL=0; WARN=0
check_pass() { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
check_fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }
check_warn() { echo "  [WARN] $1"; WARN=$((WARN + 1)); }

echo ""
echo "========================================"
echo " 멀티클러스터 페더레이션 검증"
echo " 검증 시각: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "========================================"

echo ""
echo "--- 1. 매니페스트 파일 검증 ---"
for f in federation-policy.yaml service-discovery.yaml cross-cluster-mtls.yaml prometheus-rules.yaml grafana-dashboard.json; do
  if [[ -f "/data/ai-saas/infra/multicluster/${f}" ]]; then
    check_pass "${f} 존재"
  else
    check_fail "${f} 없음"
  fi
done

echo ""
echo "--- 2. Linkerd 멀티클러스터 확인 ---"
if kubectl api-resources 2>/dev/null | grep -q "links.multicluster.linkerd.io"; then
  check_pass "Linkerd multicluster CRD 설치됨"
else
  check_warn "Linkerd multicluster CRD 미설치 (설치 후 적용)"
fi

echo ""
echo "--- 3. Prometheus 규칙 검증 ---"
local_rules="/data/ai-saas/infra/multicluster/prometheus-rules.yaml"
if [[ -f "${local_rules}" ]]; then
  rec=$(grep -c "record:" "${local_rules}" 2>/dev/null || echo "0")
  alert=$(grep -c "alert:" "${local_rules}" 2>/dev/null || echo "0")
  check_pass "레코딩 규칙 ${rec}개, 알림 규칙 ${alert}개"
fi

echo ""
echo "========================================"
echo " 결과: PASS=${PASS} FAIL=${FAIL} WARN=${WARN}"
echo "========================================"
[[ ${FAIL} -gt 0 ]] && exit 1 || exit 0
