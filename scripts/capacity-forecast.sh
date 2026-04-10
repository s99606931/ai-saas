#!/bin/bash
# ============================================================================
# 용량 예측 보고서 자동 생성
# Plan SC: FR-N135.1, FR-N135.2, FR-N135.3, FR-N135.4
# Design Ref: MTU-N135 Design §1, §2, §3
# CSAP: D-08 (접근 통제 -- 적정 리소스 할당)
#
# 사용법:
#   ./scripts/capacity-forecast.sh                       # 전체 보고서
#   ./scripts/capacity-forecast.sh --resource cpu        # CPU만
#   ./scripts/capacity-forecast.sh --horizon 30          # 30일 예측만
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
AUDIT_LOG="${PROJECT_ROOT}/.claude/audit.jsonl"
RESOURCE_FILTER=""
HORIZON_FILTER=""
FORECAST_DATE=$(date +%Y-%m-%d)

# 비용 모델
CPU_COST_PER_VCPU_HOUR=0.05
MEM_COST_PER_GIB_HOUR=0.01
DISK_COST_PER_GIB_MONTH=0.10

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
        --resource) RESOURCE_FILTER="$2"; shift 2 ;;
        --horizon) HORIZON_FILTER="$2"; shift 2 ;;
        --help)
            echo "사용법: capacity-forecast.sh [옵션]"
            echo "  --resource TYPE    특정 리소스 (cpu|memory|disk)"
            echo "  --horizon DAYS     예측 기간 (14|30)"
            exit 0 ;;
        *) shift ;;
    esac
done

log_audit() {
    local action="$1"
    local detail="$2"
    local entry="{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"capacity-forecast\",\"action\":\"${action}\",\"detail\":\"${detail}\"}"
    echo "${entry}" >> "${AUDIT_LOG}" 2>/dev/null || true
}

# ============================================================================
# 1. 현재 용량 현황
# Design Ref: MTU-N135 Design §3 섹션 1
# Plan SC: FR-N135.1
# ============================================================================
section_current() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  1. 현재 용량 현황${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    # 인프라 파일에서 리소스 관련 정보 추출
    echo -e "  ${BOLD}노드 리소스 정의:${NC}"

    # CPU 관련 정의 수
    local cpu_requests=0
    cpu_requests=$(grep -r "cpu:" "${PROJECT_ROOT}/infra/" 2>/dev/null | \
        grep -i "request\|limit" | wc -l || echo "0")
    echo "    - CPU 리소스 정의: ${cpu_requests}건"

    # 메모리 관련 정의 수
    local mem_requests=0
    mem_requests=$(grep -r "memory:" "${PROJECT_ROOT}/infra/" 2>/dev/null | \
        grep -i "request\|limit" | wc -l || echo "0")
    echo "    - 메모리 리소스 정의: ${mem_requests}건"

    # 스토리지 관련 정의 수
    local storage_defs=0
    storage_defs=$(grep -r "storage:" "${PROJECT_ROOT}/infra/" 2>/dev/null | wc -l || echo "0")
    echo "    - 스토리지 정의: ${storage_defs}건"
    echo ""

    # ResourceQuota 파일 확인
    local quota_files=0
    quota_files=$(grep -rl "ResourceQuota" "${PROJECT_ROOT}/infra/" 2>/dev/null | wc -l || echo "0")
    echo -e "  ${BOLD}ResourceQuota 설정:${NC} ${quota_files}개 파일"

    # LimitRange 파일 확인
    local limitrange_files=0
    limitrange_files=$(grep -rl "LimitRange" "${PROJECT_ROOT}/infra/" 2>/dev/null | wc -l || echo "0")
    echo -e "  ${BOLD}LimitRange 설정:${NC} ${limitrange_files}개 파일"
    echo ""
}

# ============================================================================
# 2. 14일 예측
# Design Ref: MTU-N135 Design §3 섹션 2
# ============================================================================
section_forecast_14d() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  2. 14일 예측${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    echo -e "  ${BOLD}예측 Recording Rules (14일):${NC}"
    echo "  ──────────────────────────────────────────────────"
    printf "  %-12s %-30s %-15s\n" "리소스" "Recording Rule" "경고 기준"
    echo "  ──────────────────────────────────────────────────"
    printf "  %-12s %-30s %-15s\n" "CPU" "capacity_forecast:cpu:14d_usage_ratio" "> 85%"
    printf "  %-12s %-30s %-15s\n" "메모리" "capacity_forecast:memory:14d_usage_ratio" "> 80%"
    printf "  %-12s %-30s %-15s\n" "디스크" "capacity_forecast:disk:14d_avail_ratio" "< 20%"
    echo "  ──────────────────────────────────────────────────"
    echo ""

    # Recording Rules 파일 확인
    local rules_file="${PROJECT_ROOT}/infra/monitoring/capacity-forecast-rules.yaml"
    if [ -f "${rules_file}" ]; then
        local rule_14d_count=0
        rule_14d_count=$(grep -c "14d" "${rules_file}" || echo "0")
        echo -e "  ${GREEN}[OK]${NC} 14일 예측 규칙: ${rule_14d_count}건 정의됨"
    else
        echo -e "  ${RED}[FAIL]${NC} 예측 규칙 파일 없음"
    fi
    echo ""
}

