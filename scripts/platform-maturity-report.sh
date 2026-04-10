#!/bin/bash
# ============================================================================
# 플랫폼 운영 성숙도 종합 보고서
# Plan SC: FR-N141.1, FR-N141.2, FR-N141.3, FR-N141.4
# Design Ref: MTU-N141 Design §1
# CSAP: 전체 (종합 평가)
#
# 사용법:
#   ./scripts/platform-maturity-report.sh                # 전체 보고서
#   ./scripts/platform-maturity-report.sh --area security # 특정 영역
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
AUDIT_LOG="${PROJECT_ROOT}/.claude/audit.jsonl"
AREA_FILTER=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# 성숙도 점수
declare -A AREA_SCORES
AREA_SCORES=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        --area) AREA_FILTER="$2"; shift 2 ;;
        --help)
            echo "사용법: platform-maturity-report.sh [옵션]"
            echo "  --area AREA   특정 영역 (monitoring|incident|change|security|finops|dr|automation)"
            exit 0 ;;
        *) shift ;;
    esac
done

log_audit() {
    local entry="{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"platform-maturity-report\",\"action\":\"$1\",\"detail\":\"$2\"}"
    echo "${entry}" >> "${AUDIT_LOG}" 2>/dev/null || true
}

level_text() {
    case "$1" in
        1) echo "초기 (Initial)" ;;
        2) echo "반복 (Repeatable)" ;;
        3) echo "정의 (Defined)" ;;
        4) echo "관리 (Managed)" ;;
        5) echo "최적화 (Optimized)" ;;
    esac
}

level_bar() {
    local level=$1
    local bar=""
    for i in 1 2 3 4 5; do
        if [ "${i}" -le "${level}" ]; then
            bar="${bar}#"
        else
            bar="${bar}-"
        fi
    done
    echo "[${bar}]"
}

# ============================================================================
# 1. 모니터링 성숙도
# ============================================================================
assess_monitoring() {
    echo -e "${CYAN}  [1/7] 모니터링${NC}"
    local score=1

    # Prometheus 설정
    local prom_rules=0
    prom_rules=$(find "${PROJECT_ROOT}/infra/monitoring" -name "*rules*" -o -name "*recording*" 2>/dev/null | wc -l || echo "0")
    [ "${prom_rules}" -ge 1 ] && score=2
    [ "${prom_rules}" -ge 5 ] && score=3

    # Grafana 대시보드
    local dashboards=0
    dashboards=$(find "${PROJECT_ROOT}/infra/monitoring/dashboards" -name "*.json" -o -name "*.yaml" 2>/dev/null | wc -l || echo "0")
    [ "${dashboards}" -ge 10 ] && score=4

    # 통합 허브
    [ -f "${PROJECT_ROOT}/infra/monitoring/dashboards/ops-hub-home.json" ] && score=4

    # 예측 규칙
    [ -f "${PROJECT_ROOT}/infra/monitoring/capacity-forecast-rules.yaml" ] && score=5

    AREA_SCORES[monitoring]=${score}
    echo -e "        $(level_bar ${score}) 단계 ${score}: $(level_text ${score})"
    echo "        근거: 규칙 ${prom_rules}개, 대시보드 ${dashboards}개"
}

# ============================================================================
# 2. 인시던트 관리 성숙도
# ============================================================================
assess_incident() {
    echo -e "${CYAN}  [2/7] 인시던트 관리${NC}"
    local score=1

    local tools=0
    [ -f "${SCRIPT_DIR}/generate-incident-timeline.sh" ] && tools=$((tools+1))
    [ -f "${SCRIPT_DIR}/generate-postmortem.sh" ] && tools=$((tools+1))
    [ -f "${SCRIPT_DIR}/oncall-status.sh" ] && tools=$((tools+1))
    [ -f "${SCRIPT_DIR}/runbook-index.sh" ] && tools=$((tools+1))
    [ -f "${SCRIPT_DIR}/analyze-alert-fatigue.sh" ] && tools=$((tools+1))

    [ "${tools}" -ge 1 ] && score=2
    [ "${tools}" -ge 3 ] && score=3
    [ "${tools}" -ge 4 ] && score=4
    [ "${tools}" -ge 5 ] && score=5

    local runbook_count=0
    runbook_count=$(find "${SCRIPT_DIR}" -name "runbook-auto-*.sh" 2>/dev/null | wc -l || echo "0")

    AREA_SCORES[incident]=${score}
    echo -e "        $(level_bar ${score}) 단계 ${score}: $(level_text ${score})"
    echo "        근거: 도구 ${tools}개, 자동 런북 ${runbook_count}개"
}

