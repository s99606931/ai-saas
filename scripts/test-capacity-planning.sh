#!/bin/bash
# ============================================================
# MTU-N76: 용량 계획 + ResourceQuota/LimitRange 검증 테스트
# Plan SC: FR-N76.5
# ============================================================

set -euo pipefail

PASS=0
FAIL=0
TOTAL=10

log_pass() { echo "  [PASS] $1"; PASS=$((PASS+1)); }
log_fail() { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }

echo "============================================================"
echo "MTU-N76: 용량 계획 + ResourceQuota/LimitRange 검증"
echo "날짜: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
echo ""

QF=/data/ai-saas/infra/resource-management/quotas/tenant-quotas.yaml
LR=/data/ai-saas/infra/resource-management/limit-ranges/global-limit-range.yaml
CA=/data/ai-saas/infra/monitoring/capacity-alerting-rules.yaml
CD=/data/ai-saas/infra/monitoring/dashboards/capacity-planning.json

# CP-01: ResourceQuota 3개 등급 정의
echo "[CP-01] ResourceQuota 3개 등급 확인"
if [ -f "$QF" ]; then
  RQ_COUNT=$(grep -c 'kind: ResourceQuota' "$QF")
  if [ "$RQ_COUNT" -ge 3 ]; then
    log_pass "ResourceQuota ${RQ_COUNT}개 등급 정의됨"
  else
    log_fail "ResourceQuota 등급 부족 (${RQ_COUNT}/3)"
  fi
else
  log_fail "ResourceQuota 파일 미존재"
fi

# CP-02: Small/Medium/Large 등급 확인
echo "[CP-02] Small/Medium/Large 등급 확인"
TIER_COUNT=0
grep -q 'small' "$QF" 2>/dev/null && TIER_COUNT=$((TIER_COUNT+1))
grep -q 'medium' "$QF" 2>/dev/null && TIER_COUNT=$((TIER_COUNT+1))
grep -q 'large' "$QF" 2>/dev/null && TIER_COUNT=$((TIER_COUNT+1))
if [ "$TIER_COUNT" -eq 3 ]; then
  log_pass "3개 등급 전수 정의됨"
else
  log_fail "등급 부족 (${TIER_COUNT}/3)"
fi

# CP-03: LimitRange 정의 확인
echo "[CP-03] LimitRange 정의 확인"
if [ -f "$LR" ] && grep -q 'LimitRange' "$LR"; then
  log_pass "LimitRange 정의됨"
else
  log_fail "LimitRange 미정의"
fi

# CP-04: Container/Pod/PVC 제한 타입
echo "[CP-04] LimitRange Container/Pod/PVC 제한 확인"
TYPE_COUNT=0
grep -q 'type: Container' "$LR" 2>/dev/null && TYPE_COUNT=$((TYPE_COUNT+1))
grep -q 'type: Pod' "$LR" 2>/dev/null && TYPE_COUNT=$((TYPE_COUNT+1))
grep -q 'type: PersistentVolumeClaim' "$LR" 2>/dev/null && TYPE_COUNT=$((TYPE_COUNT+1))
if [ "$TYPE_COUNT" -ge 3 ]; then
  log_pass "Container/Pod/PVC 3가지 제한 타입 정의"
else
  log_fail "제한 타입 부족 (${TYPE_COUNT}/3)"
fi

# CP-05: 용량 알림 규칙 존재
echo "[CP-05] 용량 알림 규칙 확인"
if [ -f "$CA" ] && grep -q 'QuotaUsageHigh' "$CA"; then
  log_pass "QuotaUsageHigh 알림 규칙 존재"
else
  log_fail "용량 알림 규칙 미존재"
fi

# CP-06: 90% 위험 알림
echo "[CP-06] QuotaUsageCritical (90%) 알림 확인"
if grep -q 'QuotaUsageCritical' "$CA" 2>/dev/null; then
  log_pass "QuotaUsageCritical 알림 정의됨"
else
  log_fail "QuotaUsageCritical 미정의"
fi

# CP-07: 클러스터 용량 부족 알림
echo "[CP-07] ClusterCapacityLow 알림 확인"
if grep -q 'ClusterCPUCapacityLow' "$CA" 2>/dev/null && grep -q 'ClusterMemoryCapacityLow' "$CA"; then
  log_pass "클러스터 CPU+Memory 용량 부족 알림 정의됨"
else
  log_fail "클러스터 용량 부족 알림 미정의"
fi

# CP-08: Grafana 대시보드 존재
echo "[CP-08] 용량 계획 Grafana 대시보드 확인"
if [ -f "$CD" ] && grep -q 'capacity-planning' "$CD"; then
  log_pass "용량 계획 대시보드 존재"
else
  log_fail "대시보드 미존재"
fi

# CP-09: CSAP D-08 매핑 확인
echo "[CP-09] CSAP D-08 매핑 확인"
D08_COUNT=0
grep -q 'D-08' "$QF" 2>/dev/null && D08_COUNT=$((D08_COUNT+1))
grep -q 'D-08' "$LR" 2>/dev/null && D08_COUNT=$((D08_COUNT+1))
grep -q 'D-08' "$CA" 2>/dev/null && D08_COUNT=$((D08_COUNT+1))
if [ "$D08_COUNT" -ge 3 ]; then
  log_pass "CSAP D-08 매핑 ${D08_COUNT}개 파일에 적용"
else
  log_fail "CSAP D-08 매핑 부족 (${D08_COUNT}/3)"
fi

# CP-10: runbook_url 포함 확인
echo "[CP-10] 알림 규칙 runbook_url 포함 확인"
RU_COUNT=$(grep -c 'runbook_url' "$CA" 2>/dev/null || echo 0)
if [ "$RU_COUNT" -ge 3 ]; then
  log_pass "알림 ${RU_COUNT}건에 runbook_url 포함"
else
  log_fail "runbook_url 부족 (${RU_COUNT}건)"
fi

echo ""
echo "============================================================"
echo "MTU-N76 용량 계획 검증 결과"
echo "============================================================"
echo "  통과: ${PASS} / ${TOTAL}"
echo "  실패: ${FAIL} / ${TOTAL}"
echo "  매치율: $(( PASS * 100 / TOTAL ))%"
echo "============================================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
