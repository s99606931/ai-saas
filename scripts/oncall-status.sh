#!/usr/bin/env bash
# =============================================================================
# 온콜 현황 조회 스크립트
# Design Ref: MTU-N122 Design SS1
# Plan SC: FR-N122.5
# CSAP: D-06(침해사고 관리 -- 온콜 현황 조회)
#
# 사용법:
#   ./scripts/oncall-status.sh              # 현재 온콜 현황 조회
#   ./scripts/oncall-status.sh --team sre   # 특정 팀 온콜 조회
#   ./scripts/oncall-status.sh --next       # 다음 주 온콜 예정자
#   ./scripts/oncall-status.sh --rotate     # 로테이션 실행 (교대)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCHEDULE_FILE="$PROJECT_ROOT/infra/monitoring/oncall-schedule.yaml"
AUDIT_LOG="$PROJECT_ROOT/.claude/audit.jsonl"

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

ACTION="status"
TEAM_FILTER=""

log_info() { echo -e "${BLUE}[INFO]${NC} $(date '+%H:%M:%S') $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $(date '+%H:%M:%S') $1"; }

log_audit() {
  local action="$1"
  local detail="$2"
  local entry="{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"oncall-manager\",\"action\":\"$action\",\"detail\":\"$detail\"}"
  echo "$entry" >> "$AUDIT_LOG" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# 사용법
# ---------------------------------------------------------------------------
usage() {
  cat <<'USAGE'
사용법: oncall-status.sh [옵션]

옵션:
  --team TEAM     특정 팀 온콜 조회 (sre|security|devops|dba|infra)
  --next          다음 주 온콜 예정자 조회
  --rotate        로테이션 실행 (주간 교대)
  --escalation    에스컬레이션 정책 조회
  -h, --help      도움말
USAGE
  exit 0
}

# ---------------------------------------------------------------------------
# 인수 파싱
# ---------------------------------------------------------------------------
parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --team)        TEAM_FILTER="$2"; shift 2 ;;
      --next)        ACTION="next"; shift ;;
      --rotate)      ACTION="rotate"; shift ;;
      --escalation)  ACTION="escalation"; shift ;;
      -h|--help)     usage ;;
      *)             log_info "알 수 없는 옵션: $1"; usage ;;
    esac
  done
}

# ---------------------------------------------------------------------------
# 현재 주차 계산
# ---------------------------------------------------------------------------
get_current_week() {
  date +%Y-W%V
}

# ---------------------------------------------------------------------------
# 팀 정보 (ConfigMap에서 추출)
# ---------------------------------------------------------------------------
declare -A TEAM_NAMES=(
  ["sre"]="SRE팀"
  ["security"]="보안팀"
  ["devops"]="DevOps팀"
  ["dba"]="DBA팀"
  ["infra"]="인프라팀"
)

declare -A TEAM_MEMBERS_COUNT=(
  ["sre"]="3"
  ["security"]="2"
  ["devops"]="2"
  ["dba"]="1"
  ["infra"]="2"
)

# ---------------------------------------------------------------------------
# 현재 온콜 담당자 계산 (주차 기반 로테이션)
# ---------------------------------------------------------------------------
get_oncall_member() {
  local team="$1"
  local week_num
  week_num=$(date +%V)
  local member_count="${TEAM_MEMBERS_COUNT[$team]:-1}"
  local index=$((week_num % member_count))

  local prefix
  case "$team" in
    sre) prefix="SRE" ;;
    security) prefix="SEC" ;;
    devops) prefix="OPS" ;;
    dba) prefix="DBA" ;;
    infra) prefix="INFRA" ;;
  esac

  local letter
  case $index in
    0) letter="A" ;;
    1) letter="B" ;;
    2) letter="C" ;;
    *) letter="A" ;;
  esac

  echo "${prefix}-${letter}"
}

# ---------------------------------------------------------------------------
# 다음 주 온콜 담당자 계산
# ---------------------------------------------------------------------------
get_next_oncall_member() {
  local team="$1"
  local next_week_num
  next_week_num=$(date -d "+7 days" +%V 2>/dev/null || echo $(($(date +%V) + 1)))
  local member_count="${TEAM_MEMBERS_COUNT[$team]:-1}"
  local index=$((next_week_num % member_count))

  local prefix
  case "$team" in
    sre) prefix="SRE" ;;
    security) prefix="SEC" ;;
    devops) prefix="OPS" ;;
    dba) prefix="DBA" ;;
    infra) prefix="INFRA" ;;
  esac

  local letter
  case $index in
    0) letter="A" ;;
    1) letter="B" ;;
    2) letter="C" ;;
    *) letter="A" ;;
  esac

  echo "${prefix}-${letter}"
}

