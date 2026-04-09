#!/bin/bash
# =============================================================================
# OPA Gatekeeper 정책 통합 테스트
# Design Ref: MTU-N53 Section 3.6
# Plan SC: FR-N53.12
# =============================================================================

set -euo pipefail

PASS=0
FAIL=0
TOTAL=0
RESULTS=()

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_test() {
  local tc_id="$1"
  local desc="$2"
  local result="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$result" = "PASS" ]; then
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}[PASS]${NC} $tc_id: $desc"
  else
    FAIL=$((FAIL + 1))
    echo -e "  ${RED}[FAIL]${NC} $tc_id: $desc"
  fi
  RESULTS+=("$tc_id|$desc|$result")
}

echo "=============================================="
echo " OPA Gatekeeper 정책 통합 테스트"
echo " MTU-N53: OPA Gatekeeper 정책 엔진 통합"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="
echo ""

INFRA_DIR="/data/ai-saas/infra/gatekeeper"
FIXTURE_DIR="${INFRA_DIR}/test-fixtures"

# --- TC-01: Gatekeeper Helm Values 검증 ---
echo "[Phase 1] Gatekeeper 설치 설정 검증"
if [ -f "${INFRA_DIR}/values.yaml" ]; then
  # values.yaml 필수 항목 검증
  HAS_REPLICAS=$(grep -c "replicas:" "${INFRA_DIR}/values.yaml" || true)
  HAS_AUDIT=$(grep -c "auditInterval:" "${INFRA_DIR}/values.yaml" || true)
  HAS_EMIT=$(grep -c "emitAuditEvents:" "${INFRA_DIR}/values.yaml" || true)
  HAS_PROMETHEUS=$(grep -c "prometheus.io/scrape" "${INFRA_DIR}/values.yaml" || true)
  HAS_EXEMPT=$(grep -c "exemptNamespaces:" "${INFRA_DIR}/values.yaml" || true)
  if [ "$HAS_REPLICAS" -ge 1 ] && [ "$HAS_AUDIT" -ge 1 ] && [ "$HAS_EMIT" -ge 1 ] && \
     [ "$HAS_PROMETHEUS" -ge 1 ] && [ "$HAS_EXEMPT" -ge 1 ]; then
    log_test "TC-01" "Gatekeeper Helm values 필수 항목 완비" "PASS"
  else
    log_test "TC-01" "Gatekeeper Helm values 필수 항목 누락" "FAIL"
  fi
else
  log_test "TC-01" "Gatekeeper values.yaml 미존재" "FAIL"
fi

# --- TC-02~TC-09: ConstraintTemplate 검증 ---
echo ""
echo "[Phase 2] ConstraintTemplate 검증 (8개)"

TEMPLATES=(
  "k8s-block-privileged|k8sblockprivilegedcontainers|TC-02|특권 컨테이너 차단 정책"
  "k8s-require-resource-limits|k8srequireresourcelimits|TC-03|리소스 제한 강제 정책"
  "k8s-allowed-registries|k8sallowedregistries|TC-04|허용 레지스트리 제한 정책"
  "k8s-block-hostpath|k8sblockhostpath|TC-05|hostPath 마운트 차단 정책"
  "k8s-block-latest-tag|k8sblocklatesttag|TC-06|latest 태그 차단 정책"
  "k8s-block-host-network|k8sblockhostnetwork|TC-07|hostNetwork 차단 정책"
  "k8s-require-nonroot|k8srequirenonrootuser|TC-08|비루트 사용자 강제 정책"
  "k8s-require-readonly-rootfs|k8srequirereadonlyrootfs|TC-09|읽기 전용 FS 강제 정책"
)

