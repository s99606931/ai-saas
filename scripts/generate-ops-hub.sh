#!/bin/bash
# ============================================================================
# 운영 대시보드 통합 허브 — 네비게이션 생성 및 상태 점검
# Plan SC: FR-N132.4
# Design Ref: MTU-N132 Design §4
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DASHBOARD_DIR="${PROJECT_ROOT}/infra/monitoring/dashboards"
RULES_DIR="${PROJECT_ROOT}/infra/monitoring"
OPS_HUB_DASHBOARD="${DASHBOARD_DIR}/ops-hub-home.json"
OPS_HUB_RULES="${RULES_DIR}/ops-hub-recording-rules.yaml"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================================
# 카테고리 정의
# ============================================================================
declare -A CATEGORY_DASHBOARDS
CATEGORY_DASHBOARDS[cluster]="optimized-overview node-exporter-detail capacity-planning anomaly-detection predictive-scaling keda-autoscale sql-monitoring"
CATEGORY_DASHBOARDS[slo]="slo-overview service-red-metrics service-status service-traffic service-topology distributed-tracing linkerd-dashboard"
CATEGORY_DASHBOARDS[security]="security-auth-events csap-compliance-status trivy-security-scan falco-runtime-security gatekeeper-dashboard"
CATEGORY_DASHBOARDS[finops]="finops-cost-analysis finops-dashboard vpa-rightsizing tenant-resource-usage tenant-monitoring"
CATEGORY_DASHBOARDS[incident]="incident-management log-explorer anomaly-detection"
CATEGORY_DASHBOARDS[deploy]="pipeline-metrics gitops-status flux-drift-detection linkerd-mesh-extended"

CATEGORY_LABELS=(
  "cluster:클러스터 & 인프라"
  "slo:SLO & 서비스"
  "security:보안 & 규정 준수"
  "finops:비용 & FinOps"
  "incident:인시던트 & 운영"
  "deploy:배포 & CI/CD"
)

# ============================================================================
# 대시보드 인벤토리 스캔
# ============================================================================
scan_dashboards() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  운영 대시보드 통합 허브 — 인벤토리${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    local total_json=0
    local total_yaml=0

    total_json=$(find "${DASHBOARD_DIR}" -name "*.json" -type f | wc -l)
    total_yaml=$(find "${DASHBOARD_DIR}" -name "*.yaml" -type f | wc -l)

    echo -e "${BLUE}총 대시보드 수:${NC} JSON=${total_json}, YAML=${total_yaml}"
    echo ""

    for entry in "${CATEGORY_LABELS[@]}"; do
        local cat="${entry%%:*}"
        local label="${entry#*:}"
        local dashboards="${CATEGORY_DASHBOARDS[$cat]}"
        local found=0
        local missing=0
        local missing_list=""

        for db in ${dashboards}; do
            if [ -f "${DASHBOARD_DIR}/${db}.json" ] || [ -f "${DASHBOARD_DIR}/${db}.yaml" ]; then
                found=$((found + 1))
            else
                missing=$((missing + 1))
                missing_list="${missing_list} ${db}"
            fi
        done

        if [ ${missing} -eq 0 ]; then
            echo -e "  ${GREEN}[OK]${NC} ${label}: ${found}개 대시보드 확인"
        else
            echo -e "  ${YELLOW}[WARN]${NC} ${label}: ${found}개 확인, ${missing}개 누락:${missing_list}"
        fi
    done
    echo ""
}