# ---------------------------------------------------------------------------
# 현재 온콜 현황 표시
# ---------------------------------------------------------------------------
show_status() {
  local current_week
  current_week=$(get_current_week)

  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  온콜 현황 -- $current_week${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo ""

  local teams=("sre" "security" "devops" "dba" "infra")

  if [[ -n "$TEAM_FILTER" ]]; then
    teams=("$TEAM_FILTER")
  fi

  printf "%-12s %-10s %-20s\n" "팀" "담당자" "연락처"
  printf "%-12s %-10s %-20s\n" "----------" "--------" "------------------"

  for team in "${teams[@]}"; do
    local member
    member=$(get_oncall_member "$team")
    local team_name="${TEAM_NAMES[$team]:-$team}"
    local contact="${member,,}@saas-platform.gov.kr"
    printf "%-12s %-10s %-20s\n" "$team_name" "$member" "$contact"
  done

  echo ""
  echo -e "교대 시점: 매주 월요일 09:00 KST"
  echo -e "핸드오프 체크리스트: docs/operations/oncall-handoff-checklist.md"
}

# ---------------------------------------------------------------------------
# 다음 주 온콜 예정자 표시
# ---------------------------------------------------------------------------
show_next() {
  local next_week
  next_week=$(date -d "+7 days" +%Y-W%V 2>/dev/null || echo "다음 주")

  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  다음 주 온콜 예정 -- $next_week${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo ""

  local teams=("sre" "security" "devops" "dba" "infra")

  printf "%-12s %-10s %-10s\n" "팀" "현재" "다음 주"
  printf "%-12s %-10s %-10s\n" "----------" "--------" "--------"

  for team in "${teams[@]}"; do
    local current
    current=$(get_oncall_member "$team")
    local next
    next=$(get_next_oncall_member "$team")
    local team_name="${TEAM_NAMES[$team]:-$team}"
    printf "%-12s %-10s %-10s\n" "$team_name" "$current" "$next"
  done
}

# ---------------------------------------------------------------------------
# 에스컬레이션 정책 표시
# ---------------------------------------------------------------------------
show_escalation() {
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  에스컬레이션 정책${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo ""

  echo -e "${RED}P1 (긴급)${NC}"
  echo "  0분:  온콜 담당자 (알림)"
  echo "  15분: 팀 리더 (전화)"
  echo "  30분: CTO (전화 + 메시지)"
  echo "  60분: 전체 엔지니어링 (전체 공지)"
  echo ""

  echo -e "${YELLOW}P2 (높음)${NC}"
  echo "  0분:  온콜 담당자 (알림)"
  echo "  30분: 팀 리더 (메시지)"
  echo "  2시간: CTO (메시지)"
  echo ""

  echo -e "${BLUE}P3 (보통)${NC}"
  echo "  0분:  온콜 담당자 (알림)"
  echo "  2시간: 팀 리더 (메시지)"
  echo ""

  echo -e "${GREEN}P4 (낮음)${NC}"
  echo "  0분:  온콜 담당자 (알림)"
  echo "  24시간: 팀 리더 (메시지)"
}

# ---------------------------------------------------------------------------
# 로테이션 실행
# ---------------------------------------------------------------------------
do_rotate() {
  log_info "온콜 로테이션 실행..."

  local current_week
  current_week=$(get_current_week)

  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  온콜 로테이션 실행 -- $current_week${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo ""

  local teams=("sre" "security" "devops" "dba" "infra")

  for team in "${teams[@]}"; do
    local member
    member=$(get_oncall_member "$team")
    local team_name="${TEAM_NAMES[$team]:-$team}"
    echo "  $team_name: $member"
    log_audit "ONCALL_ROTATE" "team=$team member=$member week=$current_week"
  done

  echo ""
  log_success "로테이션 완료. ConfigMap 업데이트 필요:"
  echo "  kubectl apply -f infra/monitoring/oncall-schedule.yaml"
}

# ---------------------------------------------------------------------------
# 메인
# ---------------------------------------------------------------------------
main() {
  parse_args "$@"

  case "$ACTION" in
    status)     show_status ;;
    next)       show_next ;;
    escalation) show_escalation ;;
    rotate)     do_rotate ;;
  esac
}

main "$@"