for entry in "${TEMPLATES[@]}"; do
  IFS='|' read -r filename rego_pkg tc_id desc <<< "$entry"
  TEMPLATE_FILE="${INFRA_DIR}/templates/${filename}.yaml"
  if [ -f "$TEMPLATE_FILE" ]; then
    # ConstraintTemplate 형식 검증
    HAS_KIND=$(grep -c "kind: ConstraintTemplate" "$TEMPLATE_FILE" || true)
    HAS_REGO=$(grep -c "package ${rego_pkg}" "$TEMPLATE_FILE" || true)
    HAS_VIOLATION=$(grep -c "violation\[" "$TEMPLATE_FILE" || true)
    HAS_CSAP=$(grep -c "csap.compliance/control" "$TEMPLATE_FILE" || true)
    if [ "$HAS_KIND" -ge 1 ] && [ "$HAS_REGO" -ge 1 ] && [ "$HAS_VIOLATION" -ge 1 ] && [ "$HAS_CSAP" -ge 1 ]; then
      log_test "$tc_id" "$desc" "PASS"
    else
      log_test "$tc_id" "$desc (형식 불완전)" "FAIL"
    fi
  else
    log_test "$tc_id" "$desc (파일 미존재)" "FAIL"
  fi
done

# --- TC-10: Kyverno-Gatekeeper 역할 분리 문서 ---
echo ""
echo "[Phase 3] 역할 분리 및 통합 검증"
if [ -f "${INFRA_DIR}/ROLE-SEPARATION.md" ]; then
  HAS_KYVERNO=$(grep -c "Kyverno" "${INFRA_DIR}/ROLE-SEPARATION.md" || true)
  HAS_GATEKEEPER=$(grep -c "Gatekeeper" "${INFRA_DIR}/ROLE-SEPARATION.md" || true)
  HAS_CSAP_MAP=$(grep -c "CSAP" "${INFRA_DIR}/ROLE-SEPARATION.md" || true)
  if [ "$HAS_KYVERNO" -ge 3 ] && [ "$HAS_GATEKEEPER" -ge 3 ] && [ "$HAS_CSAP_MAP" -ge 3 ]; then
    log_test "TC-10" "Kyverno-Gatekeeper 역할 분리 문서 완비" "PASS"
  else
    log_test "TC-10" "역할 분리 문서 내용 불충분" "FAIL"
  fi
else
  log_test "TC-10" "ROLE-SEPARATION.md 미존재" "FAIL"
fi

# --- TC-11: Prometheus 메트릭 설정 검증 ---
if grep -q "prometheus.io/scrape" "${INFRA_DIR}/values.yaml" && \
   grep -q "prometheus.io/port" "${INFRA_DIR}/values.yaml"; then
  log_test "TC-11" "Prometheus 메트릭 노출 설정 완비" "PASS"
else
  log_test "TC-11" "Prometheus 메트릭 설정 누락" "FAIL"
fi

# --- TC-12: 정상 Pod Fixture 검증 ---
if [ -f "${FIXTURE_DIR}/valid-pod.yaml" ]; then
  HAS_RESOURCES=$(grep -c "resources:" "${FIXTURE_DIR}/valid-pod.yaml" || true)
  HAS_NONROOT=$(grep -c "runAsNonRoot: true" "${FIXTURE_DIR}/valid-pod.yaml" || true)
  HAS_READONLY=$(grep -c "readOnlyRootFilesystem: true" "${FIXTURE_DIR}/valid-pod.yaml" || true)
  HAS_NO_PRIV=$(grep -c "privileged: false" "${FIXTURE_DIR}/valid-pod.yaml" || true)
  HAS_REGISTRY=$(grep -c "harbor.local/" "${FIXTURE_DIR}/valid-pod.yaml" || true)
  if [ "$HAS_RESOURCES" -ge 1 ] && [ "$HAS_NONROOT" -ge 1 ] && [ "$HAS_READONLY" -ge 1 ] && \
     [ "$HAS_NO_PRIV" -ge 1 ] && [ "$HAS_REGISTRY" -ge 1 ]; then
    log_test "TC-12" "정상 Pod 모든 정책 통과 Fixture" "PASS"
  else
    log_test "TC-12" "정상 Pod Fixture 불완전" "FAIL"
  fi
else
  log_test "TC-12" "valid-pod.yaml 미존재" "FAIL"
