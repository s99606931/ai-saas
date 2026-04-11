#!/usr/bin/env bash
# =============================================================================
# DORA Four Keys 보고서 v2 생성기
# Design Ref: MTU-N251 Design §3.8
# Plan SC: FR-N251.9
# CSAP: D-06(침해사고 관리 -- DevOps 성숙도 정량 보고)
#
# 사용법:
#   ./scripts/generate-dora-report-v2.sh                     # 주간 분석
#   ./scripts/generate-dora-report-v2.sh --period monthly    # 월간 분석
#   ./scripts/generate-dora-report-v2.sh --dry-run           # 샘플 데이터
#   ./scripts/generate-dora-report-v2.sh --format markdown   # Markdown 출력
#   ./scripts/generate-dora-report-v2.sh --format audit      # 감리 증빙 형식
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/docs/reports/dora-metrics"
AUDIT_LOG="$PROJECT_ROOT/.claude/audit.jsonl"

PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
PERIOD="weekly"
FORMAT="markdown"
DRY_RUN=false
REPORT_DATE=$(date +%Y-%m-%d)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $(date '+%H:%M:%S') $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $(date '+%H:%M:%S') $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $(date '+%H:%M:%S') $1"; }

log_audit() {
  local action="$1"
  local detail="$2"
  echo "{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"dora-report-v2\",\"action\":\"$action\",\"detail\":\"$detail\",\"csap_ref\":\"D-06\"}" >> "$AUDIT_LOG" 2>/dev/null || true
}

usage() {
  cat <<'USAGE'
사용법: generate-dora-report-v2.sh [옵션]

옵션:
  --period PERIOD    분석 기간: weekly (7일) 또는 monthly (30일)
  --date DATE        기준일 (기본: 오늘)
  --format FORMAT    출력 형식: markdown (기본) 또는 audit (감리 증빙)
  --output-dir DIR   출력 디렉토리
  --dry-run          API 없이 샘플 데이터
  -h, --help         도움말

DORA Four Keys:
  DF   배포 빈도 (Deployment Frequency)
  LT   변경 리드타임 (Lead Time for Changes)
  CFR  변경 실패율 (Change Failure Rate)
  MTTR 서비스 복구 시간 (Mean Time to Recovery)

등급 기준 (Google DORA Research):
  Elite  : DF>주3회, LT<1h, CFR<5%, MTTR<1h
  High   : DF>주1회, LT<1d, CFR<15%, MTTR<1d
  Medium : DF>월1회, LT<1w, CFR<30%, MTTR<1w
  Low    : DF<월1회, LT>1w, CFR>30%, MTTR>1w
USAGE
  exit 0
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --period)     PERIOD="$2"; shift 2 ;;
      --date)       REPORT_DATE="$2"; shift 2 ;;
      --format)     FORMAT="$2"; shift 2 ;;
      --output-dir) OUTPUT_DIR="$2"; shift 2 ;;
      --dry-run)    DRY_RUN=true; shift ;;
      -h|--help)    usage ;;
      *)            log_info "알 수 없는 옵션: $1"; usage ;;
    esac
  done
}

# --- Prometheus 쿼리 함수 ---
query_prometheus() {
  local query="$1"
  local default="${2:-0}"

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "$default"
    return
  fi

  local result
  result=$(curl -s --connect-timeout 5 --max-time 10 \
    "${PROMETHEUS_URL}/api/v1/query?query=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$query'))" 2>/dev/null || echo "$query")" \
    | jq -r '.data.result[0].value[1] // "'"$default"'"' 2>/dev/null) || result="$default"

  echo "$result"
}

# --- 등급 판정 함수 ---
get_grade_text() {
  local grade="$1"
  case "$grade" in
    1) echo "Elite" ;;
    2) echo "High" ;;
    3) echo "Medium" ;;
    4) echo "Low" ;;
    *) echo "Unknown" ;;
  esac
}

get_grade_emoji() {
  local grade="$1"
  case "$grade" in
    1) echo "[ELITE]" ;;
    2) echo "[HIGH]" ;;
    3) echo "[MEDIUM]" ;;
    4) echo "[LOW]" ;;
    *) echo "[?]" ;;
  esac
}