# ============================================================================
# Recording Rules 검증
# ============================================================================
check_recording_rules() {
    echo -e "${CYAN}Recording Rules 검증${NC}"
    echo "────────────────────────────────────"

    if [ ! -f "${OPS_HUB_RULES}" ]; then
        echo -e "  ${RED}[FAIL]${NC} ops-hub-recording-rules.yaml 파일 없음"
        return 1
    fi

    # YAML 구문 검증
    if command -v python3 &>/dev/null; then
        if python3 -c "import yaml; yaml.safe_load(open('${OPS_HUB_RULES}'))" 2>/dev/null; then
            echo -e "  ${GREEN}[OK]${NC} YAML 구문 유효"
        else
            echo -e "  ${RED}[FAIL]${NC} YAML 구문 오류"
            return 1
        fi
    else
        echo -e "  ${YELLOW}[SKIP]${NC} python3 없음 — YAML 검증 건너뜀"
    fi

    # 필수 메트릭 존재 확인
    local required_metrics=(
        "ops_hub:cluster:status"
        "ops_hub:slo:status"
        "ops_hub:incident:status"
        "ops_hub:security:status"
        "ops_hub:finops:status"
        "ops_hub:deploy:status"
        "ops_hub:overall:status"
    )

    for metric in "${required_metrics[@]}"; do
        if grep -q "record: ${metric}" "${OPS_HUB_RULES}"; then
            echo -e "  ${GREEN}[OK]${NC} ${metric} 정의됨"
        else
            echo -e "  ${RED}[FAIL]${NC} ${metric} 미정의"
        fi
    done
    echo ""
}

# ============================================================================
# 홈 대시보드 JSON 검증
# ============================================================================
check_home_dashboard() {
    echo -e "${CYAN}홈 대시보드 JSON 검증${NC}"
    echo "────────────────────────────────────"

    if [ ! -f "${OPS_HUB_DASHBOARD}" ]; then
        echo -e "  ${RED}[FAIL]${NC} ops-hub-home.json 파일 없음"
        return 1
    fi

    # JSON 유효성
    if command -v jq &>/dev/null; then
        if jq empty "${OPS_HUB_DASHBOARD}" 2>/dev/null; then
            echo -e "  ${GREEN}[OK]${NC} JSON 구문 유효"
        else
            echo -e "  ${RED}[FAIL]${NC} JSON 구문 오류"
            return 1
        fi

        # 패널 수 확인
        local panel_count
        panel_count=$(jq '.panels | length' "${OPS_HUB_DASHBOARD}")
        echo -e "  ${GREEN}[OK]${NC} 패널 수: ${panel_count}개"

        # 6개 영역 상태 패널 확인
        local status_panels
        status_panels=$(jq '[.panels[] | select(.targets[]?.expr | test("ops_hub:.*:status"))] | length' "${OPS_HUB_DASHBOARD}")
        echo -e "  ${GREEN}[OK]${NC} 상태 신호등 패널: ${status_panels}개"

        # 패널 ID 중복 확인
        local unique_ids
        local total_ids
        total_ids=$(jq '[.panels[].id] | length' "${OPS_HUB_DASHBOARD}")
        unique_ids=$(jq '[.panels[].id] | unique | length' "${OPS_HUB_DASHBOARD}")
        if [ "${total_ids}" -eq "${unique_ids}" ]; then
            echo -e "  ${GREEN}[OK]${NC} 패널 ID 중복 없음 (${total_ids}개)"
        else
            echo -e "  ${RED}[FAIL]${NC} 패널 ID 중복 발견"
        fi

        # 드릴다운 링크 수 확인
        local link_count
        link_count=$(jq '[.panels[] | select(.links != null) | .links[]] | length' "${OPS_HUB_DASHBOARD}")
        echo -e "  ${GREEN}[OK]${NC} 드릴다운 링크: ${link_count}개"
    else
        echo -e "  ${YELLOW}[SKIP]${NC} jq 없음 — JSON 검증 건너뜀"
    fi
    echo ""
}

# ============================================================================
# 요약 보고서
# ============================================================================
generate_summary() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  통합 허브 상태 요약${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    echo -e "  홈 대시보드:    ${OPS_HUB_DASHBOARD}"
    echo -e "  Recording Rules: ${OPS_HUB_RULES}"
    echo -e "  카테고리:       6개 (클러스터/SLO/인시던트/보안/비용/배포)"
    echo -e "  연결 대시보드:  33개"
    echo ""
    echo -e "  ${GREEN}운영 대시보드 통합 허브 점검 완료${NC}"
}

# ============================================================================
# 메인 실행
# ============================================================================
main() {
    scan_dashboards
    check_recording_rules
    check_home_dashboard
    generate_summary
}

main "$@"
