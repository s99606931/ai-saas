#!/bin/bash
# ============================================================================
# 운영 런북 통합 인덱스 — 탐색 + 분류 + 알림 매핑 + 추천
# Plan SC: FR-N137.1, FR-N137.2, FR-N137.3, FR-N137.4
# Design Ref: MTU-N137 Design §1
# CSAP: D-06 (인시던트 대응 체계)
#
# 사용법:
#   ./scripts/runbook-index.sh                   # 전체 인덱스
#   ./scripts/runbook-index.sh --alert OOMKilled  # 알림 기반 런북 추천
#   ./scripts/runbook-index.sh --category compute # 카테고리별 조회
#   ./scripts/runbook-index.sh --verify           # 런북 상태 검증
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
AUDIT_LOG="${PROJECT_ROOT}/.claude/audit.jsonl"
ALERT_QUERY=""
CATEGORY_FILTER=""
VERIFY_MODE=false

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
        --alert) ALERT_QUERY="$2"; shift 2 ;;
        --category) CATEGORY_FILTER="$2"; shift 2 ;;
        --verify) VERIFY_MODE=true; shift ;;
        --help)
            echo "사용법: runbook-index.sh [옵션]"
            echo "  --alert NAME      알림명으로 런북 추천"
            echo "  --category CAT    카테고리별 조회 (compute|storage|network|security)"
            echo "  --verify          런북 상태 검증"
            exit 0 ;;
        *) shift ;;
    esac
done

log_audit() {
    local action="$1"
    local detail="$2"
    local entry="{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"runbook-index\",\"action\":\"${action}\",\"detail\":\"${detail}\"}"
    echo "${entry}" >> "${AUDIT_LOG}" 2>/dev/null || true
}

# ============================================================================
# 알림-런북 매핑 테이블
# Design Ref: MTU-N137 Design §1.2
# ============================================================================
declare -A ALERT_RUNBOOK_MAP
ALERT_RUNBOOK_MAP[CrashLoop]="runbook-auto-crashloop.sh"
ALERT_RUNBOOK_MAP[CrashLoopBackOff]="runbook-auto-crashloop.sh"
ALERT_RUNBOOK_MAP[DiskPressure]="runbook-auto-disk-cleanup.sh"
ALERT_RUNBOOK_MAP[DiskUsage]="runbook-auto-disk-cleanup.sh"
ALERT_RUNBOOK_MAP[DiskSpace]="runbook-auto-disk-cleanup.sh"
ALERT_RUNBOOK_MAP[HighLatency]="runbook-auto-high-latency.sh"
ALERT_RUNBOOK_MAP[SlowResponse]="runbook-auto-high-latency.sh"
ALERT_RUNBOOK_MAP[LatencyHigh]="runbook-auto-high-latency.sh"
ALERT_RUNBOOK_MAP[OOMKilled]="runbook-auto-oom.sh"
ALERT_RUNBOOK_MAP[MemoryPressure]="runbook-auto-oom.sh"
ALERT_RUNBOOK_MAP[MemoryHigh]="runbook-auto-oom.sh"

# 카테고리 매핑
# Design Ref: MTU-N137 Design §1.3
declare -A RUNBOOK_CATEGORY
RUNBOOK_CATEGORY[runbook-auto-crashloop.sh]="compute"
RUNBOOK_CATEGORY[runbook-auto-disk-cleanup.sh]="storage"
RUNBOOK_CATEGORY[runbook-auto-high-latency.sh]="network"
RUNBOOK_CATEGORY[runbook-auto-oom.sh]="compute"
RUNBOOK_CATEGORY[runbook-lib.sh]="library"

# ============================================================================
# 1. 런북 전체 인덱스
# Plan SC: FR-N137.1
# ============================================================================
list_runbooks() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  운영 런북 통합 인덱스${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    local runbook_count=0
    local auto_count=0

    echo -e "  ${BOLD}런북 목록:${NC}"
    echo "  ──────────────────────────────────────────────────────────────"
    printf "  %-35s %-12s %-10s\n" "런북" "카테고리" "상태"
    echo "  ──────────────────────────────────────────────────────────────"

    for runbook in "${SCRIPT_DIR}"/runbook-*.sh; do
        [ -f "${runbook}" ] || continue
        local basename
        basename=$(basename "${runbook}")
        runbook_count=$((runbook_count + 1))

        local category="${RUNBOOK_CATEGORY[${basename}]:-etc}"
        local status="OK"

        if [ -x "${runbook}" ]; then
            status="실행가능"
        else
            status="권한없음"
        fi

        if [[ "${basename}" == runbook-auto-* ]]; then
            auto_count=$((auto_count + 1))
        fi

        # 카테고리 필터 적용
        if [ -n "${CATEGORY_FILTER}" ] && [ "${category}" != "${CATEGORY_FILTER}" ]; then
            continue
        fi

        printf "  %-35s %-12s %-10s\n" "${basename}" "${category}" "${status}"
    done

    echo "  ──────────────────────────────────────────────────────────────"
    echo ""
    echo -e "  총 런북: ${runbook_count}개 (자동화: ${auto_count}개)"
    echo ""
}

