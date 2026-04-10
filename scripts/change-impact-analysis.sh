#!/bin/bash
# ============================================================================
# 변경 관리 — 영향 분석 + 롤백 계획 자동 생성
# Plan SC: FR-N136.1, FR-N136.2, FR-N136.3, FR-N136.4
# Design Ref: MTU-N136 Design §1
# CSAP: D-12 (시스템 개발 보안 — 변경 관리)
#
# 사용법:
#   ./scripts/change-impact-analysis.sh                     # 현재 변경 분석
#   ./scripts/change-impact-analysis.sh --base main         # main 대비 분석
#   ./scripts/change-impact-analysis.sh --commit abc123     # 특정 커밋 분석
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
AUDIT_LOG="${PROJECT_ROOT}/.claude/audit.jsonl"
BASE_BRANCH="main"
SPECIFIC_COMMIT=""

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# 카운터
INFRA_FILES=0
SECURITY_FILES=0
DB_FILES=0
SERVICE_FILES=0
LIB_FILES=0
CICD_FILES=0
DOC_FILES=0
CONFIG_FILES=0
TEST_FILES=0
OTHER_FILES=0

# ============================================================================
# 인수 파싱
# ============================================================================
while [[ $# -gt 0 ]]; do
    case "$1" in
        --base) BASE_BRANCH="$2"; shift 2 ;;
        --commit) SPECIFIC_COMMIT="$2"; shift 2 ;;
        --help)
            echo "사용법: change-impact-analysis.sh [옵션]"
            echo "  --base BRANCH     비교 대상 브랜치 (기본: main)"
            echo "  --commit HASH     특정 커밋 분석"
            exit 0 ;;
        *) shift ;;
    esac
done

log_audit() {
    local action="$1"
    local detail="$2"
    local entry="{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"change-impact-analysis\",\"action\":\"${action}\",\"detail\":\"${detail}\"}"
    echo "${entry}" >> "${AUDIT_LOG}" 2>/dev/null || true
}

# ============================================================================
# 변경 파일 수집
# ============================================================================
get_changed_files() {
    local files=""
    if [ -n "${SPECIFIC_COMMIT}" ]; then
        files=$(cd "${PROJECT_ROOT}" && git diff-tree --no-commit-id --name-only -r "${SPECIFIC_COMMIT}" 2>/dev/null || echo "")
    else
        # 현재 브랜치와 base 브랜치 비교
        files=$(cd "${PROJECT_ROOT}" && git diff --name-only "${BASE_BRANCH}" 2>/dev/null || \
                cd "${PROJECT_ROOT}" && git diff --name-only HEAD~1 2>/dev/null || echo "")
    fi
    echo "${files}"
}

