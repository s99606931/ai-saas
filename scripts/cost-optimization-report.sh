#!/bin/bash
# ============================================================================
# 비용 최적화 보고서 — FinOps + 용량 + 기술 부채 종합 분석
# Plan SC: FR-N134.1, FR-N134.2, FR-N134.3, FR-N134.4
# Design Ref: MTU-N134 Design §1, §2, §3
# CSAP: D-06 (비용 감사 추적)
#
# 사용법:
#   ./scripts/cost-optimization-report.sh                    # 전체 보고서
#   ./scripts/cost-optimization-report.sh --section summary  # 특정 섹션
#   ./scripts/cost-optimization-report.sh --output-dir DIR   # 출력 경로
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUTPUT_DIR="${PROJECT_ROOT}/docs/reports/cost-optimization"
AUDIT_LOG="${PROJECT_ROOT}/.claude/audit.jsonl"
SECTION_FILTER=""
REPORT_DATE=$(date +%Y-%m-%d)

# 비용 모델 (Design Ref: §2)
CPU_COST_PER_VCPU_HOUR=0.05
MEM_COST_PER_GIB_HOUR=0.01
STORAGE_COST_PER_GIB_MONTH=0.10

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ============================================================================
# 인수 파싱
# ============================================================================
while [[ $# -gt 0 ]]; do
    case "$1" in
        --section) SECTION_FILTER="$2"; shift 2 ;;
        --output-dir) OUTPUT_DIR="$2"; shift 2 ;;
        --help)
            echo "사용법: cost-optimization-report.sh [옵션]"
            echo "  --section SECTION   특정 섹션 (summary|tenant|efficiency|recommendations|debt)"
            echo "  --output-dir DIR    출력 경로 (기본: docs/reports/cost-optimization)"
            exit 0 ;;
        *) shift ;;
    esac
done

mkdir -p "${OUTPUT_DIR}"

log_audit() {
    local action="$1"
    local detail="$2"
    local entry="{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"cost-optimization-report\",\"action\":\"${action}\",\"detail\":\"${detail}\"}"
    echo "${entry}" >> "${AUDIT_LOG}" 2>/dev/null || true
}

# ============================================================================
# 1. Executive Summary
# Design Ref: MTU-N134 Design §1 섹션 1
# Plan SC: FR-N134.1
# ============================================================================
section_summary() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  1. Executive Summary${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    # 인프라 구성 분석
    local helm_charts=0
    helm_charts=$(find "${PROJECT_ROOT}/infra" -name "Chart.yaml" -o -name "values.yaml" 2>/dev/null | wc -l || echo "0")

    local k8s_manifests=0
    k8s_manifests=$(find "${PROJECT_ROOT}/infra" -name "*.yaml" -o -name "*.yml" 2>/dev/null | \
        grep -v node_modules | wc -l || echo "0")

    local services=0
    services=$(find "${PROJECT_ROOT}/platform/services" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l || echo "0")

    # 비용 추정 (정적 분석 기반)
    # 서비스당 평균 0.5 vCPU + 512MiB 가정
    local est_cpu_cost
    local est_mem_cost
    local est_monthly_cost
    est_cpu_cost=$(echo "${services} * 0.5 * ${CPU_COST_PER_VCPU_HOUR} * 720" | bc 2>/dev/null || echo "0")
    est_mem_cost=$(echo "${services} * 0.5 * ${MEM_COST_PER_GIB_HOUR} * 720" | bc 2>/dev/null || echo "0")
    est_monthly_cost=$(echo "${est_cpu_cost} + ${est_mem_cost}" | bc 2>/dev/null || echo "0")

    echo -e "  ${BOLD}보고서 날짜:${NC} ${REPORT_DATE}"
    echo -e "  ${BOLD}인프라 규모:${NC}"
    echo "    - Helm 차트: ${helm_charts}개"
    echo "    - K8s 매니페스트: ${k8s_manifests}개"
    echo "    - 마이크로서비스: ${services}개"
    echo ""
    echo -e "  ${BOLD}월간 비용 추정:${NC}"
    echo "    - CPU 비용: \$${est_cpu_cost:-0}/월"
    echo "    - 메모리 비용: \$${est_mem_cost:-0}/월"
    echo "    - 합계: \$${est_monthly_cost:-0}/월"
    echo ""

    # 효율성 등급 추정
    local resource_files=0
    resource_files=$(grep -rl "resources:" "${PROJECT_ROOT}/infra/" 2>/dev/null | wc -l || echo "0")
    local limit_files=0
    limit_files=$(grep -rl "limits:" "${PROJECT_ROOT}/infra/" 2>/dev/null | wc -l || echo "0")

    local efficiency_pct=0
    if [ "${resource_files}" -gt 0 ]; then
        efficiency_pct=$((limit_files * 100 / resource_files))
    fi

    local grade="D"
    if [ "${efficiency_pct}" -ge 80 ]; then
        grade="A"
    elif [ "${efficiency_pct}" -ge 60 ]; then
        grade="B"
    elif [ "${efficiency_pct}" -ge 40 ]; then
        grade="C"
    fi

    echo -e "  ${BOLD}효율성 등급:${NC} ${grade} (리소스 제한 설정률: ${efficiency_pct}%)"
    echo ""
}

