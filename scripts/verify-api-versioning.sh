#!/usr/bin/env bash
# Design Ref: MTU-N165
# Plan SC: FR-N165.5
set -euo pipefail

PASS=0; FAIL=0; WARN=0
check_pass() { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
check_fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }
check_warn() { echo "  [WARN] $1"; WARN=$((WARN + 1)); }

echo ""
echo "========================================"
echo " API 버전 관리 검증"
echo "========================================"

echo ""
echo "--- 1. 정책 파일 검증 ---"
for f in versioning-policy.yaml prometheus-rules.yaml grafana-dashboard.json; do
  if [[ -f "/data/ai-saas/infra/api-versioning/${f}" ]]; then
    check_pass "${f}"
  else
    check_fail "${f} 없음"
  fi
done

echo ""
echo "--- 2. 스크립트 검증 ---"
if [[ -x "/data/ai-saas/scripts/api-compatibility-check.sh" ]]; then
  check_pass "api-compatibility-check.sh (실행 권한 OK)"
else
  check_fail "api-compatibility-check.sh (실행 권한 없음)"
fi

echo ""
echo "========================================"
echo " 결과: PASS=${PASS} FAIL=${FAIL} WARN=${WARN}"
echo "========================================"
[[ ${FAIL} -gt 0 ]] && exit 1 || exit 0
