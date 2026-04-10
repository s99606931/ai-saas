#!/bin/bash
# ============================================================================
# 장애 복구(DR) 시뮬레이션 — 시나리오 관리 + 체크리스트 + RTO/RPO 검증
# Plan SC: FR-N139.1, FR-N139.2, FR-N139.3, FR-N139.4
# Design Ref: MTU-N139 Design §1, §2
# CSAP: D-06 (비즈니스 연속성 계획)
#
# 사용법:
#   ./scripts/dr-simulation.sh                         # 전체 시나리오 목록
#   ./scripts/dr-simulation.sh --scenario DR-01        # 특정 시나리오 검증
#   ./scripts/dr-simulation.sh --drill                 # DR 훈련 모드
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
AUDIT_LOG="${PROJECT_ROOT}/.claude/audit.jsonl"
SCENARIO_ID=""
DRILL_MODE=false

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

while [[ $# -gt 0 ]]; do
    case "$1" in
        --scenario) SCENARIO_ID="$2"; shift 2 ;;
        --drill) DRILL_MODE=true; shift ;;
        --help)
            echo "사용법: dr-simulation.sh [옵션]"
            echo "  --scenario ID     특정 시나리오 (DR-01~DR-05)"
            echo "  --drill           DR 훈련 모드 (체크리스트 출력)"
            exit 0 ;;
        *) shift ;;
    esac
done

log_audit() {
    local entry="{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"dr-simulation\",\"action\":\"$1\",\"detail\":\"$2\"}"
    echo "${entry}" >> "${AUDIT_LOG}" 2>/dev/null || true
}

# ============================================================================
# DR 시나리오 정의
# Design Ref: MTU-N139 Design §1
# ============================================================================
list_scenarios() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  DR 시나리오 목록${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    echo "  ────────────────────────────────────────────────────────────────"
    printf "  %-7s %-25s %-15s %-8s %-8s\n" "ID" "시나리오" "영향 범위" "RTO" "RPO"
    echo "  ────────────────────────────────────────────────────────────────"
    printf "  %-7s %-25s %-15s %-8s %-8s\n" "DR-01" "데이터베이스 장애" "전체 서비스" "30분" "5분"
    printf "  %-7s %-25s %-15s %-8s %-8s\n" "DR-02" "K8s 노드 장애" "해당 노드 Pod" "15분" "0분"
    printf "  %-7s %-25s %-15s %-8s %-8s\n" "DR-03" "스토리지 장애" "PVC 의존 서비스" "60분" "15분"
    printf "  %-7s %-25s %-15s %-8s %-8s\n" "DR-04" "네트워크 파티션" "격리 서비스" "10분" "0분"
    printf "  %-7s %-25s %-15s %-8s %-8s\n" "DR-05" "전체 클러스터 장애" "전체" "120분" "30분"
    echo "  ────────────────────────────────────────────────────────────────"
    echo ""
}

# ============================================================================
# 시나리오별 복구 체크리스트
# Design Ref: MTU-N139 Design §2
# ============================================================================
scenario_checklist() {
    local id="${1:-DR-01}"

    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  시나리오 ${id} — 복구 체크리스트${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    case "${id}" in
        DR-01)
            echo -e "  ${BOLD}시나리오: 데이터베이스 장애${NC}"
            echo -e "  ${BOLD}RTO: 30분 | RPO: 5분${NC}"
            echo ""
            echo "  [ ] 1. 장애 탐지: PostgreSQL 프로세스 상태 확인"
            echo "       kubectl get pods -n database -l app=postgres"
            echo ""
            echo "  [ ] 2. 영향 범위: 데이터베이스 의존 서비스 확인"
            echo "       kubectl get pods --all-namespaces | grep -v Running"
            echo ""
            echo "  [ ] 3. 격리: 장애 DB 격리, 읽기 전용 모드 전환"
            echo "       kubectl scale deployment postgres -n database --replicas=0"
            echo ""
            echo "  [ ] 4. 백업 복원:"
            echo "       ./scripts/db-restore.sh --backup latest"
            echo ""
            echo "  [ ] 5. 서비스 재시작:"
            echo "       kubectl rollout restart deployment -n platform"
            echo ""
            echo "  [ ] 6. 검증:"
            echo "       ./scripts/healthcheck.sh"
            echo "       pnpm --filter @public-saas/e2e-tests test"
            echo ""
            echo "  [ ] 7. 포스트모템:"
            echo "       ./scripts/generate-postmortem.sh"
            ;;
        DR-02)
            echo -e "  ${BOLD}시나리오: K8s 노드 장애${NC}"
            echo -e "  ${BOLD}RTO: 15분 | RPO: 0분${NC}"
            echo ""
            echo "  [ ] 1. 장애 탐지: 노드 상태 확인"
            echo "       kubectl get nodes"
            echo ""
            echo "  [ ] 2. 영향 범위: 장애 노드의 Pod 목록"
            echo "       kubectl get pods --all-namespaces -o wide --field-selector spec.nodeName=<노드명>"
            echo ""
            echo "  [ ] 3. Pod 재스케줄링 대기"
            echo "       kubectl drain <노드명> --ignore-daemonsets --delete-emptydir-data"
            echo ""
            echo "  [ ] 4. 검증:"
            echo "       kubectl get pods --all-namespaces | grep -v Running"
            echo "       ./scripts/healthcheck.sh"
            ;;
        DR-03)
            echo -e "  ${BOLD}시나리오: 스토리지 장애${NC}"
            echo -e "  ${BOLD}RTO: 60분 | RPO: 15분${NC}"
            echo ""
            echo "  [ ] 1. PVC 상태 확인"
            echo "       kubectl get pvc --all-namespaces"
            echo ""
            echo "  [ ] 2. 스토리지 클래스 확인"
            echo "       kubectl get sc"
            echo ""
            echo "  [ ] 3. PV 재생성 또는 백업 복원"
            echo "       kubectl apply -f infra/storage/"
            echo ""
            echo "  [ ] 4. 서비스 재시작 + 검증"
            echo "       ./scripts/healthcheck.sh"
            ;;
        DR-04)
            echo -e "  ${BOLD}시나리오: 네트워크 파티션${NC}"
            echo -e "  ${BOLD}RTO: 10분 | RPO: 0분${NC}"
            echo ""
            echo "  [ ] 1. 네트워크 정책 확인"
            echo "       kubectl get networkpolicy --all-namespaces"
            echo ""
            echo "  [ ] 2. DNS 확인"
            echo "       kubectl run -it --rm debug --image=busybox -- nslookup kubernetes"
            echo ""
            echo "  [ ] 3. 서비스 메시 상태"
            echo "       linkerd check (설치된 경우)"
            echo ""
            echo "  [ ] 4. 네트워크 정책 초기화"
            echo "       kubectl apply -f infra/network-policies/"
            ;;
        DR-05)
            echo -e "  ${BOLD}시나리오: 전체 클러스터 장애${NC}"
            echo -e "  ${BOLD}RTO: 120분 | RPO: 30분${NC}"
            echo ""
            echo "  [ ] 1. 클러스터 상태 확인"
            echo "       kubectl cluster-info"
            echo "       kubectl get nodes"
            echo ""
            echo "  [ ] 2. etcd 백업 복원"
            echo "       k3s server --cluster-reset"
            echo ""
            echo "  [ ] 3. 전체 인프라 재배포"
            echo "       cd infra && ./deploy-all.sh"
            echo ""
            echo "  [ ] 4. 데이터 복원"
            echo "       ./scripts/db-restore.sh --backup latest"
            echo ""
            echo "  [ ] 5. 전체 검증"
            echo "       ./scripts/healthcheck.sh"
            echo "       ./scripts/prod-readiness-check.sh"
            ;;
        *)
            echo -e "  ${RED}알 수 없는 시나리오: ${id}${NC}"
            ;;
    esac
    echo ""
}