# ============================================================================
# 2. 테넌트별 비용 분석
# Design Ref: MTU-N134 Design §1 섹션 2
# Plan SC: FR-N134.1
# ============================================================================
section_tenant() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  2. 테넌트별 비용 분석${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    # 네임스페이스별 리소스 요청 분석 (매니페스트 기반)
    echo -e "  ${BOLD}네임스페이스별 리소스 정의:${NC}"
    echo "  ──────────────────────────────────────────────────"
    printf "  %-20s %-12s %-12s %-10s\n" "네임스페이스" "CPU 요청" "메모리 요청" "비용/월"
    echo "  ──────────────────────────────────────────────────"

    local namespaces=("platform" "monitoring" "database" "gitea" "harbor" "cert-manager")
    local total_cost=0

    for ns in "${namespaces[@]}"; do
        local cpu_count=0
        local mem_count=0
        cpu_count=$(grep -r "cpu:" "${PROJECT_ROOT}/infra/" 2>/dev/null | \
            grep -i "${ns}" | wc -l || echo "0")
        mem_count=$(grep -r "memory:" "${PROJECT_ROOT}/infra/" 2>/dev/null | \
            grep -i "${ns}" | wc -l || echo "0")

        # 정의 수 기반 간접 비용 추정
        local ns_cost
        ns_cost=$(echo "(${cpu_count} * 0.25 * ${CPU_COST_PER_VCPU_HOUR} + ${mem_count} * 0.256 * ${MEM_COST_PER_GIB_HOUR}) * 720" | bc 2>/dev/null || echo "0")
        total_cost=$(echo "${total_cost} + ${ns_cost}" | bc 2>/dev/null || echo "${total_cost}")

        printf "  %-20s %-12s %-12s \$%-10s\n" "${ns}" "${cpu_count}개 정의" "${mem_count}개 정의" "${ns_cost:-0}"
    done

    echo "  ──────────────────────────────────────────────────"
    printf "  %-20s %-12s %-12s \$%-10s\n" "합계" "" "" "${total_cost:-0}"
    echo ""
}

# ============================================================================
# 3. 리소스 효율성 분석
# Design Ref: MTU-N134 Design §1 섹션 3
# Plan SC: FR-N134.2
# ============================================================================
section_efficiency() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  3. 리소스 효율성 분석${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    # VPA 설정 확인
    echo -e "  ${BOLD}VPA (Vertical Pod Autoscaler) 현황:${NC}"
    local vpa_files=0
    vpa_files=$(grep -rl "VerticalPodAutoscaler\|VPA" "${PROJECT_ROOT}/infra/" 2>/dev/null | wc -l || echo "0")
    echo "    - VPA 설정 파일: ${vpa_files}개"

    # HPA 설정 확인
    local hpa_files=0
    hpa_files=$(grep -rl "HorizontalPodAutoscaler\|autoscaling" "${PROJECT_ROOT}/infra/" 2>/dev/null | wc -l || echo "0")
    echo "    - HPA 설정 파일: ${hpa_files}개"

    # KEDA 설정 확인
    local keda_files=0
    keda_files=$(grep -rl "ScaledObject\|keda" "${PROJECT_ROOT}/infra/" 2>/dev/null | wc -l || echo "0")
    echo "    - KEDA 설정 파일: ${keda_files}개"
    echo ""

    # 과잉 프로비저닝 탐지 (리소스 요청이 있지만 제한이 없는 경우)
    echo -e "  ${BOLD}과잉 프로비저닝 위험 항목:${NC}"
    local overprovisioned=0

    # requests 있지만 limits 없는 파일 탐지
    while IFS= read -r file; do
        if grep -q "requests:" "${file}" 2>/dev/null && ! grep -q "limits:" "${file}" 2>/dev/null; then
            local basename
            basename=$(basename "${file}")
            echo -e "    ${YELLOW}[WARN]${NC} ${basename}: requests 있음, limits 없음"
            overprovisioned=$((overprovisioned + 1))
        fi
    done < <(find "${PROJECT_ROOT}/infra" -name "*.yaml" -o -name "*.yml" 2>/dev/null | head -50)

    if [ "${overprovisioned}" -eq 0 ]; then
        echo -e "    ${GREEN}[OK]${NC} 과잉 프로비저닝 위험 항목 없음"
    fi
    echo ""

    # Recording Rules 기반 효율성 지표
    echo -e "  ${BOLD}효율성 Recording Rules:${NC}"
    local efficiency_rules=0
    efficiency_rules=$(grep -c "efficiency\|ratio\|utilization" \
        "${PROJECT_ROOT}/infra/monitoring/finops-cost-rules.yaml" 2>/dev/null || echo "0")
    echo "    - 효율성 관련 규칙: ${efficiency_rules}개"
    echo ""
}