# ============================================================================
# 2. 알림 기반 런북 추천
# Plan SC: FR-N137.2
# ============================================================================
recommend_runbook() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  알림 기반 런북 추천${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    if [ -z "${ALERT_QUERY}" ]; then
        echo -e "  ${BOLD}알림-런북 매핑 테이블:${NC}"
        echo "  ────────────────────────────────────────────────"
        printf "  %-25s → %-30s\n" "알림 패턴" "추천 런북"
        echo "  ────────────────────────────────────────────────"
        printf "  %-25s → %-30s\n" "CrashLoop*" "runbook-auto-crashloop.sh"
        printf "  %-25s → %-30s\n" "DiskPressure/DiskUsage" "runbook-auto-disk-cleanup.sh"
        printf "  %-25s → %-30s\n" "HighLatency/SlowResponse" "runbook-auto-high-latency.sh"
        printf "  %-25s → %-30s\n" "OOMKilled/MemoryPressure" "runbook-auto-oom.sh"
        echo "  ────────────────────────────────────────────────"
        echo ""
        return
    fi

    echo -e "  ${BOLD}검색 알림:${NC} ${ALERT_QUERY}"
    echo ""

    local found=false
    for pattern in "${!ALERT_RUNBOOK_MAP[@]}"; do
        if echo "${ALERT_QUERY}" | grep -iq "${pattern}"; then
            local runbook="${ALERT_RUNBOOK_MAP[${pattern}]}"
            echo -e "  ${GREEN}[추천]${NC} ${runbook}"

            # 런북 설명 추출
            if [ -f "${SCRIPT_DIR}/${runbook}" ]; then
                local desc
                desc=$(head -5 "${SCRIPT_DIR}/${runbook}" | grep "^#" | head -1 | sed 's/^# *//')
                echo "          설명: ${desc}"
                echo "          실행: ./scripts/${runbook}"
            fi
            found=true
            break
        fi
    done

    if [ "${found}" = false ]; then
        echo -e "  ${YELLOW}[미매핑]${NC} '${ALERT_QUERY}'에 매핑된 런북 없음"
        echo "          일반 트러블슈팅 절차를 따르십시오."
    fi
    echo ""

    log_audit "RUNBOOK_RECOMMEND" "alert=${ALERT_QUERY},found=${found}"
}

# ============================================================================
# 3. 런북 상태 검증
# Plan SC: FR-N137.4
# ============================================================================
verify_runbooks() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  런북 상태 검증${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    local total=0
    local ok=0
    local issues=0

    for runbook in "${SCRIPT_DIR}"/runbook-*.sh; do
        [ -f "${runbook}" ] || continue
        local basename
        basename=$(basename "${runbook}")
        total=$((total + 1))

        local status_text=""

        # 실행 권한 확인
        if [ -x "${runbook}" ]; then
            status_text="${GREEN}[OK]${NC}"
            ok=$((ok + 1))
        else
            status_text="${RED}[실행불가]${NC}"
            issues=$((issues + 1))
        fi

        # bash 구문 검증
        if bash -n "${runbook}" 2>/dev/null; then
            status_text="${status_text} ${GREEN}구문OK${NC}"
        else
            status_text="${status_text} ${RED}구문오류${NC}"
            issues=$((issues + 1))
        fi

        echo -e "  ${status_text} ${basename}"
    done

    echo ""
    echo -e "  총: ${total}개 | 정상: ${ok}개 | 이슈: ${issues}건"
    echo ""

    log_audit "RUNBOOK_VERIFY" "total=${total},ok=${ok},issues=${issues}"
}

# ============================================================================
# 메인 실행
# ============================================================================
main() {
    if [ -n "${ALERT_QUERY}" ]; then
        recommend_runbook
    elif [ "${VERIFY_MODE}" = true ]; then
        verify_runbooks
    else
        list_runbooks
        recommend_runbook
    fi

    echo -e "${GREEN}런북 인덱스 조회 완료${NC}"
}

main "$@"
