#!/usr/bin/env bash
# =============================================================================
# 서비스 의존성 토폴로지 조회 및 영향 분석 스크립트
# Design Ref: MTU-N123 Design SS1
# Plan SC: FR-N123.2, FR-N123.4
# CSAP: D-06(장애 영향 분석 -- 서비스 의존성)
#
# 사용법:
#   ./scripts/service-topology.sh --list              # 전체 서비스 목록
#   ./scripts/service-topology.sh --deps api-gateway   # 서비스 의존성 조회
#   ./scripts/service-topology.sh --blast postgresql   # 장애 영향 분석
#   ./scripts/service-topology.sh --tier gateway       # 계층별 서비스 조회
#   ./scripts/service-topology.sh --critical           # 핵심 의존성 경로
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TOPOLOGY_FILE="$PROJECT_ROOT/infra/service-dependency/topology.yaml"
AUDIT_LOG="$PROJECT_ROOT/.claude/audit.jsonl"

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

ACTION="list"
TARGET=""

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_audit() {
  local action="$1"
  local detail="$2"
  local entry="{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"topology-analyzer\",\"action\":\"$action\",\"detail\":\"$detail\"}"
  echo "$entry" >> "$AUDIT_LOG" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# 사용법
# ---------------------------------------------------------------------------
usage() {
  cat <<'USAGE'
사용법: service-topology.sh [옵션]

옵션:
  --list              전체 서비스 목록 (계층별)
  --deps SERVICE      특정 서비스의 의존성 조회
  --dependents SVC    특정 서비스에 의존하는 서비스 조회
  --blast SERVICE     장애 시 영향 범위 분석 (Blast Radius)
  --tier TIER         계층별 서비스 조회 (gateway/core/data/infra/monitoring)
  --critical          핵심 의존 경로 (SPOF 분석)
  --summary           전체 토폴로지 요약 통계
  -h, --help          도움말
USAGE
  exit 0
}

# ---------------------------------------------------------------------------
# 인수 파싱
# ---------------------------------------------------------------------------
parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --list)       ACTION="list"; shift ;;
      --deps)       ACTION="deps"; TARGET="$2"; shift 2 ;;
      --dependents) ACTION="dependents"; TARGET="$2"; shift 2 ;;
      --blast)      ACTION="blast"; TARGET="$2"; shift 2 ;;
      --tier)       ACTION="tier"; TARGET="$2"; shift 2 ;;
      --critical)   ACTION="critical"; shift ;;
      --summary)    ACTION="summary"; shift ;;
      -h|--help)    usage ;;
      *)            log_info "알 수 없는 옵션: $1"; usage ;;
    esac
  done
}

# ---------------------------------------------------------------------------
# 서비스 데이터 (토폴로지 파일에서 추출한 정적 데이터)
# ---------------------------------------------------------------------------
# 서비스 정의: name|tier|namespace|description|slo_avail
declare -a SERVICES=(
  "api-gateway|gateway|platform|API 게이트웨이|99.9%"
  "auth-service|core|platform|인증/인가 서비스|99.95%"
  "tenant-service|core|platform|멀티테넌트 관리|99.9%"
  "plugin-service|core|platform|플러그인 관리|99.5%"
  "document-service|core|platform|문서 관리|99.5%"
  "audit-service|core|platform|감사 로그 서비스|99.9%"
  "postgresql|data|database|PostgreSQL 15|99.99%"
  "redis|data|database|Redis 7|99.9%"
  "minio|data|storage|MinIO 오브젝트 스토리지|99.9%"
  "gitea|infra|gitea|Git 저장소 및 CI/CD|99.5%"
  "harbor|infra|harbor|컨테이너 이미지 레지스트리|99.5%"
  "prometheus|monitoring|monitoring|메트릭 수집 및 알림|99.9%"
  "loki|monitoring|monitoring|로그 집계|99.5%"
  "grafana|monitoring|monitoring|모니터링 대시보드|99.5%"
)

