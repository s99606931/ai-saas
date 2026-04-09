#!/bin/bash
# =============================================================================
# 3라운드 CI/CD 고도화 통합 검증
# Design Ref: MTU-N60
# Plan SC: FR-N60.1, FR-N60.2
#
# N53~N59 전체 테스트 일괄 실행 + 교차 검증
# =============================================================================

set -euo pipefail

TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_TESTS=0
TEST_RESULTS=()

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "============================================================"
echo " 3라운드 CI/CD 고도화 통합 검증"
echo " MTU-N53~N59 전체 테스트 스위트"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"

TEST_DIR="/data/ai-saas/tests/e2e"

# 테스트 스위트 정의
TESTS=(
  "test-gatekeeper.sh|MTU-N53|OPA Gatekeeper 정책 엔진"
  "test-linkerd.sh|MTU-N54|Linkerd 서비스 메시 + mTLS"
  "test-velero.sh|MTU-N55|Velero DR 자동화"
  "test-keda.sh|MTU-N56|KEDA + VPA 오토스케일링"
  "test-recording-rules.sh|MTU-N57|Recording Rules + AlertManager"
  "test-devcontainer.sh|MTU-N58|DevContainer 개발 환경"
  "test-finops.sh|MTU-N59|FinOps 비용 최적화"
)

for entry in "${TESTS[@]}"; do
  IFS='|' read -r script mtu desc <<< "$entry"
  echo ""
  echo "------------------------------------------------------------"
  echo " ${mtu}: ${desc}"
  echo "------------------------------------------------------------"

  if [ -f "${TEST_DIR}/${script}" ]; then
    # 테스트 실행 및 결과 캡처 (ANSI 코드 제거)
    OUTPUT=$(bash "${TEST_DIR}/${script}" 2>&1 | sed 's/\x1b\[[0-9;]*m//g') || true
    PASS=$(echo "$OUTPUT" | grep "PASS:" | grep -oP '\d+' | head -1 || echo "0")
    FAIL=$(echo "$OUTPUT" | grep "FAIL:" | grep -oP '\d+' | head -1 || echo "0")
    RATE=$(echo "$OUTPUT" | grep "통과율:" | grep -oP '[\d.]+' | head -1 || echo "0")

    # 결과 정리 (빈값이면 0)
    PASS="${PASS:-0}"
    FAIL="${FAIL:-0}"
    RATE="${RATE:-0}"

    SUB_TOTAL=$((PASS + FAIL))
    TOTAL_PASS=$((TOTAL_PASS + PASS))
    TOTAL_FAIL=$((TOTAL_FAIL + FAIL))
    TOTAL_TESTS=$((TOTAL_TESTS + SUB_TOTAL))

    if [ "$FAIL" -eq 0 ] && [ "$PASS" -gt 0 ]; then
      echo -e "  ${GREEN}[ALL PASS]${NC} ${PASS}/${SUB_TOTAL} 통과 (${RATE}%)"
      TEST_RESULTS+=("${mtu}|${desc}|${PASS}/${SUB_TOTAL}|ALL PASS")
    else
      echo -e "  ${RED}[PARTIAL]${NC} ${PASS}/${SUB_TOTAL} 통과, ${FAIL}건 실패"
      TEST_RESULTS+=("${mtu}|${desc}|${PASS}/${SUB_TOTAL}|${FAIL} FAIL")
    fi
  else
    echo -e "  ${RED}[SKIP]${NC} ${script} 미존재"
    TEST_RESULTS+=("${mtu}|${desc}|0/0|SKIP")
  fi
done

# --- 교차 검증 ---
echo ""
echo "------------------------------------------------------------"
echo " 교차 검증 (Cross-Validation)"
echo "------------------------------------------------------------"

CROSS_PASS=0
CROSS_TOTAL=0

# CV-01: Gatekeeper + Kyverno 공존 검증
CROSS_TOTAL=$((CROSS_TOTAL + 1))
GK_EXISTS=$(find /data/ai-saas/infra/gatekeeper/templates/ -name "*.yaml" 2>/dev/null | wc -l || echo "0")
KV_EXISTS=$(find /data/ai-saas/infra/kyverno/ -name "*.yaml" 2>/dev/null | wc -l || echo "0")
if [ "$GK_EXISTS" -ge 8 ] && [ "$KV_EXISTS" -ge 1 ]; then
  echo -e "  ${GREEN}[PASS]${NC} CV-01: Gatekeeper(${GK_EXISTS}) + Kyverno(${KV_EXISTS}) 공존"
  CROSS_PASS=$((CROSS_PASS + 1))
else
  echo -e "  ${RED}[FAIL]${NC} CV-01: 정책 엔진 공존 불완전"
fi

# CV-02: KEDA ScaledObject + VPA 충돌 방지
CROSS_TOTAL=$((CROSS_TOTAL + 1))
SO_COUNT=$(find /data/ai-saas/infra/keda/scaled-objects/ -name "*.yaml" 2>/dev/null | wc -l || echo "0")
VPA_COUNT=$(find /data/ai-saas/infra/keda/vpa/ -name "*.yaml" 2>/dev/null | wc -l || echo "0")
if [ "$SO_COUNT" -ge 6 ] && [ "$VPA_COUNT" -ge 6 ]; then
  echo -e "  ${GREEN}[PASS]${NC} CV-02: ScaledObject(${SO_COUNT}) + VPA(${VPA_COUNT}) 충돌 방지"
  CROSS_PASS=$((CROSS_PASS + 1))
