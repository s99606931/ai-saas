#!/usr/bin/env bash
# =============================================================================
# SLO 에러 예산 주간/월간 자동 리포트 생성 스크립트
# Design Ref: MTU-N121 Design SS3.1, SS3.2
# Plan SC: FR-N121.1, FR-N121.2, FR-N121.4, FR-N121.5
# CSAP: D-06(침해사고 관리 -- SLO 준수 리포팅)
#
# 사용법:
#   ./scripts/generate-slo-report.sh --period weekly
#   ./scripts/generate-slo-report.sh --period monthly
#   ./scripts/generate-slo-report.sh --period weekly --dry-run
#
# 의존성: curl, jq, date, bc
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/docs/reports/slo"
AUDIT_LOG="$PROJECT_ROOT/.claude/audit.jsonl"

PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"

# 옵션
PERIOD="weekly"
DRY_RUN=false
REPORT_DATE=$(date +%Y-%m-%d)

# SLO 서비스 정의
declare -A SLO_TARGETS=(
  ["api-gateway"]="99.9"
  ["auth-service"]="99.95"
  ["tenant-service"]="99.9"
  ["plugin-service"]="99.5"
  ["document-service"]="99.5"
)

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $(date '+%H:%M:%S') $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $(date '+%H:%M:%S') $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $(date '+%H:%M:%S') $1"; }

log_audit() {
  local action="$1"
  local detail="$2"
  local entry="{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"slo-report-generator\",\"action\":\"$action\",\"detail\":\"$detail\"}"
  echo "$entry" >> "$AUDIT_LOG" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# 사용법
# ---------------------------------------------------------------------------
usage() {
  cat <<'USAGE'
사용법: generate-slo-report.sh [옵션]

옵션:
  --period PERIOD    보고 기간: weekly (7일) 또는 monthly (30일)
  --date DATE        보고 기준일 (기본: 오늘, ISO 8601)
  --output-dir DIR   출력 디렉토리 (기본: docs/reports/slo/)
  --dry-run          실제 API 호출 없이 샘플 데이터로 생성
  -h, --help         도움말
USAGE
  exit 0
}

# ---------------------------------------------------------------------------
# 인수 파싱
# ---------------------------------------------------------------------------
parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --period)     PERIOD="$2"; shift 2 ;;
      --date)       REPORT_DATE="$2"; shift 2 ;;
      --output-dir) OUTPUT_DIR="$2"; shift 2 ;;
      --dry-run)    DRY_RUN=true; shift ;;
      -h|--help)    usage ;;
      *)            log_error "알 수 없는 옵션: $1"; usage ;;
    esac
  done

  if [[ ! "$PERIOD" =~ ^(weekly|monthly)$ ]]; then
    log_error "기간은 weekly 또는 monthly 여야 합니다: $PERIOD"
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# 기간 계산
# ---------------------------------------------------------------------------
calculate_period() {
  local end_epoch
  end_epoch=$(date -d "$REPORT_DATE" +%s 2>/dev/null || date +%s)

  local days
  if [[ "$PERIOD" == "weekly" ]]; then
    days=7
  else
    days=30
  fi

  local start_epoch=$((end_epoch - days * 86400))
  local start_date
  start_date=$(date -d "@$start_epoch" +%Y-%m-%d 2>/dev/null || date +%Y-%m-%d)

  echo "$start_date $REPORT_DATE $start_epoch $end_epoch $days"
}

# ---------------------------------------------------------------------------
# Prometheus에서 SLI 메트릭 조회
# ---------------------------------------------------------------------------
query_prometheus() {
  local query="$1"
  local timestamp="${2:-}"

  if [[ "$DRY_RUN" == true ]]; then
    return
  fi

  local url="${PROMETHEUS_URL}/api/v1/query?query=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$query'))" 2>/dev/null || echo "$query")"
  if [[ -n "$timestamp" ]]; then
    url+="&time=$timestamp"
  fi

  curl -sf --max-time 10 "$url" 2>/dev/null | jq -r '.data.result[0].value[1] // "N/A"' 2>/dev/null || echo "N/A"
}

