#!/usr/bin/env bash
# =============================================================================
# DORA 4대 메트릭 분석 및 보고서 생성
# Design Ref: MTU-N126 Design
# Plan SC: FR-N126.1, FR-N126.3, FR-N126.4
# CSAP: D-06(침해사고 관리 -- DevOps 성숙도 측정)
#
# 사용법:
#   ./scripts/generate-dora-report.sh                    # 주간 분석
#   ./scripts/generate-dora-report.sh --period monthly   # 월간 분석
#   ./scripts/generate-dora-report.sh --dry-run          # 샘플 데이터
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/docs/reports/dora-metrics"
AUDIT_LOG="$PROJECT_ROOT/.claude/audit.jsonl"

PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
PERIOD="weekly"
DRY_RUN=false
REPORT_DATE=$(date +%Y-%m-%d)

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
  local entry="{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"dora-metrics-analyzer\",\"action\":\"$action\",\"detail\":\"$detail\"}"
  echo "$entry" >> "$AUDIT_LOG" 2>/dev/null || true
}

usage() {
  cat <<'USAGE'
사용법: generate-dora-report.sh [옵션]

옵션:
  --period PERIOD    분석 기간: weekly (7일) 또는 monthly (30일)
  --date DATE        기준일 (기본: 오늘)
  --output-dir DIR   출력 디렉토리
  --dry-run          API 없이 샘플 데이터
  -h, --help         도움말

DORA 4대 메트릭:
  DF   배포 빈도 (Deployment Frequency)
  CLT  변경 리드 타임 (Change Lead Time)
  CFR  변경 실패율 (Change Failure Rate)
  MTTR 서비스 복구 시간 (Mean Time to Recovery)
USAGE
  exit 0
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --period)     PERIOD="$2"; shift 2 ;;
      --date)       REPORT_DATE="$2"; shift 2 ;;
      --output-dir) OUTPUT_DIR="$2"; shift 2 ;;
      --dry-run)    DRY_RUN=true; shift ;;
      -h|--help)    usage ;;
      *)            log_info "알 수 없는 옵션: $1"; usage ;;
    esac
  done

  if [[ ! "$PERIOD" =~ ^(weekly|monthly)$ ]]; then
    echo "기간은 weekly 또는 monthly여야 합니다"
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# 메트릭 수집 함수
# ---------------------------------------------------------------------------

# 배포 빈도 (Deployment Frequency)
get_deployment_frequency() {
  local days="$1"
  if [[ "$DRY_RUN" == true ]]; then
    echo "$((RANDOM % 20 + 3))"
    return
  fi
  curl -sf --max-time 10 \
    "${PROMETHEUS_URL}/api/v1/query?query=dora:deployment_frequency:weekly" \
    2>/dev/null | jq -r '.data.result[0].value[1] // "0"' 2>/dev/null || echo "0"
}

# 변경 리드 타임 (분)
get_change_lead_time() {
  if [[ "$DRY_RUN" == true ]]; then
    echo "$((RANDOM % 1400 + 60))"
    return
  fi
  curl -sf --max-time 10 \
    "${PROMETHEUS_URL}/api/v1/query?query=dora:change_lead_time:pipeline_duration_avg" \
    2>/dev/null | jq -r '.data.result[0].value[1] // "0"' 2>/dev/null || echo "0"
}

# 변경 실패율 (%)
get_change_failure_rate() {
  if [[ "$DRY_RUN" == true ]]; then
    echo "$((RANDOM % 20 + 1))"
    return
  fi
  curl -sf --max-time 10 \
    "${PROMETHEUS_URL}/api/v1/query?query=dora:change_failure_rate:ratio" \
    2>/dev/null | jq -r '.data.result[0].value[1] // "0"' 2>/dev/null || echo "0"
}

# MTTR (분)
get_mttr() {
  if [[ "$DRY_RUN" == true ]]; then
    echo "$((RANDOM % 120 + 10))"
    return
  fi
  curl -sf --max-time 10 \
    "${PROMETHEUS_URL}/api/v1/query?query=dora:mttr:p1_7d_avg" \
    2>/dev/null | jq -r '.data.result[0].value[1] // "0"' 2>/dev/null || echo "0"
}