fi

# --- TC-13: Constraint 인스턴스 검증 ---
echo ""
echo "[Phase 4] Constraint 인스턴스 검증"
CONSTRAINTS_DIR="${INFRA_DIR}/constraints"
CONSTRAINT_COUNT=$(ls -1 "${CONSTRAINTS_DIR}"/*.yaml 2>/dev/null | wc -l)
if [ "$CONSTRAINT_COUNT" -ge 8 ]; then
  log_test "TC-13" "Constraint 인스턴스 8개 이상 (실제: ${CONSTRAINT_COUNT}개)" "PASS"
else
  log_test "TC-13" "Constraint 인스턴스 부족 (실제: ${CONSTRAINT_COUNT}개, 필요: 8개)" "FAIL"
fi

# --- TC-14: Flux GitOps 연동 설정 ---
FLUX_FILE="/data/ai-saas/infra/flux/gatekeeper-kustomization.yaml"
if [ -f "$FLUX_FILE" ]; then
  HAS_KUSTOMIZATION=$(grep -c "kind: Kustomization" "$FLUX_FILE" || true)
  HAS_PATH=$(grep -c "path: ./infra/gatekeeper" "$FLUX_FILE" || true)
  if [ "$HAS_KUSTOMIZATION" -ge 1 ] && [ "$HAS_PATH" -ge 1 ]; then
    log_test "TC-14" "Flux GitOps Kustomization 설정 완비" "PASS"
  else
    log_test "TC-14" "Flux Kustomization 내용 불완전" "FAIL"
  fi
else
  log_test "TC-14" "gatekeeper-kustomization.yaml 미존재" "FAIL"
fi

# --- TC-15: Grafana 대시보드 검증 ---
DASHBOARD_FILE="/data/ai-saas/infra/monitoring/dashboards/gatekeeper-dashboard.json"
if [ -f "$DASHBOARD_FILE" ]; then
  HAS_PANELS=$(python3 -c "import json; d=json.load(open('$DASHBOARD_FILE')); print(len(d.get('panels',[])))" 2>/dev/null || echo "0")
  HAS_GATEKEEPER_TAG=$(grep -c '"gatekeeper"' "$DASHBOARD_FILE" || true)
  if [ "$HAS_PANELS" -ge 4 ] && [ "$HAS_GATEKEEPER_TAG" -ge 1 ]; then
    log_test "TC-15" "Grafana 대시보드 패널 ${HAS_PANELS}개 포함" "PASS"
  else
    log_test "TC-15" "Grafana 대시보드 내용 불충분" "FAIL"
  fi
else
  log_test "TC-15" "gatekeeper-dashboard.json 미존재" "FAIL"
fi

# --- TC-16: 테스트 Fixture 음성 케이스 검증 ---
echo ""
echo "[Phase 5] 음성 테스트 Fixture 검증"
INVALID_FIXTURES=(
  "invalid-privileged.yaml|TC-16a|특권 컨테이너 음성 Fixture"
  "invalid-no-limits.yaml|TC-16b|리소스 제한 누락 음성 Fixture"
  "invalid-registry.yaml|TC-16c|미승인 레지스트리 음성 Fixture"
  "invalid-hostpath.yaml|TC-16d|hostPath 마운트 음성 Fixture"
  "invalid-latest-tag.yaml|TC-16e|latest 태그 음성 Fixture"
)

for entry in "${INVALID_FIXTURES[@]}"; do
  IFS='|' read -r filename tc_id desc <<< "$entry"
  if [ -f "${FIXTURE_DIR}/${filename}" ]; then
    log_test "$tc_id" "$desc" "PASS"
  else
    log_test "$tc_id" "$desc (미존재)" "FAIL"
  fi
done

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
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}[ALL PASS] OPA Gatekeeper 정책 통합 테스트 완료${NC}"
  exit 0
else
  echo -e "${RED}[PARTIAL] ${FAIL}건 실패${NC}"
  exit 1
fi
