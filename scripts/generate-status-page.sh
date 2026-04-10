#!/usr/bin/env bash
# =============================================================================
# 플랫폼 상태 페이지 자동 생성 스크립트
# Design Ref: MTU-N124 Design
# Plan SC: FR-N124.1, FR-N124.2, FR-N124.3
# CSAP: D-06(침해사고 관리 -- 서비스 상태 공개)
#
# 사용법:
#   ./scripts/generate-status-page.sh                  # 상태 페이지 생성
#   ./scripts/generate-status-page.sh --dry-run        # API 없이 샘플 생성
#   ./scripts/generate-status-page.sh --maintenance    # 유지보수 공지 추가
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/docs/status"
AUDIT_LOG="$PROJECT_ROOT/.claude/audit.jsonl"

PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
DRY_RUN=false
ADD_MAINTENANCE=false
MAINTENANCE_MSG=""
MAINTENANCE_START=""
MAINTENANCE_END=""

# 서비스 정의
declare -a STATUS_SERVICES=(
  "api-gateway|API 게이트웨이|platform|gateway"
  "auth-service|인증/인가 서비스|platform|core"
  "tenant-service|테넌트 관리|platform|core"
  "plugin-service|플러그인 관리|platform|core"
  "document-service|문서 관리|platform|core"
  "audit-service|감사 로그|platform|core"
  "postgresql|데이터베이스|database|data"
  "redis|캐시|database|data"
  "minio|오브젝트 스토리지|storage|data"
  "gitea|Git 저장소|gitea|infra"
  "prometheus|메트릭 수집|monitoring|monitoring"
  "grafana|대시보드|monitoring|monitoring"
)

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $(date '+%H:%M:%S') $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $(date '+%H:%M:%S') $1"; }

log_audit() {
  local action="$1"
  local detail="$2"
  local entry="{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"status-page-generator\",\"action\":\"$action\",\"detail\":\"$detail\"}"
  echo "$entry" >> "$AUDIT_LOG" 2>/dev/null || true
}

usage() {
  cat <<'USAGE'
사용법: generate-status-page.sh [옵션]

옵션:
  --dry-run                   API 호출 없이 샘플 데이터로 생성
  --maintenance MSG           유지보수 공지 추가
  --maintenance-start TIME    유지보수 시작 시각 (ISO 8601)
  --maintenance-end TIME      유지보수 종료 시각 (ISO 8601)
  --output-dir DIR            출력 디렉토리 (기본: docs/status/)
  -h, --help                  도움말
USAGE
  exit 0
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run)             DRY_RUN=true; shift ;;
      --maintenance)         ADD_MAINTENANCE=true; MAINTENANCE_MSG="$2"; shift 2 ;;
      --maintenance-start)   MAINTENANCE_START="$2"; shift 2 ;;
      --maintenance-end)     MAINTENANCE_END="$2"; shift 2 ;;
      --output-dir)          OUTPUT_DIR="$2"; shift 2 ;;
      -h|--help)             usage ;;
      *)                     log_info "알 수 없는 옵션: $1"; usage ;;
    esac
  done
}

# ---------------------------------------------------------------------------
# 서비스 상태 조회
# ---------------------------------------------------------------------------
get_service_status() {
  local service="$1"
  local namespace="$2"

  if [[ "$DRY_RUN" == true ]]; then
    # 샘플: 90% 정상, 10% 장애
    if (( RANDOM % 10 == 0 )); then
      echo "degraded"
    else
      echo "operational"
    fi
    return
  fi

  # Prometheus up 메트릭 조회
  local result
  result=$(curl -sf --max-time 5 \
    "${PROMETHEUS_URL}/api/v1/query?query=up{namespace=\"${namespace}\",job=~\".*${service}.*\"}" \
    2>/dev/null || echo '{"status":"error"}')

  if echo "$result" | jq -e '.status == "success"' > /dev/null 2>&1; then
    local value
    value=$(echo "$result" | jq -r '.data.result[0].value[1] // "0"' 2>/dev/null)
    if [[ "$value" == "1" ]]; then
      echo "operational"
    else
      echo "down"
    fi
  else
    echo "unknown"
  fi
}

# ---------------------------------------------------------------------------
# 활성 인시던트 수 조회
# ---------------------------------------------------------------------------
get_active_incidents() {
  if [[ "$DRY_RUN" == true ]]; then
    echo "0"
    return
  fi

  local result
  result=$(curl -sf --max-time 5 \
    "${PROMETHEUS_URL}/api/v1/query?query=count(ALERTS{alertstate=\"firing\"})%20or%20vector(0)" \
    2>/dev/null || echo '{"status":"error"}')

  if echo "$result" | jq -e '.status == "success"' > /dev/null 2>&1; then
    echo "$result" | jq -r '.data.result[0].value[1] // "0"' 2>/dev/null
  else
    echo "N/A"
  fi
}

# ---------------------------------------------------------------------------
# 상태 아이콘
# ---------------------------------------------------------------------------
status_icon() {
  case "$1" in
    operational) echo "[정상]" ;;
    degraded)    echo "[저하]" ;;
    down)        echo "[장애]" ;;
    maintenance) echo "[유지보수]" ;;
    *)           echo "[확인불가]" ;;
  esac
}