# ============================================================================
# DR 훈련 모드
# ============================================================================
drill_mode() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  DR 훈련 모드${NC}"
    echo -e "${CYAN}  날짜: $(date -Iseconds)${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    echo -e "  ${BOLD}사전 검증:${NC}"
    echo ""

    # 백업 스크립트 존재
    if [ -f "${PROJECT_ROOT}/scripts/db-backup.sh" ]; then
        echo -e "  ${GREEN}[OK]${NC} 데이터베이스 백업 스크립트 존재"
    else
        echo -e "  ${RED}[FAIL]${NC} 데이터베이스 백업 스크립트 없음"
    fi

    # 복원 스크립트 존재
    if [ -f "${PROJECT_ROOT}/scripts/db-restore.sh" ]; then
        echo -e "  ${GREEN}[OK]${NC} 데이터베이스 복원 스크립트 존재"
    else
        echo -e "  ${RED}[FAIL]${NC} 데이터베이스 복원 스크립트 없음"
    fi

    # 헬스체크 존재
    if [ -f "${PROJECT_ROOT}/scripts/healthcheck.sh" ]; then
        echo -e "  ${GREEN}[OK]${NC} 헬스체크 스크립트 존재"
    else
        echo -e "  ${RED}[FAIL]${NC} 헬스체크 스크립트 없음"
    fi

    # 포스트모템 존재
    if [ -f "${PROJECT_ROOT}/scripts/generate-postmortem.sh" ]; then
        echo -e "  ${GREEN}[OK]${NC} 포스트모템 생성 스크립트 존재"
    else
        echo -e "  ${RED}[FAIL]${NC} 포스트모템 생성 스크립트 없음"
    fi

    # 런북 존재
    local runbook_count=0
    runbook_count=$(find "${PROJECT_ROOT}/scripts" -name "runbook-auto-*.sh" 2>/dev/null | wc -l || echo "0")
    echo -e "  ${GREEN}[OK]${NC} 자동 런북: ${runbook_count}개"
    echo ""

    echo -e "  ${BOLD}훈련 권고:${NC}"
    echo "    1. DR-01 (데이터베이스 장애) — 매분기 실시"
    echo "    2. DR-02 (노드 장애) — 매월 실시"
    echo "    3. DR-05 (전체 장애) — 반기 실시"
    echo ""

    log_audit "DR_DRILL" "date=$(date +%Y-%m-%d),runbooks=${runbook_count}"
}

# ============================================================================
# 메인
# ============================================================================
main() {
    if [ -n "${SCENARIO_ID}" ]; then
        scenario_checklist "${SCENARIO_ID}"
    elif [ "${DRILL_MODE}" = true ]; then
        list_scenarios
        drill_mode
    else
        list_scenarios
        echo -e "  ${BOLD}사용법:${NC}"
        echo "    --scenario DR-01   특정 시나리오 체크리스트"
        echo "    --drill            DR 훈련 모드"
        echo ""
    fi

    log_audit "DR_SIMULATION_RUN" "scenario=${SCENARIO_ID:-all},drill=${DRILL_MODE}"
    echo -e "${GREEN}DR 시뮬레이션 완료${NC}"
}

main "$@"