# --- 개선 권고 생성 ---
generate_recommendations() {
  local df_grade="$1"
  local lt_grade="$2"
  local cfr_grade="$3"
  local mttr_grade="$4"

  echo ""
  echo "## 개선 권고사항"
  echo ""

  if [[ "$df_grade" -ge 3 ]]; then
    echo "### 배포 빈도 (현재: $(get_grade_text "$df_grade"))"
    echo "- CI/CD 파이프라인 병목 분석 및 해소"
    echo "- 기능 플래그 도입으로 소규모 배포 장려"
    echo "- 모노레포 변경 감지 기반 선택적 배포 활용"
    echo ""
  fi

  if [[ "$lt_grade" -ge 3 ]]; then
    echo "### 변경 리드타임 (현재: $(get_grade_text "$lt_grade"))"
    echo "- 코드 리뷰 대기 시간 모니터링 및 SLA 설정"
    echo "- 빌드 캐시 최적화 (BuildKit, pnpm store)"
    echo "- 테스트 병렬화 강화"
    echo ""
  fi

  if [[ "$cfr_grade" -ge 3 ]]; then
    echo "### 변경 실패율 (현재: $(get_grade_text "$cfr_grade"))"
    echo "- 테스트 커버리지 80%+ 달성 (현재 Q-Gate G4 기준)"
    echo "- 카나리 배포 비율 확대 (10% -> 25%)"
    echo "- Pre-deploy 환경 검증 강화"
    echo ""
  fi

  if [[ "$mttr_grade" -ge 3 ]]; then
    echo "### MTTR (현재: $(get_grade_text "$mttr_grade"))"
    echo "- 런북 자동화 확대 (현재 SRE 런북 기반)"
    echo "- 자동 롤백 임계값 조정"
    echo "- 인시던트 에스컬레이션 프로세스 개선"
    echo ""
  fi
}

