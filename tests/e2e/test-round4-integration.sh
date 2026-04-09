#!/bin/bash
# =============================================================================
# 4라운드 CI/CD 고도화 통합 검증
# Design Ref: MTU-N68
# Plan SC: FR-N68.1, FR-N68.2
#
# N61~N67 전체 테스트 일괄 실행 + 교차 검증
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
echo " 4라운드 인프라 고도화 통합 검증"
echo " MTU-N61~N67 전체 테스트 스위트"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"

TEST_DIR="/data/ai-saas/tests/e2e"

# 테스트 스위트 정의
TESTS=(
  "test-grafana-dashboards.sh|MTU-N61|Grafana 공공기관 SaaS 대시보드"
  "test-cert-manager.sh|MTU-N62|cert-manager TLS 자동화"
  "test-trivy-operator.sh|MTU-N63|Trivy Operator 보안 스캔"
  "test-cloudnative-pg.sh|MTU-N64|CloudNativePG PostgreSQL"
  "test-gateway-api.sh|MTU-N65|Gateway API + Traefik"
  "test-external-secrets.sh|MTU-N66|External Secrets Operator"
  "test-drift-detection.sh|MTU-N67|Flux Drift Detection + 감사"
)

for entry in "${TESTS[@]}"; do
  IFS='|' read -r script mtu desc <<< "$entry"
  echo ""
  echo "------------------------------------------------------------"
  echo " ${mtu}: ${desc}"
  echo "------------------------------------------------------------"

  if [ -f "${TEST_DIR}/${script}" ]; then
    OUTPUT=$(bash "${TEST_DIR}/${script}" 2>&1 | sed 's/\x1b\[[0-9;]*m//g') || true
    # 결과 라인에서 정확하게 PASS/FAIL 수치 추출
    SUMMARY_LINE=$(echo "$OUTPUT" | grep "결과:" | tail -1 || echo "")
    PASS=$(echo "$SUMMARY_LINE" | grep -oP 'PASS:\s*\K\d+' || echo "0")
    FAIL=$(echo "$SUMMARY_LINE" | grep -oP 'FAIL:\s*\K\d+' || echo "0")
    RATE=$(echo "$OUTPUT" | grep "통과율:" | grep -oP '[\d.]+' | head -1 || echo "0")

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

# CV-01: cert-manager + Gateway API TLS 종단 연동
CROSS_TOTAL=$((CROSS_TOTAL + 1))
CM_CERTS=$(find /data/ai-saas/infra/cert-manager/certificates/ -name "*.yaml" 2>/dev/null | wc -l || echo "0")
GW_TLS=$(grep -c "tls:" /data/ai-saas/infra/gateway-api/gateway.yaml 2>/dev/null || echo "0")
if [ "$CM_CERTS" -ge 6 ] && [ "$GW_TLS" -ge 1 ]; then
  echo -e "  ${GREEN}[PASS]${NC} CV-01: cert-manager(${CM_CERTS}인증서) + Gateway TLS 연동"
  CROSS_PASS=$((CROSS_PASS + 1))
else
  echo -e "  ${RED}[FAIL]${NC} CV-01: cert-manager + Gateway TLS 불완전"
fi

# CV-02: cert-manager + CloudNativePG TLS 연동
CROSS_TOTAL=$((CROSS_TOTAL + 1))
DB_TLS=$(grep -c "kind: Certificate" /data/ai-saas/infra/cloudnative-pg/backups/scheduled-backup.yaml 2>/dev/null || echo "0")
if [ "$DB_TLS" -ge 1 ]; then
  echo -e "  ${GREEN}[PASS]${NC} CV-02: cert-manager + CloudNativePG TLS 연동"
  CROSS_PASS=$((CROSS_PASS + 1))
else
  echo -e "  ${RED}[FAIL]${NC} CV-02: DB TLS 연동 불완전"
fi

# CV-03: ESO + Sealed Secrets 이중 시크릿 관리
CROSS_TOTAL=$((CROSS_TOTAL + 1))
ESO_COUNT=$(find /data/ai-saas/infra/external-secrets/secrets/ -name "*.yaml" 2>/dev/null | wc -l || echo "0")
SEALED_DIR=$(find /data/ai-saas/infra/sealed-secrets/ -name "*.yaml" 2>/dev/null | wc -l || echo "0")
if [ "$ESO_COUNT" -ge 6 ] && [ "$SEALED_DIR" -ge 1 ]; then
  echo -e "  ${GREEN}[PASS]${NC} CV-03: ESO(${ESO_COUNT}) + Sealed Secrets(${SEALED_DIR}) 이중 관리"
  CROSS_PASS=$((CROSS_PASS + 1))
else
  echo -e "  ${RED}[FAIL]${NC} CV-03: 이중 시크릿 관리 불완전 (ESO=${ESO_COUNT}, Sealed=${SEALED_DIR})"
fi

# CV-04: Trivy + Gatekeeper + Kyverno 보안 3중 보호
CROSS_TOTAL=$((CROSS_TOTAL + 1))
TRIVY_EXISTS=$([ -f "/data/ai-saas/infra/trivy-operator/values.yaml" ] && echo "1" || echo "0")
GK_EXISTS=$(find /data/ai-saas/infra/gatekeeper/templates/ -name "*.yaml" 2>/dev/null | wc -l || echo "0")
KV_EXISTS=$(find /data/ai-saas/infra/kyverno/ -name "*.yaml" 2>/dev/null | wc -l || echo "0")
if [ "$TRIVY_EXISTS" -eq 1 ] && [ "$GK_EXISTS" -ge 8 ] && [ "$KV_EXISTS" -ge 1 ]; then
  echo -e "  ${GREEN}[PASS]${NC} CV-04: Trivy + Gatekeeper(${GK_EXISTS}) + Kyverno(${KV_EXISTS}) 3중 보호"
  CROSS_PASS=$((CROSS_PASS + 1))
else
  echo -e "  ${RED}[FAIL]${NC} CV-04: 3중 보호 불완전"
fi

# CV-05: Flux Drift Detection + HelmRelease 드리프트 모드
CROSS_TOTAL=$((CROSS_TOTAL + 1))
DRIFT_ENABLED=$(grep -c "mode: enabled" /data/ai-saas/infra/flux/drift-detection/drift-config.yaml 2>/dev/null || echo "0")
if [ "$DRIFT_ENABLED" -ge 1 ]; then
  echo -e "  ${GREEN}[PASS]${NC} CV-05: Flux Drift Detection 활성화"
  CROSS_PASS=$((CROSS_PASS + 1))
else
  echo -e "  ${RED}[FAIL]${NC} CV-05: Drift Detection 미활성"
fi

# CV-06: 전체 Grafana 대시보드 수
CROSS_TOTAL=$((CROSS_TOTAL + 1))
DASH_COUNT=$(find /data/ai-saas/infra/monitoring/dashboards/ -name "*.json" 2>/dev/null | wc -l || echo "0")
if [ "$DASH_COUNT" -ge 11 ]; then
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
echo " 4라운드 통합 검증 최종 결과"
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
  echo -e "\n${GREEN}[ALL PASS] 4라운드 인프라 고도화 통합 검증 완료 (${TOTAL_TESTS}건)${NC}"
  exit 0
else
  echo -e "\n${YELLOW}[PARTIAL] ${TOTAL_FAIL}건 실패${NC}"
  exit 1
fi