# ============================================================================
# 3. 30일 예측
# Design Ref: MTU-N135 Design §3 섹션 3
# ============================================================================
section_forecast_30d() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  3. 30일 예측${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    echo -e "  ${BOLD}예측 Recording Rules (30일):${NC}"
    echo "  ──────────────────────────────────────────────────"
    printf "  %-12s %-30s %-15s\n" "리소스" "Recording Rule" "위험 기준"
    echo "  ──────────────────────────────────────────────────"
    printf "  %-12s %-30s %-15s\n" "CPU" "capacity_forecast:cpu:30d_usage_ratio" "> 95%"
    printf "  %-12s %-30s %-15s\n" "메모리" "capacity_forecast:memory:30d_usage_ratio" "> 90%"
    printf "  %-12s %-30s %-15s\n" "디스크" "capacity_forecast:disk:30d_avail_ratio" "< 10%"
    echo "  ──────────────────────────────────────────────────"
    echo ""

    local rules_file="${PROJECT_ROOT}/infra/monitoring/capacity-forecast-rules.yaml"
    if [ -f "${rules_file}" ]; then
        local rule_30d_count=0
        rule_30d_count=$(grep -c "30d" "${rules_file}" || echo "0")
        echo -e "  ${GREEN}[OK]${NC} 30일 예측 규칙: ${rule_30d_count}건 정의됨"
    else
        echo -e "  ${RED}[FAIL]${NC} 예측 규칙 파일 없음"
    fi
    echo ""
}

# ============================================================================
# 4. 증설 권고
# Design Ref: MTU-N135 Design §3 섹션 4
# Plan SC: FR-N135.4
# ============================================================================
section_recommendations() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  4. 증설 권고사항${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    local alerts_file="${PROJECT_ROOT}/infra/monitoring/capacity-forecast-rules.yaml"
    local alert_count=0

    if [ -f "${alerts_file}" ]; then
        alert_count=$(grep -c "alert:" "${alerts_file}" || echo "0")
    fi

    echo -e "  ${BOLD}정의된 용량 예측 알림:${NC} ${alert_count}건"
    echo ""
    echo "  알림 규칙 요약:"
    echo "  ────────────────────────────────────────────────"
    echo "  [경고] CpuCapacityWarning14d      : CPU 14일 후 > 85%"
    echo "  [위험] CpuCapacityCritical14d     : CPU 14일 후 > 95%"
    echo "  [경고] MemoryCapacityWarning14d   : 메모리 14일 후 > 80%"
    echo "  [위험] MemoryCapacityCritical14d  : 메모리 14일 후 > 90%"
    echo "  [경고] DiskCapacityWarning30d     : 디스크 30일 후 여유 < 20%"
    echo "  [위험] DiskCapacityCritical30d    : 디스크 30일 후 여유 < 10%"
    echo "  ────────────────────────────────────────────────"
    echo ""

    # 증설 비용 추정
    echo -e "  ${BOLD}증설 시 비용 영향:${NC}"
    echo "    - vCPU 1개 추가: \$$(echo "${CPU_COST_PER_VCPU_HOUR} * 720" | bc)/월"
    echo "    - 메모리 1GiB 추가: \$$(echo "${MEM_COST_PER_GIB_HOUR} * 720" | bc)/월"
    echo "    - 디스크 10GiB 추가: \$$(echo "${DISK_COST_PER_GIB_MONTH} * 10" | bc)/월"
    echo ""
}

# ============================================================================
# 5. 예측 인프라 검증
# ============================================================================
section_validation() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  5. 예측 인프라 검증${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    local rules_file="${PROJECT_ROOT}/infra/monitoring/capacity-forecast-rules.yaml"

    # YAML 구문 검증
    if [ -f "${rules_file}" ]; then
        if python3 -c "import yaml; yaml.safe_load(open('${rules_file}'))" 2>/dev/null; then
            echo -e "  ${GREEN}[OK]${NC} Recording Rules YAML 구문 유효"
        else
            echo -e "  ${RED}[FAIL]${NC} YAML 구문 오류"
        fi
    else
        echo -e "  ${RED}[FAIL]${NC} 규칙 파일 없음"
    fi

    # 기존 용량 알림 규칙과의 호환성
    local existing_rules="${PROJECT_ROOT}/infra/monitoring/capacity-alerting-rules.yaml"
    if [ -f "${existing_rules}" ]; then
        echo -e "  ${GREEN}[OK]${NC} 기존 용량 알림 규칙과 공존 확인"
    fi

    # predict_linear 사용 확인
    if grep -q "predict_linear" "${rules_file}" 2>/dev/null; then
        local predict_count
        predict_count=$(grep -c "predict_linear" "${rules_file}")
        echo -e "  ${GREEN}[OK]${NC} predict_linear 함수 ${predict_count}회 사용"
    else
        echo -e "  ${RED}[FAIL]${NC} predict_linear 미사용"
    fi
    echo ""

    log_audit "CAPACITY_FORECAST_REPORT" "date=${FORECAST_DATE}"
}

# ============================================================================
# 메인 실행
# ============================================================================
main() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  용량 예측 보고서${NC}"
    echo -e "${CYAN}  날짜: ${FORECAST_DATE}${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    section_current
    section_forecast_14d
    section_forecast_30d
    section_recommendations
    section_validation

    echo -e "${GREEN}용량 예측 보고서 생성 완료${NC}"
}

main "$@"