# --- 보고서 생성 ---
generate_report() {
  log_info "DORA Four Keys 보고서 생성 시작 (${PERIOD}, ${REPORT_DATE})"

  # 메트릭 수집
  local df_daily df_weekly df_monthly
  local lt_p50 lt_p90 lt_p99
  local cfr cfr_weekly
  local mttr_avg mttr_p50 mttr_p90
  local grade_df grade_lt grade_cfr grade_mttr grade_overall

  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "[DRY-RUN] 샘플 데이터 사용"
    df_daily="3.2"
    df_weekly="18"
    df_monthly="72"
    lt_p50="1800"
    lt_p90="5400"
    lt_p99="14400"
    cfr="8.5"
    cfr_weekly="7.2"
    mttr_avg="45"
    mttr_p50="30"
    mttr_p90="120"
    grade_df="1"
    grade_lt="2"
    grade_cfr="2"
    grade_mttr="1"
    grade_overall="2"
  else
    df_daily=$(query_prometheus "dora:deployment_frequency:daily" "0")
    df_weekly=$(query_prometheus "dora:deployment_frequency:weekly" "0")
    df_monthly=$(query_prometheus "dora:deployment_frequency:monthly" "0")
    lt_p50=$(query_prometheus "dora:lead_time:p50" "0")
    lt_p90=$(query_prometheus "dora:lead_time:p90" "0")
    lt_p99=$(query_prometheus "dora:lead_time:p99" "0")
    cfr=$(query_prometheus "dora:change_failure_rate:ratio" "0")
    cfr_weekly=$(query_prometheus "dora:change_failure_rate:weekly_ratio" "0")
    mttr_avg=$(query_prometheus "dora:mttr:avg_minutes" "0")
    mttr_p50=$(query_prometheus "dora:mttr:p50_minutes" "0")
    mttr_p90=$(query_prometheus "dora:mttr:p90_minutes" "0")
    grade_df=$(query_prometheus "dora:grade:deployment_frequency" "4")
    grade_lt=$(query_prometheus "dora:grade:lead_time" "4")
    grade_cfr=$(query_prometheus "dora:grade:change_failure_rate" "4")
    grade_mttr=$(query_prometheus "dora:grade:mttr" "4")
    grade_overall=$(query_prometheus "dora:grade:overall_score" "4")
  fi

  # 리드타임 분 변환
  local lt_p50_min lt_p90_min lt_p99_min
  lt_p50_min=$(echo "scale=1; ${lt_p50} / 60" | bc 2>/dev/null || echo "0")
  lt_p90_min=$(echo "scale=1; ${lt_p90} / 60" | bc 2>/dev/null || echo "0")
  lt_p99_min=$(echo "scale=1; ${lt_p99} / 60" | bc 2>/dev/null || echo "0")

  # 출력 디렉토리 생성
  mkdir -p "$OUTPUT_DIR"

  local report_file="${OUTPUT_DIR}/dora-${PERIOD}-${REPORT_DATE}.md"

  # 보고서 작성
  cat > "$report_file" <<EOF
# DORA Four Keys 보고서

> **기간**: ${PERIOD} | **기준일**: ${REPORT_DATE}
> **종합 등급**: $(get_grade_text "${grade_overall%%.*}") $(get_grade_emoji "${grade_overall%%.*}")
> **CSAP 참조**: D-06 (침해사고 관리 -- DevOps 성숙도 측정)
> **자동 생성**: scripts/generate-dora-report-v2.sh

---

## Four Keys 요약

| 메트릭 | 값 | 등급 | 기준 |
|--------|-----|------|------|
| **배포 빈도 (DF)** | 일 ${df_daily}회 / 주 ${df_weekly}회 / 월 ${df_monthly}회 | $(get_grade_text "${grade_df%%.*}") | Elite: >주3회 |
| **변경 리드타임 (LT)** | P50: ${lt_p50_min}분 / P90: ${lt_p90_min}분 / P99: ${lt_p99_min}분 | $(get_grade_text "${grade_lt%%.*}") | Elite: <1시간 |
| **변경 실패율 (CFR)** | 일간: ${cfr}% / 주간: ${cfr_weekly}% | $(get_grade_text "${grade_cfr%%.*}") | Elite: <5% |
| **MTTR** | 평균: ${mttr_avg}분 / P50: ${mttr_p50}분 / P90: ${mttr_p90}분 | $(get_grade_text "${grade_mttr%%.*}") | Elite: <1시간 |

## 등급 상세

| 등급 | DF | LT | CFR | MTTR |
|------|----|----|-----|------|
| **Elite** | 주 수회+ | <1시간 | <5% | <1시간 |
| **High** | 주 1~3회 | <1일 | 5~15% | <1일 |
| **Medium** | 월 1~4회 | <1주 | 15~30% | <1주 |
| **Low** | <월 1회 | >1주 | >30% | >1주 |

## 현재 등급 판정

- 배포 빈도: **$(get_grade_text "${grade_df%%.*}")** (주 ${df_weekly}회)
- 리드타임: **$(get_grade_text "${grade_lt%%.*}")** (P50 ${lt_p50_min}분)
- 변경 실패율: **$(get_grade_text "${grade_cfr%%.*}")** (${cfr}%)
- MTTR: **$(get_grade_text "${grade_mttr%%.*}")** (평균 ${mttr_avg}분)
- **종합: $(get_grade_text "${grade_overall%%.*}")**

$(generate_recommendations "${grade_df%%.*}" "${grade_lt%%.*}" "${grade_cfr%%.*}" "${grade_mttr%%.*}")

---

## CSAP D-06 감리 증빙

본 보고서는 CSAP D-06 (침해사고 관리) 준수를 위한 DevOps 성숙도 정량 측정 증빙입니다.

- **측정 도구**: Prometheus Recording Rules + Grafana 대시보드
- **데이터 소스**: CI/CD 파이프라인 (Gitea Actions) + Kubernetes 메트릭
- **측정 주기**: ${PERIOD} (자동 생성)
- **대시보드**: Grafana /d/dora-four-keys
- **알림 규칙**: dora-alerting-rules-v2.yaml (10개 규칙)

---

*보고서 생성: $(date -u +"%Y-%m-%dT%H:%M:%SZ") | generate-dora-report-v2.sh*
EOF

  log_success "보고서 생성 완료: ${report_file}"
  log_audit "DORA_REPORT_GENERATED" "period=${PERIOD},date=${REPORT_DATE},grade=$(get_grade_text "${grade_overall%%.*}"),file=${report_file}"

  # 콘솔 요약 출력
  echo ""
  echo -e "${BOLD}=== DORA Four Keys 요약 (${REPORT_DATE}) ===${NC}"
  echo -e "종합 등급: ${BOLD}$(get_grade_text "${grade_overall%%.*}")${NC}"
  echo -e "  DF:   일 ${df_daily}회 / 주 ${df_weekly}회 → $(get_grade_text "${grade_df%%.*}")"
  echo -e "  LT:   P50 ${lt_p50_min}분 / P90 ${lt_p90_min}분 → $(get_grade_text "${grade_lt%%.*}")"
  echo -e "  CFR:  ${cfr}% → $(get_grade_text "${grade_cfr%%.*}")"
  echo -e "  MTTR: 평균 ${mttr_avg}분 → $(get_grade_text "${grade_mttr%%.*}")"
  echo ""
}

# --- 감리 증빙 형식 ---
generate_audit_format() {
  log_info "감리 증빙 형식 보고서 생성"
  # 기본 보고서에 CSAP 섹션이 이미 포함되어 있음
  generate_report
  log_info "감리 증빙 형식: CSAP D-06 섹션 포함"
}

# --- 메인 ---
main() {
  parse_args "$@"

  case "$FORMAT" in
    markdown) generate_report ;;
    audit)    generate_audit_format ;;
    *)        log_warn "알 수 없는 형식: ${FORMAT}, markdown으로 대체"; generate_report ;;
  esac
}

main "$@"
