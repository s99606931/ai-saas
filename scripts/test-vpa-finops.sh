#!/bin/bash
# ============================================================
# MTU-N72: VPA Right-Sizing + OpenCost FinOps 검증 테스트
# Design Ref: MTU-N72 §4
# Plan SC: FR-N72.6
# ============================================================

set -euo pipefail

PASS=0
FAIL=0
TOTAL=12

log_pass() { echo "  [PASS] $1"; PASS=$((PASS+1)); }
log_fail() { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }

echo "============================================================"
echo "MTU-N72: VPA Right-Sizing + OpenCost FinOps 검증"
echo "날짜: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
echo ""

# VPA-01: VPA values.yaml 존재 및 설정
echo "[VPA-01] VPA values.yaml 설정 확인"
VPA_VALUES=/data/ai-saas/infra/vpa/values.yaml
if [ -f "$VPA_VALUES" ] && grep -q 'recommender:' "$VPA_VALUES" && grep -q 'enabled: true' "$VPA_VALUES"; then
  log_pass "VPA Recommender 활성화 설정 확인"
else
  log_fail "VPA values.yaml 미존재 또는 Recommender 미활성화"
fi

# VPA-02: VPA Updater 비활성화 확인 (안전)
echo "[VPA-02] VPA Updater 비활성화 (안전 모드) 확인"
if grep -q 'enabled: false' "$VPA_VALUES" 2>/dev/null; then
  log_pass "VPA Updater 비활성화 확인"
else
  log_fail "VPA Updater가 활성화되어 있음 (위험)"
fi

# VPA-03: VPA 오브젝트 Off 모드 확인
echo "[VPA-03] VPA 오브젝트 updateMode Off 확인"
VPA_OBJS=/data/ai-saas/infra/vpa/vpa-objects.yaml
if [ -f "$VPA_OBJS" ]; then
  OFF_COUNT=$(grep -c 'updateMode: "Off"' "$VPA_OBJS" || echo 0)
  if [ "$OFF_COUNT" -ge 3 ]; then
    log_pass "VPA 오브젝트 ${OFF_COUNT}개 Off 모드 설정"
  else
    log_fail "VPA Off 모드 부족 (${OFF_COUNT}개)"
  fi
else
  log_fail "VPA 오브젝트 파일 미존재"
fi

# VPA-04: VPA 서비스 커버리지
echo "[VPA-04] VPA 서비스 커버리지 확인"
SVC_COUNT=$(grep -c 'kind: VerticalPodAutoscaler' "$VPA_OBJS" 2>/dev/null || echo 0)
if [ "$SVC_COUNT" -ge 5 ]; then
  log_pass "VPA 서비스 ${SVC_COUNT}개 설정됨"
else
  log_fail "VPA 서비스 부족 (${SVC_COUNT}개, 최소 5개)"
fi

# VPA-05: OpenCost values.yaml 확인
echo "[VPA-05] OpenCost 설정 확인"
OC_VALUES=/data/ai-saas/infra/finops/opencost/values.yaml
if [ -f "$OC_VALUES" ] && grep -q 'PROMETHEUS_SERVER_ENDPOINT' "$OC_VALUES"; then
  log_pass "OpenCost Prometheus 연동 설정 확인"
else
  log_fail "OpenCost 설정 미존재 또는 Prometheus 연동 미설정"
fi

# VPA-06: OpenCost 비용 모델 설정
echo "[VPA-06] OpenCost 커스텀 비용 모델 확인"
if grep -q 'customPricing' "$OC_VALUES" 2>/dev/null; then
  log_pass "OpenCost 커스텀 비용 모델 설정됨"
else
  log_fail "OpenCost 비용 모델 미설정"
fi

# VPA-07: OpenCost PSS 호환 securityContext
echo "[VPA-07] OpenCost PSS Restricted 호환 확인"
if grep -q 'runAsNonRoot: true' "$OC_VALUES" && grep -q 'allowPrivilegeEscalation: false' "$OC_VALUES"; then
  log_pass "OpenCost PSS Restricted 호환 securityContext 설정"
else
  log_fail "OpenCost securityContext 미설정"
fi

# VPA-08: Grafana 대시보드 존재
echo "[VPA-08] VPA Right-Sizing Grafana 대시보드 확인"
DASH=/data/ai-saas/infra/monitoring/dashboards/vpa-rightsizing.json
if [ -f "$DASH" ] && grep -q 'vpa_recommender_recommendation' "$DASH"; then
  log_pass "VPA Right-Sizing Grafana 대시보드 존재"
else
  log_fail "VPA 대시보드 미존재"
fi

# VPA-09: 대시보드 OpenCost 패널 확인
echo "[VPA-09] 대시보드 OpenCost 비용 패널 확인"
if grep -q 'opencost' "$DASH" 2>/dev/null; then
  log_pass "OpenCost 비용 패널 포함"
else
  log_fail "OpenCost 패널 미포함"
fi

# VPA-10: 알림 규칙 존재
echo "[VPA-10] VPA FinOps 알림 규칙 확인"
ALERT=/data/ai-saas/infra/monitoring/vpa-alerting-rules.yaml
if [ -f "$ALERT" ] && grep -q 'VPACPUOverProvisioned' "$ALERT"; then
  log_pass "VPA 과다 할당 알림 규칙 정의됨"
else
  log_fail "VPA 알림 규칙 미정의"
fi

# VPA-11: 과소 할당 알림 규칙
echo "[VPA-11] VPA 과소 할당 위험 알림 확인"
if grep -q 'VPACPUUnderProvisioned' "$ALERT" 2>/dev/null; then
  log_pass "VPA 과소 할당 위험 알림 정의됨"
else
  log_fail "VPA 과소 할당 알림 미정의"
fi

# VPA-12: VPA Recommender Prometheus 연동
echo "[VPA-12] VPA Recommender Prometheus 연동 확인"
if grep -q 'prometheus-address' "$VPA_VALUES" 2>/dev/null && grep -q 'storage: prometheus' "$VPA_VALUES"; then
  log_pass "VPA Recommender Prometheus 연동 설정"
else
  log_fail "VPA Recommender Prometheus 연동 미설정"
fi

echo ""
echo "============================================================"
echo "MTU-N72 VPA + FinOps 검증 결과"
echo "============================================================"
echo "  통과: ${PASS} / ${TOTAL}"
echo "  실패: ${FAIL} / ${TOTAL}"
echo "  매치율: $(( PASS * 100 / TOTAL ))%"
echo "============================================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