# 의존성 정의: from|to|type|criticality
declare -a DEPENDENCIES=(
  "api-gateway|auth-service|sync|critical"
  "api-gateway|tenant-service|sync|critical"
  "api-gateway|plugin-service|sync|medium"
  "api-gateway|document-service|sync|medium"
  "auth-service|postgresql|sync|critical"
  "auth-service|redis|sync|high"
  "tenant-service|postgresql|sync|critical"
  "tenant-service|auth-service|sync|high"
  "plugin-service|postgresql|sync|critical"
  "plugin-service|minio|sync|high"
  "plugin-service|auth-service|sync|high"
  "document-service|postgresql|sync|critical"
  "document-service|minio|sync|critical"
  "document-service|auth-service|sync|high"
  "audit-service|postgresql|async|critical"
  "gitea|postgresql|sync|critical"
  "harbor|postgresql|sync|critical"
  "harbor|minio|sync|critical"
  "grafana|prometheus|sync|high"
  "grafana|loki|sync|medium"
)

# ---------------------------------------------------------------------------
# 서비스 정보 조회
# ---------------------------------------------------------------------------
get_service_info() {
  local name="$1"
  for svc in "${SERVICES[@]}"; do
    IFS='|' read -r svc_name svc_tier svc_ns svc_desc svc_slo <<< "$svc"
    if [[ "$svc_name" == "$name" ]]; then
      echo "$svc_name|$svc_tier|$svc_ns|$svc_desc|$svc_slo"
      return 0
    fi
  done
  return 1
}

# ---------------------------------------------------------------------------
# 전체 서비스 목록
# ---------------------------------------------------------------------------
show_list() {
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  서비스 토폴로지 -- 전체 목록${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo ""

  local current_tier=""
  for svc in "${SERVICES[@]}"; do
    IFS='|' read -r name tier ns desc slo <<< "$svc"

    if [[ "$tier" != "$current_tier" ]]; then
      current_tier="$tier"
      local tier_color
      case "$tier" in
        gateway)    tier_color="${RED}" ;;
        core)       tier_color="${YELLOW}" ;;
        data)       tier_color="${GREEN}" ;;
        infra)      tier_color="${BLUE}" ;;
        monitoring) tier_color="${MAGENTA}" ;;
        *)          tier_color="${NC}" ;;
      esac
      echo -e "\n${tier_color}[$tier]${NC}"
    fi

    printf "  %-20s %-12s %-30s %s\n" "$name" "($ns)" "$desc" "SLO: $slo"
  done
  echo ""
}

# ---------------------------------------------------------------------------
# 서비스 의존성 조회
# ---------------------------------------------------------------------------
show_deps() {
  local target="$1"

  if ! get_service_info "$target" > /dev/null 2>&1; then
    echo -e "${RED}서비스를 찾을 수 없습니다: $target${NC}"
    echo "사용 가능한 서비스: $(printf '%s ' "${SERVICES[@]}" | tr '|' ' ' | awk '{for(i=1;i<=NF;i+=5) print $i}' | tr '\n' ', ')"
    exit 1
  fi

  local info
  info=$(get_service_info "$target")
  IFS='|' read -r name tier ns desc slo <<< "$info"

  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  서비스 의존성: $name${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo -e "  계층:     $tier"
  echo -e "  설명:     $desc"
  echo -e "  SLO:      $slo"
  echo ""

  echo -e "  ${YELLOW}의존 서비스 (이 서비스가 의존하는):${NC}"
  local found=false
  for dep in "${DEPENDENCIES[@]}"; do
    IFS='|' read -r from to type crit <<< "$dep"
    if [[ "$from" == "$target" ]]; then
      local crit_color
      case "$crit" in
        critical) crit_color="${RED}" ;;
        high)     crit_color="${YELLOW}" ;;
        medium)   crit_color="${GREEN}" ;;
        *)        crit_color="${NC}" ;;
      esac
      printf "    --> %-20s [%s] ${crit_color}%s${NC}\n" "$to" "$type" "$crit"
      found=true
    fi
  done
  if [[ "$found" == false ]]; then
    echo "    (없음)"
  fi

  echo ""
  echo -e "  ${BLUE}의존자 (이 서비스에 의존하는):${NC}"
  found=false
  for dep in "${DEPENDENCIES[@]}"; do
    IFS='|' read -r from to type crit <<< "$dep"
    if [[ "$to" == "$target" ]]; then
      printf "    <-- %-20s [%s] %s\n" "$from" "$type" "$crit"
      found=true
    fi
  done
  if [[ "$found" == false ]]; then
    echo "    (없음)"
  fi
}