# ---------------------------------------------------------------------------
# 전체 시스템 상태 판단
# ---------------------------------------------------------------------------
overall_status() {
  local has_down=false
  local has_degraded=false

  for svc in "${STATUS_SERVICES[@]}"; do
    IFS='|' read -r name desc ns tier <<< "$svc"
    local status
    status=$(get_service_status "$name" "$ns")
    if [[ "$status" == "down" ]]; then
      has_down=true
    elif [[ "$status" == "degraded" ]]; then
      has_degraded=true
    fi
  done

  if [[ "$has_down" == true ]]; then
    echo "주요 서비스 장애 발생"
  elif [[ "$has_degraded" == true ]]; then
    echo "일부 서비스 성능 저하"
  else
    echo "모든 서비스 정상 운영 중"
  fi
}

# ---------------------------------------------------------------------------
# 상태 페이지 생성
# ---------------------------------------------------------------------------
generate_status_page() {
  log_info "상태 페이지 생성 시작..."
  log_audit "STATUS_PAGE_GENERATE_START" "dry_run=$DRY_RUN"

  mkdir -p "$OUTPUT_DIR"

  local generated_at
  generated_at=$(date '+%Y-%m-%d %H:%M:%S KST')
  local generated_at_iso
  generated_at_iso=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # 전체 시스템 상태
  local overall
  overall=$(overall_status)

  # 활성 인시던트
  local active_incidents
  active_incidents=$(get_active_incidents)

  local output_file="$OUTPUT_DIR/index.md"

  # 상태 페이지 생성
  cat > "$output_file" << 'HEADER'
# 공공기관 SaaS 플랫폼 -- 시스템 상태

HEADER

  cat >> "$output_file" << STATUS_HEADER
> 최종 갱신: ${generated_at}
> 갱신 주기: 5분

---

## 현재 상태

**${overall}**

| 항목 | 값 |
|------|------|
| 활성 인시던트 | ${active_incidents}건 |
| 갱신 시각 | ${generated_at} |

STATUS_HEADER

  # 유지보수 공지
  if [[ "$ADD_MAINTENANCE" == true && -n "$MAINTENANCE_MSG" ]]; then
    cat >> "$output_file" << MAINT

---

## 예정된 유지보수

| 항목 | 내용 |
|------|------|
| 내용 | ${MAINTENANCE_MSG} |
| 시작 | ${MAINTENANCE_START:-미정} |
| 종료 | ${MAINTENANCE_END:-미정} |

MAINT
  fi

  # 서비스 상태 테이블
  cat >> "$output_file" << 'TABLE_HEADER'

---

## 서비스별 상태

TABLE_HEADER

  # 계층별 서비스 상태
  local current_tier=""
  for svc in "${STATUS_SERVICES[@]}"; do
    IFS='|' read -r name desc ns tier <<< "$svc"

    if [[ "$tier" != "$current_tier" ]]; then
      current_tier="$tier"

      local tier_ko
      case "$tier" in
        gateway)    tier_ko="Gateway (진입점)" ;;
        core)       tier_ko="Core (핵심 서비스)" ;;
        data)       tier_ko="Data (데이터)" ;;
        infra)      tier_ko="Infra (인프라)" ;;
        monitoring) tier_ko="Monitoring (관측성)" ;;
      esac

      echo "" >> "$output_file"
      echo "### ${tier_ko}" >> "$output_file"
      echo "" >> "$output_file"
      echo "| 서비스 | 상태 | 설명 |" >> "$output_file"
      echo "|--------|------|------|" >> "$output_file"
    fi

    local status
    status=$(get_service_status "$name" "$ns")
    local icon
    icon=$(status_icon "$status")

    echo "| ${desc} | ${icon} | ${name} (${ns}) |" >> "$output_file"
  done

  # 인시던트 히스토리 링크
  cat >> "$output_file" << 'FOOTER'

---

## 인시던트 히스토리

최근 인시던트 이력은 [인시던트 히스토리](./incident-history.md)를 참조하세요.

---

## 상태 정의

| 상태 | 의미 |
|------|------|
| [정상] | 서비스가 정상 운영 중 |
| [저하] | 서비스 응답 지연 또는 간헐적 오류 발생 |
| [장애] | 서비스 접근 불가 또는 심각한 오류 |
| [유지보수] | 예정된 유지보수 진행 중 |
| [확인불가] | 상태 확인 불가 (모니터링 이슈) |

---

> 이 페이지는 `scripts/generate-status-page.sh`에 의해 자동 생성됩니다.
> 문의: platform-ops@saas-platform.gov.kr
FOOTER

  # 인시던트 히스토리 파일 초기화 (없으면 생성)
  local incident_history="$OUTPUT_DIR/incident-history.md"
  if [[ ! -f "$incident_history" ]]; then
    cat > "$incident_history" << 'HISTORY'
# 인시던트 히스토리

> 최근 인시던트 기록. 자동 업데이트됩니다.

---

| 일시 | 서비스 | 상태 | 지속 시간 | 설명 |
|------|-------|------|----------|------|
| (아직 인시던트 기록 없음) | | | | |

---

> 포스트모템 보고서: `docs/postmortems/`
HISTORY
  fi

  log_success "상태 페이지 생성 완료: $output_file"
  log_audit "STATUS_PAGE_GENERATE_COMPLETE" "output=$output_file"

  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  상태 페이지 생성 완료${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo -e "  시스템 상태: ${overall}"
  echo -e "  활성 인시던트: ${active_incidents}건"
  echo -e "  출력 파일: ${GREEN}${output_file}${NC}"
  echo -e "${CYAN}========================================${NC}"
}

main() {
  parse_args "$@"
  generate_status_page
}

main "$@"
