#!/bin/bash
# =============================================================================
# KEDA + VPA 오토스케일링 통합 테스트
# Design Ref: MTU-N56
# Plan SC: FR-N56.9
# =============================================================================

set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'

log_test() {
  local tc_id="$1"; local desc="$2"; local result="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$result" = "PASS" ]; then
    PASS=$((PASS + 1)); echo -e "  ${GREEN}[PASS]${NC} $tc_id: $desc"
  else
    FAIL=$((FAIL + 1)); echo -e "  ${RED}[FAIL]${NC} $tc_id: $desc"
  fi
}

echo "=============================================="
echo " KEDA + VPA 오토스케일링 통합 테스트"
echo " MTU-N56: 이벤트 기반 오토스케일링"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="
echo ""

KEDA_DIR="/data/ai-saas/infra/keda"

# --- Phase 1: KEDA 설치 설정 ---
echo "[Phase 1] KEDA 설치 설정 검증"
if [ -f "${KEDA_DIR}/values.yaml" ]; then
  HAS_RESOURCES=$(grep -c "resources:" "${KEDA_DIR}/values.yaml" || true)
  HAS_PROMETHEUS=$(grep -c "prometheus:" "${KEDA_DIR}/values.yaml" || true)
  HAS_LOGGING=$(grep -c "logging:" "${KEDA_DIR}/values.yaml" || true)
  if [ "$HAS_RESOURCES" -ge 1 ] && [ "$HAS_PROMETHEUS" -ge 1 ] && [ "$HAS_LOGGING" -ge 1 ]; then
    log_test "TC-01" "KEDA Helm values (리소스, Prometheus, 로깅)" "PASS"
  else
    log_test "TC-01" "KEDA values 항목 누락" "FAIL"
  fi
else
  log_test "TC-01" "values.yaml 미존재" "FAIL"
fi

# --- Phase 2: ScaledObject 검증 (6개) ---
echo ""
echo "[Phase 2] ScaledObject 검증 (6개 서비스)"
SCALED_OBJECTS=(
  "auth-service|TC-02|auth-service ScaledObject (RPS + CPU)"
  "api-gateway|TC-03|api-gateway ScaledObject (RPS + CPU)"
  "tenant-service|TC-04|tenant-service ScaledObject (CPU + Memory)"
  "audit-service|TC-05|audit-service ScaledObject (큐 깊이 + CPU)"
  "ai-gateway|TC-06|ai-gateway ScaledObject (scale-to-zero)"
  "catalog-service|TC-07|catalog-service ScaledObject (CPU + RPS)"
)

for entry in "${SCALED_OBJECTS[@]}"; do
  IFS='|' read -r svc tc_id desc <<< "$entry"
  SO_FILE="${KEDA_DIR}/scaled-objects/${svc}.yaml"
  if [ -f "$SO_FILE" ]; then
    HAS_KIND=$(grep -c "kind: ScaledObject" "$SO_FILE" || true)
    HAS_TRIGGERS=$(grep -c "triggers:" "$SO_FILE" || true)
    HAS_MIN=$(grep -c "minReplicaCount:" "$SO_FILE" || true)
    HAS_MAX=$(grep -c "maxReplicaCount:" "$SO_FILE" || true)
    if [ "$HAS_KIND" -ge 1 ] && [ "$HAS_TRIGGERS" -ge 1 ] && [ "$HAS_MIN" -ge 1 ] && [ "$HAS_MAX" -ge 1 ]; then
      log_test "$tc_id" "$desc" "PASS"
    else
      log_test "$tc_id" "$desc (형식 불완전)" "FAIL"
    fi
  else
    log_test "$tc_id" "$desc (파일 미존재)" "FAIL"
  fi
done

# --- TC-08: scale-to-zero 설정 ---
echo ""
echo "[Phase 3] 고급 스케일링 기능"
AI_GW="${KEDA_DIR}/scaled-objects/ai-gateway.yaml"
if grep -q "minReplicaCount: 0" "$AI_GW" && grep -q "idleReplicaCount: 0" "$AI_GW"; then
  log_test "TC-08" "AI Gateway scale-to-zero (minReplica=0, idle=0)" "PASS"
else
  log_test "TC-08" "scale-to-zero 설정 누락" "FAIL"
fi

# --- TC-09: Prometheus 트리거 ---
PROM_TRIGGER_COUNT=$(grep -rl "type: prometheus" "${KEDA_DIR}/scaled-objects/" | wc -l)
if [ "$PROM_TRIGGER_COUNT" -ge 4 ]; then
  log_test "TC-09" "Prometheus 커스텀 메트릭 트리거 ${PROM_TRIGGER_COUNT}개 서비스" "PASS"