# ---------------------------------------------------------------------------
# SLI 달성률 조회 (서비스별)
# ---------------------------------------------------------------------------
get_sli_achievement() {
  local service="$1"
  local window="${2:-30d}"

  if [[ "$DRY_RUN" == true ]]; then
    # 샘플 데이터: 99.0 ~ 100.0 사이 랜덤
    echo "$(echo "scale=3; 99 + $((RANDOM % 100)) / 100" | bc 2>/dev/null || echo "99.95")"
    return
  fi

  local query="1 - slo:sli_error:ratio_rate${window}{sloth_service=\"${service}\"}"
  local result
  result=$(query_prometheus "$query")

  if [[ "$result" != "N/A" ]]; then
    echo "$(echo "scale=4; $result * 100" | bc 2>/dev/null || echo "N/A")"
  else
    echo "N/A"
  fi
}

# ---------------------------------------------------------------------------
# 에러 예산 잔여율 조회
# ---------------------------------------------------------------------------
get_error_budget_remaining() {
  local service="$1"

  if [[ "$DRY_RUN" == true ]]; then
    echo "$(echo "scale=1; 30 + $((RANDOM % 70))" | bc 2>/dev/null || echo "65.0")"
    return
  fi

  local query="slo:error_budget:remaining_ratio{sloth_service=\"${service}\"}"
  local result
  result=$(query_prometheus "$query")

  if [[ "$result" != "N/A" ]]; then
    echo "$(echo "scale=1; $result * 100" | bc 2>/dev/null || echo "N/A")"
  else
    echo "N/A"
  fi
}

# ---------------------------------------------------------------------------
# Burn Rate 조회
# ---------------------------------------------------------------------------
get_burn_rate() {
  local service="$1"
  local window="${2:-1h}"

  if [[ "$DRY_RUN" == true ]]; then
    echo "$(echo "scale=2; $((RANDOM % 20)) / 10" | bc 2>/dev/null || echo "0.5")"
    return
  fi

  local query="slo:burn_rate:${window}{sloth_service=\"${service}\"}"
  local result
  result=$(query_prometheus "$query")
  echo "${result:-N/A}"
}

# ---------------------------------------------------------------------------
# MTTR/MTTD 계산
# ---------------------------------------------------------------------------
calculate_mttr() {
  if [[ "$DRY_RUN" == true ]]; then
    echo "15"
    return
  fi

  # Prometheus에서 최근 인시던트 평균 복구 시간 계산
  local query="avg(increase(ALERTS_FOR_STATE{alertstate=\"resolved\"}[7d]))"
  local result
  result=$(query_prometheus "$query")
  echo "${result:-N/A}"
}

# ---------------------------------------------------------------------------
# 에러 예산 소진 예측 (FR-N121.5)
# ---------------------------------------------------------------------------
predict_budget_exhaustion() {
  local remaining="$1"
  local burn_rate="$2"

  if [[ "$remaining" == "N/A" || "$burn_rate" == "N/A" ]]; then
    echo "예측 불가"
    return
  fi

  # burn_rate가 0이면 소진되지 않음
  local is_zero
  is_zero=$(echo "$burn_rate <= 0" | bc 2>/dev/null || echo "1")
  if [[ "$is_zero" == "1" ]]; then
    echo "소진 예정 없음"
    return
  fi

  # 잔여 예산 / 소진 속도 = 남은 일수
  local days_remaining
  days_remaining=$(echo "scale=0; $remaining / ($burn_rate * 24)" | bc 2>/dev/null || echo "N/A")

  if [[ "$days_remaining" != "N/A" && "$days_remaining" -gt 0 ]]; then
    local exhaust_date
    exhaust_date=$(date -d "+${days_remaining} days" +%Y-%m-%d 2>/dev/null || echo "N/A")
    echo "${days_remaining}일 후 (${exhaust_date})"
  else
    echo "이미 소진됨"
  fi
}