# ============================================================================
# 1. 변경 파일 카테고리 분류
# Design Ref: MTU-N136 Design §1.1
# Plan SC: FR-N136.1
# ============================================================================
categorize_changes() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  1. 변경 파일 카테고리 분류${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    local files
    files=$(get_changed_files)
    local total_files=0

    if [ -z "${files}" ]; then
        echo -e "  ${YELLOW}변경 파일 없음 (또는 git 비교 불가)${NC}"
        # 데모 모드: 현재 수정 파일 사용
        files=$(cd "${PROJECT_ROOT}" && git status --porcelain 2>/dev/null | awk '{print $2}' || echo "")
    fi

    while IFS= read -r file; do
        [ -z "${file}" ] && continue
        total_files=$((total_files + 1))

        case "${file}" in
            infra/*)
                INFRA_FILES=$((INFRA_FILES + 1)) ;;
            *security*|*auth*|*rbac*|*crypto*)
                SECURITY_FILES=$((SECURITY_FILES + 1)) ;;
            *migration*|*schema*|*prisma*)
                DB_FILES=$((DB_FILES + 1)) ;;
            platform/services/*)
                SERVICE_FILES=$((SERVICE_FILES + 1)) ;;
            platform/packages/*)
                LIB_FILES=$((LIB_FILES + 1)) ;;
            .gitea/workflows/*|.github/workflows/*)
                CICD_FILES=$((CICD_FILES + 1)) ;;
            docs/*)
                DOC_FILES=$((DOC_FILES + 1)) ;;
            *.test.*|*.spec.*|*__tests__*)
                TEST_FILES=$((TEST_FILES + 1)) ;;
            *.yaml|*.yml|*.json)
                CONFIG_FILES=$((CONFIG_FILES + 1)) ;;
            *)
                OTHER_FILES=$((OTHER_FILES + 1)) ;;
        esac
    done <<< "${files}"

    echo -e "  ${BOLD}변경 파일 총 ${total_files}개:${NC}"
    echo "  ────────────────────────────────────"
    printf "  %-20s %5d개  (가중치: x3)\n" "인프라" "${INFRA_FILES}"
    printf "  %-20s %5d개  (가중치: x4)\n" "보안" "${SECURITY_FILES}"
    printf "  %-20s %5d개  (가중치: x4)\n" "데이터베이스" "${DB_FILES}"
    printf "  %-20s %5d개  (가중치: x2)\n" "서비스 코드" "${SERVICE_FILES}"
    printf "  %-20s %5d개  (가중치: x2)\n" "라이브러리" "${LIB_FILES}"
    printf "  %-20s %5d개  (가중치: x3)\n" "CI/CD" "${CICD_FILES}"
    printf "  %-20s %5d개  (가중치: x1)\n" "문서" "${DOC_FILES}"
    printf "  %-20s %5d개  (가중치: x3)\n" "설정" "${CONFIG_FILES}"
    printf "  %-20s %5d개  (가중치: x1)\n" "테스트" "${TEST_FILES}"
    printf "  %-20s %5d개  (가중치: x1)\n" "기타" "${OTHER_FILES}"
    echo ""
}

# ============================================================================
# 2. 영향 받는 서비스 식별
# Design Ref: MTU-N136 Design §1.1
# Plan SC: FR-N136.2
# ============================================================================
identify_affected_services() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  2. 영향 받는 서비스/인프라${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    local files
    files=$(get_changed_files)
    if [ -z "${files}" ]; then
        files=$(cd "${PROJECT_ROOT}" && git status --porcelain 2>/dev/null | awk '{print $2}' || echo "")
    fi

    local affected_services=""

    while IFS= read -r file; do
        [ -z "${file}" ] && continue
        case "${file}" in
            platform/services/*)
                local svc
                svc=$(echo "${file}" | cut -d/ -f3)
                if ! echo "${affected_services}" | grep -q "${svc}"; then
                    affected_services="${affected_services} ${svc}"
                fi
                ;;
        esac
    done <<< "${files}"

    if [ -n "${affected_services}" ]; then
        echo -e "  ${BOLD}영향 받는 서비스:${NC}"
        for svc in ${affected_services}; do
            echo -e "    ${YELLOW}>>>${NC} ${svc}"
        done
    else
        echo -e "  ${GREEN}직접 영향 받는 서비스 없음${NC}"
    fi

    if [ "${INFRA_FILES}" -gt 0 ]; then
        echo -e "  ${YELLOW}[주의]${NC} 인프라 변경 ${INFRA_FILES}건 — 전체 서비스 영향 가능"
    fi
    if [ "${DB_FILES}" -gt 0 ]; then
        echo -e "  ${RED}[경고]${NC} 데이터베이스 변경 ${DB_FILES}건 — 데이터 손실 위험"
    fi
    echo ""
}

# ============================================================================
# 3. 위험도 평가
# Design Ref: MTU-N136 Design §1.2
# Plan SC: FR-N136.4
# ============================================================================
assess_risk() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  3. 위험도 평가${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    # 위험 점수 계산 -- Design Ref: §1.2
    local risk_score=0
    risk_score=$((
        INFRA_FILES * 3 +
        SECURITY_FILES * 4 +
        DB_FILES * 4 +
        SERVICE_FILES * 2 +
        LIB_FILES * 2 +
        CICD_FILES * 3 +
        CONFIG_FILES * 3 +
        DOC_FILES * 1 +
        TEST_FILES * 1 +
        OTHER_FILES * 1
    ))

    local risk_level="LOW"
    local risk_color="${GREEN}"

    if [ "${risk_score}" -ge 50 ]; then
        risk_level="CRITICAL"
        risk_color="${RED}"
    elif [ "${risk_score}" -ge 30 ]; then
        risk_level="HIGH"
        risk_color="${RED}"
    elif [ "${risk_score}" -ge 15 ]; then
        risk_level="MEDIUM"
        risk_color="${YELLOW}"
    fi

    echo -e "  ${BOLD}위험 점수:${NC} ${risk_score}"
    echo -e "  ${BOLD}위험 등급:${NC} ${risk_color}${risk_level}${NC}"
    echo ""
    echo "  점수 기준:"
    echo "    < 15  : LOW      (문서/테스트 위주)"
    echo "    15~29 : MEDIUM   (서비스 코드 변경)"
    echo "    30~49 : HIGH     (인프라/CI 변경)"
    echo "    >= 50 : CRITICAL (보안/DB 변경)"
    echo ""

    if [ "${risk_level}" = "CRITICAL" ] || [ "${risk_level}" = "HIGH" ]; then
        echo -e "  ${RED}[경고]${NC} 변경 관리 위원회 승인 권고"
        echo -e "  ${RED}[경고]${NC} 배포 전 스테이징 환경 검증 필수"
    fi
    echo ""
}

# ============================================================================
# 4. 롤백 계획 자동 생성
# Design Ref: MTU-N136 Design §1.3
# Plan SC: FR-N136.3
# ============================================================================
generate_rollback_plan() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  4. 롤백 계획${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    local current_commit
    current_commit=$(cd "${PROJECT_ROOT}" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    local prev_commit
    prev_commit=$(cd "${PROJECT_ROOT}" && git rev-parse --short HEAD~1 2>/dev/null || echo "unknown")

    echo -e "  ${BOLD}현재 커밋:${NC} ${current_commit}"
    echo -e "  ${BOLD}이전 커밋:${NC} ${prev_commit}"
    echo ""

    echo -e "  ${BOLD}롤백 절차:${NC}"
    echo ""

    # Git 롤백
    echo "  [1단계] Git 롤백:"
    echo "    git revert ${current_commit}"
    echo "    # 또는 전체 브랜치 롤백:"
    echo "    git reset --soft ${prev_commit}"
    echo ""

    # Helm 롤백 (인프라 변경 시)
    if [ "${INFRA_FILES}" -gt 0 ]; then
        echo "  [2단계] Helm 롤백 (인프라 변경 포함):"
        echo "    helm list -A                              # 현재 릴리스 확인"
        echo "    helm history <릴리스명> -n <네임스페이스>    # 리비전 히스토리"
        echo "    helm rollback <릴리스명> <이전-리비전>       # 롤백 실행"
        echo ""
    fi

    # K8s 롤백 (서비스 변경 시)
    if [ "${SERVICE_FILES}" -gt 0 ]; then
        echo "  [3단계] K8s Deployment 롤백:"
        echo "    kubectl rollout history deployment/<이름> -n <네임스페이스>"
        echo "    kubectl rollout undo deployment/<이름> -n <네임스페이스>"
        echo ""
    fi

    # DB 롤백 (마이그레이션 변경 시)
    if [ "${DB_FILES}" -gt 0 ]; then
        echo "  [4단계] 데이터베이스 롤백 (!!주의!!):"
        echo "    # 마이그레이션 다운:"
        echo "    npx prisma migrate resolve --rolled-back <migration-name>"
        echo "    # 또는 백업에서 복원:"
        echo "    ./scripts/db-restore.sh --backup <백업-파일>"
        echo ""
    fi

    echo -e "  ${BOLD}검증 절차:${NC}"
    echo "    1. 서비스 헬스체크: ./scripts/healthcheck.sh"
    echo "    2. E2E 테스트: pnpm --filter @public-saas/e2e-tests test"
    echo "    3. 모니터링 확인: Grafana 운영 대시보드"
    echo ""

    log_audit "CHANGE_IMPACT_ANALYSIS" "commit=${current_commit},infra=${INFRA_FILES},security=${SECURITY_FILES},db=${DB_FILES},service=${SERVICE_FILES}"
}

# ============================================================================
# 메인 실행
# ============================================================================
main() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  변경 관리 — 영향 분석 보고서${NC}"
    echo -e "${CYAN}  날짜: $(date -Iseconds)${NC}"
    echo -e "${CYAN}  비교: ${BASE_BRANCH}${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    categorize_changes
    identify_affected_services
    assess_risk
    generate_rollback_plan

    echo -e "${GREEN}변경 영향 분석 완료${NC}"
}

main "$@"