# ============================================================================
# 3. 변경 관리 성숙도
# ============================================================================
assess_change() {
    echo -e "${CYAN}  [3/7] 변경 관리${NC}"
    local score=1

    [ -f "${PROJECT_ROOT}/.gitea/workflows/ci.yml" ] && score=2
    [ -f "${SCRIPT_DIR}/change-impact-analysis.sh" ] && score=3
    [ -f "${SCRIPT_DIR}/verify-deployment.sh" ] && score=4
    [ -f "${SCRIPT_DIR}/cicd-quality-gate.sh" ] && score=5

    AREA_SCORES[change]=${score}
    echo -e "        $(level_bar ${score}) 단계 ${score}: $(level_text ${score})"
}

# ============================================================================
# 4. 보안 성숙도
# ============================================================================
assess_security() {
    echo -e "${CYAN}  [4/7] 보안${NC}"
    local score=1

    [ -f "${PROJECT_ROOT}/.claude/rules/csap-compliance.md" ] && score=2
    [ -f "${SCRIPT_DIR}/security-compliance-scan.sh" ] && score=3
    [ -f "${SCRIPT_DIR}/dependency-security-audit.sh" ] && score=4

    # Cosign/SBOM
    local supply_chain=0
    supply_chain=$(grep -rl "cosign\|sbom\|sigstore" "${PROJECT_ROOT}/infra/" "${PROJECT_ROOT}/scripts/" 2>/dev/null | wc -l || echo "0")
    [ "${supply_chain}" -ge 2 ] && score=5

    AREA_SCORES[security]=${score}
    echo -e "        $(level_bar ${score}) 단계 ${score}: $(level_text ${score})"
}

# ============================================================================
# 5. FinOps 성숙도
# ============================================================================
assess_finops() {
    echo -e "${CYAN}  [5/7] FinOps${NC}"
    local score=1

    [ -f "${PROJECT_ROOT}/infra/monitoring/finops-cost-rules.yaml" ] && score=2
    [ -f "${SCRIPT_DIR}/cost-optimization-report.sh" ] && score=3

    local vpa_files=0
    vpa_files=$(grep -rl "VerticalPodAutoscaler\|VPA" "${PROJECT_ROOT}/infra/" 2>/dev/null | wc -l || echo "0")
    [ "${vpa_files}" -ge 1 ] && score=4
    [ -f "${SCRIPT_DIR}/capacity-forecast.sh" ] && score=5

    AREA_SCORES[finops]=${score}
    echo -e "        $(level_bar ${score}) 단계 ${score}: $(level_text ${score})"
}

# ============================================================================
# 6. DR 성숙도
# ============================================================================
assess_dr() {
    echo -e "${CYAN}  [6/7] 재해 복구 (DR)${NC}"
    local score=1

    [ -f "${SCRIPT_DIR}/db-backup.sh" ] && score=2
    [ -f "${SCRIPT_DIR}/db-restore.sh" ] && score=3
    [ -f "${SCRIPT_DIR}/dr-simulation.sh" ] && score=4
    [ -f "${SCRIPT_DIR}/healthcheck.sh" ] && [ -f "${SCRIPT_DIR}/prod-readiness-check.sh" ] && score=5

    AREA_SCORES[dr]=${score}
    echo -e "        $(level_bar ${score}) 단계 ${score}: $(level_text ${score})"
}

# ============================================================================
# 7. 자동화 성숙도
# ============================================================================
assess_automation() {
    echo -e "${CYAN}  [7/7] 자동화${NC}"
    local score=1

    local total_scripts=0
    total_scripts=$(find "${SCRIPT_DIR}" -name "*.sh" 2>/dev/null | wc -l || echo "0")
    local test_scripts=0
    test_scripts=$(find "${SCRIPT_DIR}" -name "test-*.sh" 2>/dev/null | wc -l || echo "0")

    [ "${total_scripts}" -ge 10 ] && score=2
    [ "${total_scripts}" -ge 30 ] && score=3
    [ "${test_scripts}" -ge 10 ] && score=4
    [ "${total_scripts}" -ge 50 ] && [ "${test_scripts}" -ge 15 ] && score=5

    AREA_SCORES[automation]=${score}
    echo -e "        $(level_bar ${score}) 단계 ${score}: $(level_text ${score})"
    echo "        근거: 스크립트 ${total_scripts}개, 테스트 ${test_scripts}개"
}

