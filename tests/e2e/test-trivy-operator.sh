#!/bin/bash
# =============================================================================
# MTU-N63: Trivy Operator 클러스터 보안 스캔 검증
# Design Ref: MTU-N63.design.md §1~§4
# Plan SC: FR-N63.1~FR-N63.7
# =============================================================================

set -euo pipefail

PASS=0
FAIL=0
TOTAL=0
TRIVY_DIR="/data/ai-saas/infra/trivy-operator"
DASH_DIR="/data/ai-saas/infra/monitoring/dashboards"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

run_test() {
  local id="$1" desc="$2" cmd="$3"
  TOTAL=$((TOTAL + 1))
  if eval "$cmd" > /dev/null 2>&1; then
    echo -e "  ${GREEN}[PASS]${NC} ${id}: ${desc}"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}[FAIL]${NC} ${id}: ${desc}"
    FAIL=$((FAIL + 1))
  fi
}

echo "============================================================"
echo " MTU-N63: Trivy Operator 보안 스캔 검증"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"

# --- FR-N63.1: Helm values ---
echo ""
echo "--- FR-N63.1: Helm values ---"

run_test "TC-01" "values.yaml 존재" \
  "[ -f '${TRIVY_DIR}/values.yaml' ]"

run_test "TC-02" "Standalone 모드 설정" \
  "grep -q 'mode: Standalone' '${TRIVY_DIR}/values.yaml'"

run_test "TC-03" "취약점 심각도 필터" \
  "grep -q 'severity: CRITICAL,HIGH,MEDIUM' '${TRIVY_DIR}/values.yaml'"

run_test "TC-04" "동시 스캔 제한 설정" \
  "grep -q 'scanJobsConcurrentLimit' '${TRIVY_DIR}/values.yaml'"

run_test "TC-05" "ServiceMonitor 활성화" \
  "grep -q 'serviceMonitor:' '${TRIVY_DIR}/values.yaml'"

# --- FR-N63.2~3: VulnerabilityReport + ConfigAudit ---
echo ""
echo "--- FR-N63.2~3: 스캔 설정 ---"

run_test "TC-06" "취약점 스캐너 활성화" \
  "grep -q 'vulnerabilityScannerEnabled: true' '${TRIVY_DIR}/values.yaml'"

run_test "TC-07" "설정 감사 스캐너 활성화" \
  "grep -q 'configAuditScannerEnabled: true' '${TRIVY_DIR}/values.yaml'"

# --- FR-N63.4: CIS Benchmark ---
echo ""
echo "--- FR-N63.4: CIS Benchmark ---"

run_test "TC-08" "컴플라이언스 활성화" \
  "grep -q 'complianceEnabled: true' '${TRIVY_DIR}/values.yaml'"

run_test "TC-09" "컴플라이언스 스캔 주기 6시간" \
  "grep -q '0 \*/6' '${TRIVY_DIR}/values.yaml'"

# --- FR-N63.5: Prometheus 알림 ---
echo ""
echo "--- FR-N63.5: Prometheus 알림 ---"

run_test "TC-10" "alerting-rules.yaml 존재" \
  "[ -f '${TRIVY_DIR}/alerting-rules.yaml' ]"

run_test "TC-11" "TrivyCriticalVulnerability 알림" \
  "grep -q 'TrivyCriticalVulnerability' '${TRIVY_DIR}/alerting-rules.yaml'"

# --- FR-N63.6: Grafana 대시보드 ---
echo ""
echo "--- FR-N63.6: Grafana 대시보드 ---"

run_test "TC-12" "Trivy 대시보드 파일 존재" \
  "[ -f '${DASH_DIR}/trivy-security-scan.json' ]"

run_test "TC-13" "Trivy 대시보드 유효 JSON" \
  "python3 -c \"import json; json.load(open('${DASH_DIR}/trivy-security-scan.json'))\""

run_test "TC-14" "Trivy 대시보드 패널 6개 이상" \
  "python3 -c \"
import json
d = json.load(open('${DASH_DIR}/trivy-security-scan.json'))
panels = [p for p in d.get('panels', []) if p.get('type') != 'row']
assert len(panels) >= 6, f'panels={len(panels)}'
\""

# --- 결과 ---
echo ""
echo "============================================================"
echo " 결과: PASS: ${PASS} / FAIL: ${FAIL} / 총: ${TOTAL}"
if [ "${TOTAL}" -gt 0 ]; then
  RATE=$(awk "BEGIN {printf \"%.1f\", (${PASS}/${TOTAL})*100}")
  echo " 통과율: ${RATE}%"
fi
echo "============================================================"

if [ "${FAIL}" -eq 0 ]; then
  echo -e "\n${GREEN}[ALL PASS] MTU-N63 Trivy Operator 검증 완료${NC}"
  exit 0
else
  echo -e "\n${RED}[PARTIAL] ${FAIL}건 실패${NC}"
  exit 1
fi