# ---------------------------------------------------------------------------
# DORA 등급 판정 (FR-N126.4)
# ---------------------------------------------------------------------------
classify_deployment_frequency() {
  local deploys="$1"
  local days="$2"
  local daily_avg=0
  if [[ "$days" -gt 0 ]]; then
    daily_avg=$((deploys / days))
  fi

  if [[ "$daily_avg" -ge 1 ]]; then
    echo "Elite"
  elif [[ "$deploys" -ge "$days" ]]; then
    echo "Elite"
  elif [[ "$deploys" -ge 1 ]]; then
    local weekly_avg=$((deploys * 7 / days))
    if [[ "$weekly_avg" -ge 1 ]]; then
      echo "High"
    else
      echo "Medium"
    fi
  else
    echo "Low"
  fi
}

classify_lead_time() {
  local minutes="$1"
  if [[ "$minutes" -lt 1440 ]]; then
    echo "Elite"
  elif [[ "$minutes" -lt 10080 ]]; then
    echo "High"
  elif [[ "$minutes" -lt 262800 ]]; then
    echo "Medium"
  else
    echo "Low"
  fi
}

classify_change_failure_rate() {
  local rate="$1"
  if [[ "$rate" -lt 5 ]]; then
    echo "Elite"
  elif [[ "$rate" -lt 10 ]]; then
    echo "High"
  elif [[ "$rate" -lt 15 ]]; then
    echo "Medium"
  else
    echo "Low"
  fi
}

classify_mttr() {
  local minutes="$1"
  if [[ "$minutes" -lt 60 ]]; then
    echo "Elite"
  elif [[ "$minutes" -lt 1440 ]]; then
    echo "High"
  elif [[ "$minutes" -lt 10080 ]]; then
    echo "Medium"
  else
    echo "Low"
  fi
}

# 종합 DORA 등급 (4개 중 최하위)
classify_overall() {
  local df_grade="$1"
  local clt_grade="$2"
  local cfr_grade="$3"
  local mttr_grade="$4"

  local lowest="Elite"
  for grade in "$df_grade" "$clt_grade" "$cfr_grade" "$mttr_grade"; do
    case "$grade" in
      Low)    lowest="Low"; break ;;
      Medium) if [[ "$lowest" != "Low" ]]; then lowest="Medium"; fi ;;
      High)   if [[ "$lowest" == "Elite" ]]; then lowest="High"; fi ;;
    esac
  done
  echo "$lowest"
}

# ---------------------------------------------------------------------------
# 개선 권장 사항 (FR-N126.4)
# ---------------------------------------------------------------------------
generate_recommendations() {
  local df_grade="$1"
  local clt_grade="$2"
  local cfr_grade="$3"
  local mttr_grade="$4"
  local deploys="$5"
  local lead_time="$6"
  local cfr="$7"
  local mttr="$8"

  echo "### 개선 권장 사항"
  echo ""

  local idx=1

  if [[ "$df_grade" == "Low" || "$df_grade" == "Medium" ]]; then
    echo "${idx}. **배포 빈도 개선 필요** (현재: ${df_grade})"
    echo "   - CI/CD 파이프라인 자동화 강화"
    echo "   - 배포 승인 프로세스 간소화"
    echo "   - Feature flag를 활용한 trunk-based development 전환 검토"
    echo ""
    idx=$((idx + 1))
  fi

  if [[ "$clt_grade" == "Low" || "$clt_grade" == "Medium" ]]; then
    echo "${idx}. **변경 리드 타임 단축 필요** (현재: ${clt_grade}, ${lead_time}분)"
    echo "   - 빌드 시간 최적화 (캐시, 병렬 빌드)"
    echo "   - 코드 리뷰 SLA 설정 (24시간 이내)"
    echo "   - 테스트 병렬화 및 선택적 실행"
    echo ""
    idx=$((idx + 1))
  fi

  if [[ "$cfr_grade" == "Low" || "$cfr_grade" == "Medium" ]]; then
    echo "${idx}. **변경 실패율 감소 필요** (현재: ${cfr_grade}, ${cfr}%)"
    echo "   - 테스트 커버리지 80% 이상 확보"
    echo "   - Canary/Blue-Green 배포 전략 적용"
    echo "   - 스테이징 환경 정합성 개선"
    echo ""
    idx=$((idx + 1))
  fi

  if [[ "$mttr_grade" == "Low" || "$mttr_grade" == "Medium" ]]; then
    echo "${idx}. **MTTR 단축 필요** (현재: ${mttr_grade}, ${mttr}분)"
    echo "   - 자동화된 롤백 메커니즘 구축"
    echo "   - 인시던트 대응 Runbook 자동화"
    echo "   - 온콜 에스컬레이션 시간 단축"
    echo ""
    idx=$((idx + 1))
  fi

  if [[ "$idx" -eq 1 ]]; then
    echo "1. **모든 메트릭 양호**: 현재 수준 유지 및 지속 모니터링"
    echo "   - 주간 DORA 보고서 리뷰 체계 유지"
    echo "   - 각 메트릭 트렌드 변화 추적"
    echo ""
  fi
}

