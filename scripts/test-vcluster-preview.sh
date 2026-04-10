#!/bin/bash
# ============================================================
# MTU-N73: vCluster PR Preview 환경 검증 테스트
# Design Ref: MTU-N73
# Plan SC: FR-N73.5
# ============================================================

set -euo pipefail

PASS=0
FAIL=0
TOTAL=10

log_pass() { echo "  [PASS] $1"; PASS=$((PASS+1)); }
log_fail() { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }

echo "============================================================"
echo "MTU-N73: vCluster PR Preview 환경 검증"
echo "날짜: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
echo ""

BASE=/data/ai-saas/infra/vcluster

# VC-01: vCluster values.yaml 존재
echo "[VC-01] vCluster values.yaml 존재 확인"
if [ -f "$BASE/values.yaml" ] && grep -q 'isolation:' "$BASE/values.yaml"; then
  log_pass "vCluster values.yaml 격리 설정 포함"
else
  log_fail "vCluster values.yaml 미존재 또는 격리 미설정"
fi

# VC-02: PR Preview 워크플로우 존재
echo "[VC-02] PR Preview 워크플로우 확인"
if [ -f "$BASE/pr-preview-workflow.yaml" ] && grep -q 'vcluster create' "$BASE/pr-preview-workflow.yaml"; then
  log_pass "PR Preview 생성 워크플로우 정의됨"
else
  log_fail "PR Preview 워크플로우 미정의"
fi

# VC-03: PR 닫힘 시 삭제 워크플로우
echo "[VC-03] PR 닫힘 삭제 워크플로우 확인"
if grep -q 'vcluster delete' "$BASE/pr-preview-workflow.yaml" 2>/dev/null; then
  log_pass "PR 닫힘 시 삭제 워크플로우 정의됨"
else
  log_fail "PR 삭제 워크플로우 미정의"
fi

# VC-04: ResourceQuota 정의
echo "[VC-04] ResourceQuota 정책 확인"
if [ -f "$BASE/resource-policies.yaml" ] && grep -q 'ResourceQuota' "$BASE/resource-policies.yaml"; then
  log_pass "ResourceQuota 정의됨"
else
  log_fail "ResourceQuota 미정의"
fi

# VC-05: LimitRange 정의
echo "[VC-05] LimitRange 정책 확인"
if grep -q 'LimitRange' "$BASE/resource-policies.yaml" 2>/dev/null; then
  log_pass "LimitRange 정의됨"
else
  log_fail "LimitRange 미정의"
fi

# VC-06: NetworkPolicy 격리
echo "[VC-06] NetworkPolicy 격리 정책 확인"
if grep -q 'NetworkPolicy' "$BASE/resource-policies.yaml" 2>/dev/null; then
  log_pass "NetworkPolicy 격리 정의됨"
else
  log_fail "NetworkPolicy 미정의"
fi

# VC-07: TTL CronJob 존재
echo "[VC-07] TTL 자동 만료 CronJob 확인"
if [ -f "$BASE/ttl-cleanup.yaml" ] && grep -q 'CronJob' "$BASE/ttl-cleanup.yaml"; then
  log_pass "TTL CronJob 정의됨"
else
  log_fail "TTL CronJob 미정의"
fi

# VC-08: TTL 3일 설정 확인
echo "[VC-08] TTL 3일 (259200초) 설정 확인"
if grep -q '259200' "$BASE/ttl-cleanup.yaml" 2>/dev/null; then
  log_pass "TTL 3일 설정 확인"
else
  log_fail "TTL 설정 미확인"
fi

# VC-09: RBAC 정의 (cleanup SA)
echo "[VC-09] Cleanup ServiceAccount + RBAC 확인"
if grep -q 'ServiceAccount' "$BASE/ttl-cleanup.yaml" && grep -q 'ClusterRole' "$BASE/ttl-cleanup.yaml"; then
  log_pass "Cleanup RBAC 정의됨"
else
  log_fail "Cleanup RBAC 미정의"
fi

# VC-10: PSS Restricted 호환 확인
echo "[VC-10] CronJob PSS Restricted 호환 확인"
if grep -q 'runAsNonRoot: true' "$BASE/ttl-cleanup.yaml" && \
   grep -q 'allowPrivilegeEscalation: false' "$BASE/ttl-cleanup.yaml"; then
  log_pass "CronJob PSS Restricted 호환"
else
  log_fail "CronJob PSS 미호환"
fi

echo ""
echo "============================================================"
echo "MTU-N73 vCluster PR Preview 검증 결과"
echo "============================================================"
echo "  통과: ${PASS} / ${TOTAL}"
echo "  실패: ${FAIL} / ${TOTAL}"
echo "  매치율: $(( PASS * 100 / TOTAL ))%"
echo "============================================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