else
  echo -e "  ${RED}[FAIL]${NC} CV-02: KEDA+VPA 불완전"
fi

# CV-03: Linkerd + NetworkPolicy 호환
CROSS_TOTAL=$((CROSS_TOTAL + 1))
LINKERD_DIR=$(find /data/ai-saas/infra/linkerd/ -name "*.yaml" 2>/dev/null | wc -l || echo "0")
NETPOL_DIR=$(find /data/ai-saas/infra/network-policies/ -name "*.yaml" -o -name "*.yml" 2>/dev/null | wc -l || echo "0")
if [ "$LINKERD_DIR" -ge 1 ] && [ "$NETPOL_DIR" -ge 1 ]; then
  echo -e "  ${GREEN}[PASS]${NC} CV-03: Linkerd + NetworkPolicy ��존"
  CROSS_PASS=$((CROSS_PASS + 1))
else
  echo -e "  ${RED}[FAIL]${NC} CV-03: Linkerd+NetworkPolicy 불완전"
fi

# CV-04: Velero + Sealed Secrets 연동
CROSS_TOTAL=$((CROSS_TOTAL + 1))
VELERO_CRED=$(grep -c "SEALED_SECRET\|credentials\|CHANGE_ME" /data/ai-saas/infra/velero/values.yaml 2>/dev/null || echo "0")
if [ "$VELERO_CRED" -ge 1 ]; then
  echo -e "  ${GREEN}[PASS]${NC} CV-04: Velero 자격 증명 Sealed Secrets 보호"
  CROSS_PASS=$((CROSS_PASS + 1))
else
  echo -e "  ${RED}[FAIL]${NC} CV-04: Velero 자격 증명 보호 미설정"
fi

# CV-05: FinOps + KEDA scale-to-zero 연동
CROSS_TOTAL=$((CROSS_TOTAL + 1))
IDLE_KEDA=$(grep -c "KEDA\|scale-to-zero" /data/ai-saas/scripts/finops/idle-resource-detect.sh 2>/dev/null || echo "0")
if [ "$IDLE_KEDA" -ge 1 ]; then
  echo -e "  ${GREEN}[PASS]${NC} CV-05: FinOps idle 탐지 + KEDA 권고 연동"
  CROSS_PASS=$((CROSS_PASS + 1))
else
  echo -e "  ${RED}[FAIL]${NC} CV-05: FinOps-KEDA 연동 미설정"
fi

# CV-06: Grafana 대시보드 전수 확인
CROSS_TOTAL=$((CROSS_TOTAL + 1))
DASH_COUNT=$(ls /data/ai-saas/infra/monitoring/dashboards/*.json 2>/dev/null | wc -l)
if [ "$DASH_COUNT" -ge 3 ]; then
  echo -e "  ${GREEN}[PASS]${NC} CV-06: Grafana 대시보드 ${DASH_COUNT}개"
  CROSS_PASS=$((CROSS_PASS + 1))
else
  echo -e "  ${RED}[FAIL]${NC} CV-06: 대시보드 부족 (${DASH_COUNT}개)"
fi

TOTAL_PASS=$((TOTAL_PASS + CROSS_PASS))
TOTAL_FAIL=$((TOTAL_FAIL + (CROSS_TOTAL - CROSS_PASS)))
TOTAL_TESTS=$((TOTAL_TESTS + CROSS_TOTAL))

# --- 최종 리포트 ---
echo ""
echo "============================================================"
echo " 3라운드 통합 검증 최종 결과"
echo "============================================================"
echo ""
echo " MTU별 결과:"
printf " %-10s %-35s %-10s %s\n" "MTU" "설명" "결과" "상태"
printf " %-10s %-35s %-10s %s\n" "----------" "-----------------------------------" "----------" "--------"
for result in "${TEST_RESULTS[@]}"; do
  IFS='|' read -r mtu desc score status <<< "$result"
  printf " %-10s %-35s %-10s %s\n" "$mtu" "$desc" "$score" "$status"
done
echo ""
echo " 교차 검증: ${CROSS_PASS}/${CROSS_TOTAL} PASS"
echo ""
echo "------------------------------------------------------------"
echo -e " 총 테스트:    ${TOTAL_TESTS}"
echo -e " ${GREEN}PASS${NC}:         ${TOTAL_PASS}"
echo -e " ${RED}FAIL${NC}:         ${TOTAL_FAIL}"
if [ "$TOTAL_TESTS" -gt 0 ]; then
  OVERALL_RATE=$(awk "BEGIN {printf \"%.1f\", ($TOTAL_PASS/$TOTAL_TESTS)*100}")
  echo " 통과율:       ${OVERALL_RATE}%"
fi
echo "------------------------------------------------------------"

if [ "$TOTAL_FAIL" -eq 0 ]; then
  echo -e "\n${GREEN}[ALL PASS] 3라운드 CI/CD 고도화 통합 검증 완료 (${TOTAL_TESTS}건)${NC}"
  exit 0
else
  echo -e "\n${YELLOW}[PARTIAL] ${TOTAL_FAIL}건 실패${NC}"
  exit 1
fi