# ---------------------------------------------------------------------------
# 리드 타임을 사람이 읽기 쉬운 형태로 변환
# ---------------------------------------------------------------------------
format_duration() {
  local minutes="$1"
  if [[ "$minutes" -lt 60 ]]; then
    echo "${minutes}분"
  elif [[ "$minutes" -lt 1440 ]]; then
    local hours=$((minutes / 60))
    local remain=$((minutes % 60))
    echo "${hours}시간 ${remain}분"
  else
    local days=$((minutes / 1440))
    local remain_hours=$(( (minutes % 1440) / 60 ))
    echo "${days}일 ${remain_hours}시간"
  fi
}

# ---------------------------------------------------------------------------
# 보고서 생성 (FR-N126.3)
# ---------------------------------------------------------------------------
generate_report() {
  log_info "DORA 메트릭 분석 시작..."
  log_audit "DORA_ANALYSIS_START" "period=$PERIOD"

  mkdir -p "$OUTPUT_DIR"

  local days
  if [[ "$PERIOD" == "weekly" ]]; then
    days=7
  else
    days=30
  fi

  local period_ko
  if [[ "$PERIOD" == "weekly" ]]; then
    period_ko="주간"
  else
    period_ko="월간"
  fi

  # 메트릭 수집
  local deploys
  deploys=$(get_deployment_frequency "$days")
  local lead_time
  lead_time=$(get_change_lead_time)
  local cfr
  cfr=$(get_change_failure_rate)
  local mttr
  mttr=$(get_mttr)

  # 일간 평균 배포
  local daily_deploy_avg=0
  if [[ "$deploys" -gt 0 && "$days" -gt 0 ]]; then
    daily_deploy_avg=$(echo "scale=1; $deploys / $days" | bc 2>/dev/null || echo "0")
  fi

  # 등급 판정
  local df_grade
  df_grade=$(classify_deployment_frequency "$deploys" "$days")
  local clt_grade
  clt_grade=$(classify_lead_time "$lead_time")
  local cfr_grade
  cfr_grade=$(classify_change_failure_rate "$cfr")
  local mttr_grade
  mttr_grade=$(classify_mttr "$mttr")
  local overall_grade
  overall_grade=$(classify_overall "$df_grade" "$clt_grade" "$cfr_grade" "$mttr_grade")

  # 리드 타임 포맷
  local lead_time_formatted
  lead_time_formatted=$(format_duration "$lead_time")

  # MTTR 포맷
  local mttr_formatted
  mttr_formatted=$(format_duration "$mttr")

  # 권장 사항
  local recommendations
  recommendations=$(generate_recommendations "$df_grade" "$clt_grade" "$cfr_grade" "$mttr_grade" "$deploys" "$lead_time" "$cfr" "$mttr")

  local output_file="$OUTPUT_DIR/dora-${PERIOD}-${REPORT_DATE}.md"
  local generated_at
  generated_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  cat > "$output_file" << REPORT
# DORA 메트릭 ${period_ko} 분석 보고서

> CSAP: D-06(침해사고 관리 -- DevOps 성숙도 측정)
> 생성일: ${generated_at}
> 분석 기간: ${days}일 (${PERIOD})

---

## 1. 요약

| 항목 | 값 |
|------|------|
| 종합 DORA 등급 | **${overall_grade}** |
| 분석 기간 | ${days}일 |
| 데이터 소스 | ${DRY_RUN:+샘플 데이터}${DRY_RUN:-Prometheus API} |

---

## 2. DORA 4대 메트릭

| 메트릭 | 값 | 등급 | 목표 |
|--------|------|------|------|
| 배포 빈도 (DF) | ${deploys}회 (일평균 ${daily_deploy_avg}) | **${df_grade}** | Elite: 일 1회+ |
| 변경 리드 타임 (CLT) | ${lead_time_formatted} | **${clt_grade}** | Elite: < 1일 |
| 변경 실패율 (CFR) | ${cfr}% | **${cfr_grade}** | Elite: < 5% |
| 서비스 복구 시간 (MTTR) | ${mttr_formatted} | **${mttr_grade}** | Elite: < 1시간 |

---

## 3. DORA 등급 기준

| 등급 | DF | CLT | CFR | MTTR |
|------|------|------|------|------|
| Elite | 일 1회+ | < 1일 | < 5% | < 1시간 |
| High | 주 1회+ | 1~7일 | 5~10% | < 1일 |
| Medium | 월 1회+ | 1~6개월 | 10~15% | < 1주 |
| Low | 월 1회 미만 | 6개월+ | 15%+ | 1주+ |

---

## 4. 메트릭 상세 분석

### 4.1 배포 빈도 (Deployment Frequency)

- **기간 내 배포 횟수**: ${deploys}회
- **일간 평균**: ${daily_deploy_avg}회/일
- **등급**: ${df_grade}
- **의미**: 코드 변경이 프로덕션에 도달하는 빈도

### 4.2 변경 리드 타임 (Change Lead Time)

- **평균 리드 타임**: ${lead_time_formatted} (${lead_time}분)
- **등급**: ${clt_grade}
- **의미**: 커밋부터 프로덕션 배포까지 소요 시간

### 4.3 변경 실패율 (Change Failure Rate)

- **실패율**: ${cfr}%
- **등급**: ${cfr_grade}
- **의미**: 배포 후 롤백 또는 핫픽스가 필요한 비율

### 4.4 서비스 복구 시간 (MTTR)

- **평균 복구 시간**: ${mttr_formatted} (${mttr}분)
- **등급**: ${mttr_grade}
- **의미**: 장애 감지부터 서비스 복구까지 소요 시간

---

## 5. 개선 권장 사항

${recommendations}

---

## 6. 감사 추적

| 항목 | 내용 |
|------|------|
| 분석 도구 | \`scripts/generate-dora-report.sh\` |
| Recording Rule | \`infra/monitoring/dora-metrics-rules.yaml\` |
| 감사 로그 | \`.claude/audit.jsonl\` |
| DORA 참조 | Accelerate: State of DevOps Report |

---

> 이 보고서는 scripts/generate-dora-report.sh에 의해 자동 생성되었습니다.
REPORT

  log_success "DORA 메트릭 보고서 생성 완료: $output_file"
  log_audit "DORA_ANALYSIS_COMPLETE" "output=$output_file overall_grade=$overall_grade"

  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  DORA 메트릭 ${period_ko} 분석 완료${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo -e "  종합 등급:    ${overall_grade}"
  echo -e "  배포 빈도:    ${deploys}회 (${df_grade})"
  echo -e "  리드 타임:    ${lead_time_formatted} (${clt_grade})"
  echo -e "  실패율:       ${cfr}% (${cfr_grade})"
  echo -e "  MTTR:         ${mttr_formatted} (${mttr_grade})"
  echo -e "  출력 파일:    ${GREEN}${output_file}${NC}"
  echo -e "${CYAN}========================================${NC}"
}

main() {
  parse_args "$@"
  generate_report
}

main "$@"
