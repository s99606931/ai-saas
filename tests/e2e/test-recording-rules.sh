#!/bin/bash
# =============================================================================
# Prometheus Recording Rules + AlertManager 라우팅 통합 테스트
# Design Ref: MTU-N57
# Plan SC: FR-N57.8
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
echo " Recording Rules + AlertManager 통합 테스트"
echo " MTU-N57"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="
echo ""

RR_FILE="/data/ai-saas/infra/monitoring/recording-rules.yaml"
AM_FILE="/data/ai-saas/infra/monitoring/alertmanager-config.yaml"

# --- Phase 1: Recording Rules 검증 ---
echo "[Phase 1] Recording Rules 검증"
if [ -f "$RR_FILE" ]; then
  HAS_CRD=$(grep -c "kind: PrometheusRule" "$RR_FILE" || true)
  RED_COUNT=$(grep -c "record: service:" "$RR_FILE" || true)
  NODE_COUNT=$(grep -c "record: node:" "$RR_FILE" || true)
  SLO_COUNT=$(grep -c "record: slo:" "$RR_FILE" || true)
  CLUSTER_COUNT=$(grep -c "record: cluster:" "$RR_FILE" || true)

  [ "$HAS_CRD" -ge 1 ] && log_test "TC-01" "PrometheusRule CRD 형식" "PASS" || log_test "TC-01" "CRD 형식 오류" "FAIL"
  [ "$RED_COUNT" -ge 3 ] && log_test "TC-02" "서비스 RED 메트릭 ${RED_COUNT}개" "PASS" || log_test "TC-02" "RED 메트릭 부족" "FAIL"
  [ "$NODE_COUNT" -ge 3 ] && log_test "TC-03" "노드 리소스 메트릭 ${NODE_COUNT}개" "PASS" || log_test "TC-03" "노드 메트릭 부족" "FAIL"
  [ "$SLO_COUNT" -ge 2 ] && log_test "TC-04" "SLO 집계 메트릭 ${SLO_COUNT}개" "PASS" || log_test "TC-04" "SLO 메트릭 부족" "FAIL"
  [ "$CLUSTER_COUNT" -ge 1 ] && log_test "TC-05" "클러스터 상태 메트릭 ${CLUSTER_COUNT}개" "PASS" || log_test "TC-05" "클러스터 메트릭 부족" "FAIL"
else
  for i in $(seq 1 5); do log_test "TC-0$i" "recording-rules.yaml 미존재" "FAIL"; done
fi

# --- Phase 2: AlertManager 라우팅 검증 ---
echo ""
echo "[Phase 2] AlertManager 라우팅 검증"
if [ -f "$AM_FILE" ]; then
  HAS_ROUTE=$(grep -c "route:" "$AM_FILE" || true)
  HAS_RECEIVERS=$(grep -c "receiver" "$AM_FILE" || true)
  HAS_INHIBIT=$(grep -c "inhibit" "$AM_FILE" || true)

  [ "$HAS_ROUTE" -ge 1 ] && log_test "TC-06" "라우팅 트리 정의" "PASS" || log_test "TC-06" "라우팅 미정의" "FAIL"
  [ "$HAS_RECEIVERS" -ge 3 ] && log_test "TC-07" "수신 채널 ${HAS_RECEIVERS}개" "PASS" || log_test "TC-07" "채널 부족" "FAIL"
  [ "$HAS_INHIBIT" -ge 1 ] && log_test "TC-08" "억제 규칙 정의" "PASS" || log_test "TC-08" "억제 규칙 미정의" "FAIL"

  # CSAP D-06 연동 검증
  HAS_CSAP=$(grep -c "csap\|CSAP\|D-06\|D-08" "$AM_FILE" || true)
  [ "$HAS_CSAP" -ge 1 ] && log_test "TC-09" "CSAP D-06/D-08 참조" "PASS" || log_test "TC-09" "CSAP 참조 없음" "FAIL"
else
  for i in $(seq 6 9); do log_test "TC-0$i" "alertmanager-config.yaml 미존재" "FAIL"; done
fi

# --- Phase 3: 품질 검증 ---
echo ""
echo "[Phase 3] 품질 검증"
TOTAL_RULES=$(grep "record:" "$RR_FILE" 2>/dev/null | wc -l)
[ "$TOTAL_RULES" -ge 10 ] && log_test "TC-10" "Recording Rules 총 ${TOTAL_RULES}개 (목표: 15+)" "PASS" || log_test "TC-10" "Recording Rules 부족 (${TOTAL_RULES}개)" "FAIL"

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
  echo -e "\n${GREEN}[ALL PASS] Recording Rules + AlertManager 통합 테스트 완료${NC}"
  exit 0
else
  echo -e "\n${RED}[PARTIAL] ${FAIL}건 실패${NC}"
  exit 1
fi