# ============================================================================
# 4. 최적화 권고사항
# Design Ref: MTU-N134 Design §1 섹션 4
# Plan SC: FR-N134.3
# ============================================================================
section_recommendations() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  4. 최적화 권고사항${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    local rec_num=0

    # 4-1. VPA 적용 권고
    local vpa_files=0
    vpa_files=$(grep -rl "VerticalPodAutoscaler" "${PROJECT_ROOT}/infra/" 2>/dev/null | wc -l || echo "0")
    local services=0
    services=$(find "${PROJECT_ROOT}/platform/services" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l || echo "0")

    if [ "${vpa_files}" -lt "${services}" ]; then
        rec_num=$((rec_num + 1))
        echo -e "  ${YELLOW}[R${rec_num}]${NC} VPA 적용 확대"
        echo "        현재 VPA: ${vpa_files}개, 서비스: ${services}개"
        echo "        미적용 서비스에 VPA recommendOnly 모드 추가 권고"
        echo "        예상 절감: 과잉 프로비저닝 20~30% 감소"
        echo ""
    fi

    # 4-2. 미사용 ConfigMap/Secret 정리
    local configmap_count=0
    configmap_count=$(grep -rl "kind: ConfigMap" "${PROJECT_ROOT}/infra/" 2>/dev/null | wc -l || echo "0")
    if [ "${configmap_count}" -gt 20 ]; then
        rec_num=$((rec_num + 1))
        echo -e "  ${YELLOW}[R${rec_num}]${NC} ConfigMap/Secret 정리"
        echo "        ${configmap_count}개 ConfigMap 발견 — 미사용 항목 점검 권고"
        echo "        예상 절감: etcd 스토리지 최적화"
        echo ""
    fi

    # 4-3. 이미지 크기 최적화
    local dockerfile_count=0
    dockerfile_count=$(find "${PROJECT_ROOT}" -name "Dockerfile*" 2>/dev/null | wc -l || echo "0")
    local alpine_count=0
    alpine_count=$(grep -rl "alpine\|slim\|distroless" "${PROJECT_ROOT}" 2>/dev/null | \
        grep -i docker | wc -l || echo "0")

    if [ "${dockerfile_count}" -gt 0 ] && [ "${alpine_count}" -lt "${dockerfile_count}" ]; then
        rec_num=$((rec_num + 1))
        echo -e "  ${YELLOW}[R${rec_num}]${NC} 컨테이너 이미지 경량화"
        echo "        Dockerfile: ${dockerfile_count}개 중 경량 베이스: ${alpine_count}개"
        echo "        alpine/distroless 베이스 이미지 전환 권고"
        echo "        예상 절감: 레지스트리 스토리지 50%+, 배포 시간 30%+"
        echo ""
    fi

    # 4-4. Recording Rules 최적화
    local recording_rules=0
    recording_rules=$(find "${PROJECT_ROOT}/infra/monitoring" -name "*recording*" -o -name "*rules*" 2>/dev/null | wc -l || echo "0")
    if [ "${recording_rules}" -gt 10 ]; then
        rec_num=$((rec_num + 1))
        echo -e "  ${YELLOW}[R${rec_num}]${NC} Recording Rules 통합 검토"
        echo "        ${recording_rules}개 규칙 파일 — 중복/미사용 규칙 점검 권고"
        echo "        예상 절감: Prometheus 메모리 10~15% 감소"
        echo ""
    fi

    if [ "${rec_num}" -eq 0 ]; then
        echo -e "  ${GREEN}[OK]${NC} 추가 최적화 권고사항 없음"
        echo ""
    fi

    echo "  총 권고사항: ${rec_num}건"
    echo ""
}