# ============================================================================
# 종합 보고서
# ============================================================================
generate_summary() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  성숙도 종합 결과${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    echo "  ────────────────────────────────────────────────"
    printf "  %-20s %-15s %-20s\n" "영역" "성숙도" "등급"
    echo "  ────────────────────────────────────────────────"

    local total_score=0
    local area_count=0

    for area in monitoring incident change security finops dr automation; do
        local score=${AREA_SCORES[${area}]:-1}
        total_score=$((total_score + score))
        area_count=$((area_count + 1))

        local area_name=""
        case "${area}" in
            monitoring) area_name="모니터링" ;;
            incident) area_name="인시던트 관리" ;;
            change) area_name="변경 관리" ;;
            security) area_name="보안" ;;
            finops) area_name="FinOps" ;;
            dr) area_name="재해 복구" ;;
            automation) area_name="자동화" ;;
        esac

        printf "  %-20s %-15s %-20s\n" "${area_name}" "$(level_bar ${score})" "단계 ${score}"
    done

    echo "  ────────────────────────────────────────────────"

    local avg_score=$((total_score / area_count))
    echo ""
    echo -e "  ${BOLD}종합 성숙도: 단계 ${avg_score}/5 — $(level_text ${avg_score})${NC}"
    echo -e "  ${BOLD}총점: ${total_score}/35${NC}"
    echo ""

    # 개선 권고
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  개선 권고사항${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    for area in monitoring incident change security finops dr automation; do
        local score=${AREA_SCORES[${area}]:-1}
        if [ "${score}" -lt 4 ]; then
            local area_name=""
            case "${area}" in
                monitoring) area_name="모니터링" ;;
                incident) area_name="인시던트 관리" ;;
                change) area_name="변경 관리" ;;
                security) area_name="보안" ;;
                finops) area_name="FinOps" ;;
                dr) area_name="재해 복구" ;;
                automation) area_name="자동화" ;;
            esac
            echo -e "  ${YELLOW}[${area_name}]${NC} 현재 단계 ${score} → 목표 단계 $((score + 1))"
            case "${area}" in
                monitoring) echo "    - 대시보드 통합 + 예측 알림 추가" ;;
                incident) echo "    - 자동 런북 확충 + AI 기반 근본 원인 분석" ;;
                change) echo "    - 자동 롤백 + 카나리 배포 구현" ;;
                security) echo "    - SBOM + Sigstore 서명 자동화" ;;
                finops) echo "    - AI 기반 비용 이상 탐지 + 자동 스케일링" ;;
                dr) echo "    - 자동 DR 훈련 + 복구 시간 측정" ;;
                automation) echo "    - 자동 테스트 커버리지 확대" ;;
            esac
            echo ""
        fi
    done

    log_audit "MATURITY_REPORT" "total=${total_score}/35,avg=${avg_score}/5"
}

# ============================================================================
# 메인
# ============================================================================
main() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  플랫폼 운영 성숙도 종합 보고서${NC}"
    echo -e "${CYAN}  날짜: $(date -Iseconds)${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    echo -e "${BOLD}  영역별 성숙도 평가:${NC}"
    echo ""

    if [ -n "${AREA_FILTER}" ]; then
        case "${AREA_FILTER}" in
            monitoring) assess_monitoring ;;
            incident)   assess_incident ;;
            change)     assess_change ;;
            security)   assess_security ;;
            finops)     assess_finops ;;
            dr)         assess_dr ;;
            automation) assess_automation ;;
            *) echo "알 수 없는 영역: ${AREA_FILTER}"; exit 1 ;;
        esac
    else
        assess_monitoring
        assess_incident
        assess_change
        assess_security
        assess_finops
        assess_dr
        assess_automation
    fi

    generate_summary

    echo -e "${GREEN}성숙도 보고서 생성 완료${NC}"
}

main "$@"