# ---------------------------------------------------------------------------
# SLO 달성 상태 아이콘
# ---------------------------------------------------------------------------
get_status_icon() {
  local sli="$1"
  local target="$2"

  if [[ "$sli" == "N/A" ]]; then
    echo "---"
    return
  fi

  local met
  met=$(echo "$sli >= $target" | bc 2>/dev/null || echo "0")
  if [[ "$met" == "1" ]]; then
    echo "달성"
  else
    echo "미달"
  fi
}

# ---------------------------------------------------------------------------
# 보고서 생성
# ---------------------------------------------------------------------------
generate_report() {
  log_info "SLO 에러 예산 ${PERIOD} 보고서 생성 시작..."
  log_audit "SLO_REPORT_START" "period=$PERIOD date=$REPORT_DATE"

  mkdir -p "$OUTPUT_DIR"

  local period_info
  period_info=$(calculate_period)
  local start_date end_date start_epoch end_epoch days
  read -r start_date end_date start_epoch end_epoch days <<< "$period_info"

  local period_ko
  if [[ "$PERIOD" == "weekly" ]]; then
    period_ko="주간"
  else
    period_ko="월간"
  fi

  # 출력 파일
  local output_file="${OUTPUT_DIR}/slo-report-${PERIOD}-${REPORT_DATE}.md"
  local generated_at
  generated_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # SLI/SLO 데이터 수집
  log_info "서비스별 SLI/SLO 데이터 수집 중..."

  local sli_table=""
  local budget_table=""
  local burn_table=""
  local total_met=0
  local total_services=0
  local critical_services=""

  for service in "${!SLO_TARGETS[@]}"; do
    local target="${SLO_TARGETS[$service]}"
    local sli
    sli=$(get_sli_achievement "$service")
    local budget_remaining
    budget_remaining=$(get_error_budget_remaining "$service")
    local burn_1h
    burn_1h=$(get_burn_rate "$service" "1h")
    local burn_6h
    burn_6h=$(get_burn_rate "$service" "6h")
    local status
    status=$(get_status_icon "$sli" "$target")
    local prediction
    prediction=$(predict_budget_exhaustion "$budget_remaining" "$burn_1h")

    total_services=$((total_services + 1))
    if [[ "$status" == "달성" ]]; then
      total_met=$((total_met + 1))
    fi

    # 에러 예산 30% 미만이면 위험 서비스
    local is_critical
    is_critical=$(echo "${budget_remaining:-100} < 30" | bc 2>/dev/null || echo "0")
    if [[ "$is_critical" == "1" ]]; then
      critical_services+="- ${service}: 에러 예산 ${budget_remaining}% 잔여\n"
    fi

    sli_table+="| ${service} | ${target}% | ${sli}% | ${status} | ${budget_remaining}% |\n"
    burn_table+="| ${service} | ${burn_1h} | ${burn_6h} | ${prediction} |\n"
  done

  # MTTR 계산
  local avg_mttr
  avg_mttr=$(calculate_mttr)

  # 전체 달성률
  local achievement_rate=0
  if [[ $total_services -gt 0 ]]; then
    achievement_rate=$((total_met * 100 / total_services))
  fi

  # 보고서 생성
  cat > "$output_file" << REPORT
# SLO 에러 예산 ${period_ko} 보고서

> CSAP: D-06(침해사고 관리 -- SLO 준수 리포팅)
> 생성일: ${generated_at}
> 보고 기간: ${start_date} ~ ${end_date} (${days}일)

---

## 1. 요약

| 항목 | 값 |
|------|------|
| 보고 기간 | ${start_date} ~ ${end_date} |
| 대상 서비스 수 | ${total_services} |
| SLO 달성 서비스 | ${total_met} / ${total_services} |
| 전체 달성률 | ${achievement_rate}% |
| 평균 MTTR | ${avg_mttr}분 |

---

## 2. 서비스별 SLO 달성 현황

| 서비스 | SLO 목표 | 현재 SLI | 달성 여부 | 에러 예산 잔여 |
|--------|---------|---------|---------|-------------|
$(echo -e "$sli_table")

---

## 3. 에러 예산 Burn Rate 분석

| 서비스 | 1시간 Burn Rate | 6시간 Burn Rate | 예산 소진 예측 |
|--------|---------------|----------------|-------------|
$(echo -e "$burn_table")

### Burn Rate 해석 기준

| Burn Rate | 의미 | 대응 |
|-----------|------|------|
| < 1.0 | 정상 소진 | 모니터링 유지 |
| 1.0 ~ 5.0 | 빠른 소진 | 원인 조사 필요 |
| 5.0 ~ 10.0 | 위험 수준 | 즉시 대응 필요 |
| > 10.0 | 긴급 상황 | SRE 에스컬레이션 |

---

## 4. 주의 필요 서비스

$(if [[ -n "$critical_services" ]]; then
  echo "다음 서비스의 에러 예산이 30% 미만입니다:"
  echo ""
  echo -e "$critical_services"
else
  echo "모든 서비스의 에러 예산이 30% 이상입니다."
fi)

---

## 5. MTTR/MTTD 통계

| 지표 | 값 | 목표 | 상태 |
|------|------|------|------|
| 평균 MTTR (P1) | ${avg_mttr}분 | 30분 | $(if [[ "${avg_mttr}" != "N/A" ]] && [[ $(echo "${avg_mttr} <= 30" | bc 2>/dev/null || echo "1") == "1" ]]; then echo "달성"; else echo "미달"; fi) |
| 평균 MTTR (P2) | N/A | 120분 | --- |
| MTTD | N/A | 5분 | --- |

---

## 6. 권장 조치

$(if [[ $achievement_rate -lt 100 ]]; then
  echo "### SLO 미달 서비스 개선"
  echo ""
  echo "- SLO 미달 서비스에 대해 포스트모템 작성 검토"
  echo "- 에러 예산 소진 속도가 빠른 서비스 원인 분석"
  echo "- 알림 규칙 임계값 재검토"
fi)

$(if [[ -n "$critical_services" ]]; then
  echo "### 에러 예산 위험 서비스 대응"
  echo ""
  echo "- 에러 예산 30% 미만 서비스 긴급 점검"
  echo "- 배포 동결 검토 (에러 예산 소진 시)"
  echo "- 카오스 엔지니어링 테스트 일시 중단"
fi)

### 일반 권장 사항

- 주간 SRE 회의에서 본 보고서 리뷰
- 에러 예산 소진 추이 지속 모니터링
- SLO 목표치 적정성 분기별 재검토

---

## 7. 감사 추적 (CSAP D-06)

| 항목 | 내용 |
|------|------|
| 보고서 생성 도구 | \`scripts/generate-slo-report.sh\` |
| SLO 알림 규칙 | \`infra/monitoring/slo-error-budget-alerts.yaml\` |
| SLO 대시보드 | \`infra/monitoring/dashboards/slo-overview.json\` |
| 감사 로그 | \`.claude/audit.jsonl\` |

---

> 이 보고서는 scripts/generate-slo-report.sh에 의해 자동 생성되었습니다.
REPORT

  log_success "SLO 보고서 생성 완료: $output_file"
  log_audit "SLO_REPORT_COMPLETE" "output=$output_file period=$PERIOD"

  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  SLO 에러 예산 ${period_ko} 보고서 생성 완료${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo -e "  기간:       ${start_date} ~ ${end_date}"
  echo -e "  달성률:     ${GREEN}${achievement_rate}%${NC} (${total_met}/${total_services})"
  echo -e "  출력 파일:  ${GREEN}${output_file}${NC}"
  echo -e "${CYAN}========================================${NC}"
}

# ---------------------------------------------------------------------------
# 메인
# ---------------------------------------------------------------------------
main() {
  parse_args "$@"
  generate_report
}

main "$@"