# ---------------------------------------------------------------------------
# 장애 영향 분석 (Blast Radius)
# ---------------------------------------------------------------------------
show_blast() {
  local target="$1"

  if ! get_service_info "$target" > /dev/null 2>&1; then
    echo -e "${RED}서비스를 찾을 수 없습니다: $target${NC}"
    exit 1
  fi

  local info
  info=$(get_service_info "$target")
  IFS='|' read -r name tier ns desc slo <<< "$info"

  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  장애 영향 분석 (Blast Radius): $name${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo ""

  log_audit "BLAST_RADIUS_ANALYSIS" "target=$target"

  # BFS로 영향 범위 탐색
  local -A visited
  local -a queue=("$target")
  local -a impacted=()
  visited["$target"]=1

  while [[ ${#queue[@]} -gt 0 ]]; do
    local current="${queue[0]}"
    queue=("${queue[@]:1}")

    for dep in "${DEPENDENCIES[@]}"; do
      IFS='|' read -r from to type crit <<< "$dep"
      if [[ "$to" == "$current" && -z "${visited[$from]:-}" ]]; then
        visited["$from"]=1
        impacted+=("$from|$crit")
        queue+=("$from")
      fi
    done
  done

  echo -e "  ${RED}직접 영향 서비스:${NC}"
  local direct_count=0
  for dep in "${DEPENDENCIES[@]}"; do
    IFS='|' read -r from to type crit <<< "$dep"
    if [[ "$to" == "$target" ]]; then
      printf "    %-20s (위험도: %s)\n" "$from" "$crit"
      direct_count=$((direct_count + 1))
    fi
  done
  if [[ $direct_count -eq 0 ]]; then
    echo "    (없음)"
  fi

  echo ""
  echo -e "  ${YELLOW}간접 영향 (전파 경로):${NC}"
  local indirect_count=0
  for item in "${impacted[@]}"; do
    IFS='|' read -r svc_name crit <<< "$item"
    # 직접 의존은 건너뜀
    local is_direct=false
    for dep in "${DEPENDENCIES[@]}"; do
      IFS='|' read -r from to type c <<< "$dep"
      if [[ "$to" == "$target" && "$from" == "$svc_name" ]]; then
        is_direct=true
        break
      fi
    done
    if [[ "$is_direct" == false ]]; then
      printf "    %-20s (전파 위험도: %s)\n" "$svc_name" "$crit"
      indirect_count=$((indirect_count + 1))
    fi
  done
  if [[ $indirect_count -eq 0 ]]; then
    echo "    (없음)"
  fi

  local total=$((direct_count + indirect_count))
  echo ""
  echo -e "  ${CYAN}영향 범위 요약:${NC}"
  echo "    직접 영향: ${direct_count}개 서비스"
  echo "    간접 영향: ${indirect_count}개 서비스"
  echo "    전체 영향: ${total}개 서비스"
  echo ""

  # 심각도 판단
  if [[ $total -ge 5 ]]; then
    echo -e "  ${RED}위험도: HIGH -- 이 서비스 장애는 5개 이상 서비스에 영향${NC}"
  elif [[ $total -ge 3 ]]; then
    echo -e "  ${YELLOW}위험도: MEDIUM -- 이 서비스 장애는 3~4개 서비스에 영향${NC}"
  elif [[ $total -ge 1 ]]; then
    echo -e "  ${GREEN}위험도: LOW -- 이 서비스 장애는 1~2개 서비스에 영향${NC}"
  else
    echo -e "  ${GREEN}위험도: NONE -- 이 서비스에 의존하는 서비스 없음${NC}"
  fi
}

# ---------------------------------------------------------------------------
# 계층별 서비스 조회
# ---------------------------------------------------------------------------
show_tier() {
  local target_tier="$1"

  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  계층별 서비스: $target_tier${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo ""

  local found=false
  for svc in "${SERVICES[@]}"; do
    IFS='|' read -r name tier ns desc slo <<< "$svc"
    if [[ "$tier" == "$target_tier" ]]; then
      printf "  %-20s %-12s %s (SLO: %s)\n" "$name" "($ns)" "$desc" "$slo"
      found=true
    fi
  done

  if [[ "$found" == false ]]; then
    echo "  (해당 계층에 서비스 없음)"
    echo ""
    echo "  사용 가능한 계층: gateway, core, data, infra, monitoring"
  fi
}

# ---------------------------------------------------------------------------
# 핵심 의존 경로 (SPOF 분석)
# ---------------------------------------------------------------------------
show_critical() {
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  핵심 의존 경로 (SPOF 분석)${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo ""

  # 각 서비스의 의존자 수 계산
  declare -A dependent_count

  for dep in "${DEPENDENCIES[@]}"; do
    IFS='|' read -r from to type crit <<< "$dep"
    dependent_count["$to"]=$(( ${dependent_count["$to"]:-0} + 1 ))
  done

  echo -e "  ${RED}가장 많은 서비스가 의존하는 서비스 (내림차순):${NC}"
  echo ""
  printf "  %-20s %-10s %-10s\n" "서비스" "의존자 수" "위험도"
  printf "  %-20s %-10s %-10s\n" "------------------" "--------" "------"

  # 정렬하여 출력
  for svc in "${!dependent_count[@]}"; do
    local count="${dependent_count[$svc]}"
    local risk
    if [[ $count -ge 5 ]]; then
      risk="${RED}CRITICAL${NC}"
    elif [[ $count -ge 3 ]]; then
      risk="${YELLOW}HIGH${NC}"
    else
      risk="${GREEN}NORMAL${NC}"
    fi
    echo -e "  $(printf '%-20s %-10s' "$svc" "$count") $risk"
  done | sort -t$'\t' -k2 -rn

  echo ""
  echo -e "  ${YELLOW}SPOF 권장 조치:${NC}"
  for svc in "${!dependent_count[@]}"; do
    local count="${dependent_count[$svc]}"
    if [[ $count -ge 5 ]]; then
      echo "    - $svc: 이중화 필수, 장애 시 ${count}개 서비스 영향"
    fi
  done
}

# ---------------------------------------------------------------------------
# 토폴로지 요약 통계
# ---------------------------------------------------------------------------
show_summary() {
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  서비스 토폴로지 요약${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo ""

  # 계층별 서비스 수
  declare -A tier_count
  for svc in "${SERVICES[@]}"; do
    IFS='|' read -r name tier ns desc slo <<< "$svc"
    tier_count["$tier"]=$(( ${tier_count["$tier"]:-0} + 1 ))
  done

  echo "  전체 서비스: ${#SERVICES[@]}"
  echo ""
  echo "  계층별:"
  for t in gateway core data infra monitoring; do
    printf "    %-12s %s개\n" "$t" "${tier_count[$t]:-0}"
  done

  echo ""
  echo "  전체 의존성: ${#DEPENDENCIES[@]}"

  # 의존성 유형별
  local sync_count=0
  local async_count=0
  local critical_count=0
  for dep in "${DEPENDENCIES[@]}"; do
    IFS='|' read -r from to type crit <<< "$dep"
    if [[ "$type" == "sync" ]]; then
      sync_count=$((sync_count + 1))
    else
      async_count=$((async_count + 1))
    fi
    if [[ "$crit" == "critical" ]]; then
      critical_count=$((critical_count + 1))
    fi
  done

  echo ""
  echo "  의존성 유형:"
  printf "    %-12s %s개\n" "동기(sync)" "$sync_count"
  printf "    %-12s %s개\n" "비동기(async)" "$async_count"
  echo ""
  echo "  핵심 의존성(critical): ${critical_count}개"
}

# ---------------------------------------------------------------------------
# 메인
# ---------------------------------------------------------------------------
main() {
  parse_args "$@"

  case "$ACTION" in
    list)       show_list ;;
    deps)       show_deps "$TARGET" ;;
    dependents) show_deps "$TARGET" ;;
    blast)      show_blast "$TARGET" ;;
    tier)       show_tier "$TARGET" ;;
    critical)   show_critical ;;
    summary)    show_summary ;;
  esac
}

main "$@"