else
  log_test "TC-09" "Prometheus 트리거 부족 (${PROM_TRIGGER_COUNT}개)" "FAIL"
fi

# --- Phase 4: VPA 검증 (6개) ---
echo ""
echo "[Phase 4] VPA 리소스 추천 검증 (6개)"
VPA_FILES=(
  "auth-service-vpa|TC-10|auth-service VPA (Off 모드)"
  "api-gateway-vpa|TC-11|api-gateway VPA (Off 모드)"
  "tenant-service-vpa|TC-12|tenant-service VPA (Initial 모드)"
  "audit-service-vpa|TC-13|audit-service VPA (Off 모드)"
  "ai-gateway-vpa|TC-14|ai-gateway VPA (Off 모드)"
  "catalog-service-vpa|TC-15|catalog-service VPA (Initial 모드)"
)

for entry in "${VPA_FILES[@]}"; do
  IFS='|' read -r filename tc_id desc <<< "$entry"
  VPA_FILE="${KEDA_DIR}/vpa/${filename}.yaml"
  if [ -f "$VPA_FILE" ]; then
    HAS_VPA=$(grep -c "kind: VerticalPodAutoscaler" "$VPA_FILE" || true)
    HAS_MODE=$(grep -c "updateMode:" "$VPA_FILE" || true)
    HAS_POLICY=$(grep -c "containerPolicies:" "$VPA_FILE" || true)
    if [ "$HAS_VPA" -ge 1 ] && [ "$HAS_MODE" -ge 1 ] && [ "$HAS_POLICY" -ge 1 ]; then
      log_test "$tc_id" "$desc" "PASS"
    else
      log_test "$tc_id" "$desc (형식 불완전)" "FAIL"
    fi
  else
    log_test "$tc_id" "$desc (파일 미존재)" "FAIL"
  fi
done

# --- TC-16: HPA+VPA 충돌 방지 ---
echo ""
echo "[Phase 5] 충돌 방지 전략"
OFF_COUNT=0; INITIAL_COUNT=0; AUTO_COUNT=0
for f in "${KEDA_DIR}/vpa/"*.yaml; do
  [ -f "$f" ] || continue
  if grep -q 'updateMode: "Off"' "$f"; then OFF_COUNT=$((OFF_COUNT+1)); fi
  if grep -q 'updateMode: "Initial"' "$f"; then INITIAL_COUNT=$((INITIAL_COUNT+1)); fi
  if grep -q 'updateMode: "Auto"' "$f"; then AUTO_COUNT=$((AUTO_COUNT+1)); fi
done
if [ "$AUTO_COUNT" -eq 0 ] && [ "$OFF_COUNT" -ge 3 ]; then
  log_test "TC-16" "HPA+VPA 충돌 방지 (Auto 0개, Off ${OFF_COUNT}개, Initial ${INITIAL_COUNT}개)" "PASS"
else
  log_test "TC-16" "HPA+VPA 충돌 위험 (Auto ${AUTO_COUNT}개)" "FAIL"
fi

# --- TC-17: Fallback 설정 ---
FALLBACK_COUNT=$(grep -rl "fallback:" "${KEDA_DIR}/scaled-objects/" | wc -l)
if [ "$FALLBACK_COUNT" -ge 2 ]; then
  log_test "TC-17" "ScaledObject fallback 설정 ${FALLBACK_COUNT}개 서비스" "PASS"
else
  log_test "TC-17" "Fallback 설정 부족" "FAIL"
fi

# --- 최종 리포트 ---
echo ""
echo "=============================================="
echo " 테스트 결과 요약"
echo "=============================================="
echo -e " 총 테스트: ${TOTAL}"
echo -e " ${GREEN}PASS${NC}: ${PASS}"
echo -e " ${RED}FAIL${NC}: ${FAIL}"
RATE=$(awk "BEGIN {printf \"%.1f\", ($PASS/$TOTAL)*100}")
echo " 통과율: ${RATE}%"

if [ "$FAIL" -eq 0 ]; then
  echo -e "\n${GREEN}[ALL PASS] KEDA + VPA 오토스케일링 통합 테스트 완료${NC}"
  exit 0
else
  echo -e "\n${RED}[PARTIAL] ${FAIL}건 실패${NC}"
  exit 1
fi