# ============================================================================
# 5. 기술 부채 비용 영향
# Design Ref: MTU-N134 Design §1 섹션 5
# Plan SC: FR-N134.4
# ============================================================================
section_debt() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  5. 기술 부채 비용 영향${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    # TODO/FIXME/HACK 카운트
    local todo_count=0
    todo_count=$(grep -rn "TODO\|FIXME\|HACK\|XXX" \
        --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
        "${PROJECT_ROOT}/platform/" 2>/dev/null | \
        grep -v node_modules | wc -l || echo "0")

    echo -e "  ${BOLD}코드 내 기술 부채 지표:${NC}"
    echo "    - TODO/FIXME/HACK 주석: ${todo_count}건"

    # 대형 파일 (복잡도 부채)
    local large_files=0
    large_files=$(find "${PROJECT_ROOT}/platform" -name "*.ts" -o -name "*.tsx" 2>/dev/null | \
        grep -v node_modules | grep -v dist | \
        xargs wc -l 2>/dev/null | \
        awk '$1 > 500 && !/total/' | wc -l || echo "0")
    echo "    - 500줄 초과 파일: ${large_files}개 (리팩토링 대상)"

    # 미사용 의존성 (package.json 기반)
    local total_deps=0
    total_deps=$(grep -c '"' "${PROJECT_ROOT}/package.json" 2>/dev/null || echo "0")
    echo "    - package.json 총 항목: ${total_deps}줄"
    echo ""

    # 비용 영향 추정
    echo -e "  ${BOLD}비용 영향 추정:${NC}"
    echo "    - TODO/FIXME 해소 시: 유지보수 시간 약 ${todo_count}h 절감 예상"

    local debt_cost
    debt_cost=$(echo "${todo_count} * 50" | bc 2>/dev/null || echo "0")
    echo "    - 인건비 기준 절감: \$${debt_cost:-0} (건당 \$50 추정)"

    if [ "${large_files}" -gt 0 ]; then
        echo "    - 대형 파일 리팩토링: 버그 발생률 30% 감소 예상"
    fi
    echo ""

    echo -e "  ${BOLD}권고 우선순위:${NC}"
    echo "    1순위: 보안 관련 TODO/FIXME 즉시 해소"
    echo "    2순위: 500줄 초과 파일 분리"
    echo "    3순위: 미사용 의존성 정리"
    echo ""
}

# ============================================================================
# 보고서 저장
# ============================================================================
save_report() {
    local report_file="${OUTPUT_DIR}/cost-report-${REPORT_DATE}.md"

    cat > "${report_file}" << REPORT
# 비용 최적화 보고서

> 생성일: ${REPORT_DATE}
> 도구: cost-optimization-report.sh
> Design Ref: MTU-N134

## 보고서 생성 완료

상세 내용은 콘솔 출력을 참조하십시오.
REPORT

    echo -e "${GREEN}보고서 저장: ${report_file}${NC}"
    log_audit "COST_REPORT_GENERATED" "date=${REPORT_DATE},output=${report_file}"
}

# ============================================================================
# 메인 실행
# ============================================================================
main() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  비용 최적화 보고서${NC}"
    echo -e "${CYAN}  날짜: ${REPORT_DATE}${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    if [ -n "${SECTION_FILTER}" ]; then
        case "${SECTION_FILTER}" in
            summary)         section_summary ;;
            tenant)          section_tenant ;;
            efficiency)      section_efficiency ;;
            recommendations) section_recommendations ;;
            debt)            section_debt ;;
            *)               echo "알 수 없는 섹션: ${SECTION_FILTER}"; exit 1 ;;
        esac
    else
        section_summary
        section_tenant
        section_efficiency
        section_recommendations
        section_debt
    fi

    save_report

    echo ""
    echo -e "${GREEN}비용 최적화 보고서 생성 완료${NC}"
}

main "$@"
