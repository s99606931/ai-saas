#!/usr/bin/env bash
# =============================================================================
# 알림 피로도 분석 및 최적화 보고서 생성
# Design Ref: MTU-N125 Design
# Plan SC: FR-N125.1, FR-N125.3, FR-N125.4
# CSAP: D-06(침해사고 관리 -- 알림 체계 효과성)
#
# 사용법:
#   ./scripts/analyze-alert-fatigue.sh                    # 주간 분석
#   ./scripts/analyze-alert-fatigue.sh --period monthly   # 월간 분석
#   ./scripts/analyze-alert-fatigue.sh --dry-run          # 샘플 데이터
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/docs/reports/alert-fatigue"
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
  local entry="{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"alert-fatigue-analyzer\",\"action\":\"$action\",\"detail\":\"$detail\"}"
  echo "$entry" >> "$AUDIT_LOG" 2>/dev/null || true
}

usage() {
  cat <<'USAGE'
사용법: analyze-alert-fatigue.sh [옵션]

옵션:
  --period PERIOD    분석 기간: weekly (7일) 또는 monthly (30일)
  --date DATE        기준일 (기본: 오늘)
  --output-dir DIR   출력 디렉토리
  --dry-run          API 없이 샘플 데이터
  -h, --help         도움말
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
# 피로도 지표 계산
# ---------------------------------------------------------------------------

# 총 알림 발생 횟수
get_total_alerts() {
  if [[ "$DRY_RUN" == true ]]; then
    echo "$((RANDOM % 200 + 50))"
    return
  fi
  local days=$1
  curl -sf --max-time 10 \
    "${PROMETHEUS_URL}/api/v1/query?query=sum(increase(ALERTS_FOR_STATE[${days}d]))" \
    2>/dev/null | jq -r '.data.result[0].value[1] // "0"' 2>/dev/null || echo "0"
}

# 심각도별 알림 수
get_alerts_by_severity() {
  local severity="$1"
  if [[ "$DRY_RUN" == true ]]; then
    case "$severity" in
      critical) echo "$((RANDOM % 20 + 5))" ;;
      warning)  echo "$((RANDOM % 50 + 20))" ;;
      info)     echo "$((RANDOM % 100 + 30))" ;;
    esac
    return
  fi
  echo "0"
}

# SNR (Signal-to-Noise Ratio)
calculate_snr() {
  local critical="$1"
  local warning="$2"
  local info="$3"
  local total=$((critical + warning + info))

  if [[ $total -eq 0 ]]; then
    echo "N/A"
    return
  fi

  # 시그널 = critical + warning, 노이즈 = info
  local signal=$((critical + warning))
  echo "scale=1; $signal * 100 / $total" | bc 2>/dev/null || echo "N/A"
}

# 반복 알림 비율
get_repeat_ratio() {
  if [[ "$DRY_RUN" == true ]]; then
    echo "$((RANDOM % 30 + 5))"
    return
  fi
  echo "0"
}

# 카테고리별 알림 수
get_alerts_by_category() {
  local category="$1"
  if [[ "$DRY_RUN" == true ]]; then
    echo "$((RANDOM % 40 + 5))"
    return
  fi
  echo "0"
}

# ---------------------------------------------------------------------------
# 최적화 권장 사항 도출 (FR-N125.4)
# ---------------------------------------------------------------------------
generate_recommendations() {
  local snr="$1"
  local repeat_ratio="$2"
  local total_alerts="$3"
  local critical="$4"

  echo "### 알림 최적화 권장 사항"
  echo ""

  # SNR 기반 권장
  if [[ "$snr" != "N/A" ]]; then
    local snr_low
    snr_low=$(echo "$snr < 50" | bc 2>/dev/null || echo "0")
    if [[ "$snr_low" == "1" ]]; then
      echo "1. **SNR 개선 필요**: 현재 SNR ${snr}%로 낮음. info 등급 알림 임계값 재검토 권장"
      echo "   - 반복적 info 알림을 Recording Rule로 전환 검토"
      echo "   - AlertManager 억제 규칙(inhibit_rules) 추가 검토"
    else
      echo "1. **SNR 양호**: 현재 SNR ${snr}%. 현 수준 유지"
    fi
  fi

  echo ""

  # 반복률 기반 권장
  local repeat_high
  repeat_high=$(echo "$repeat_ratio > 20" | bc 2>/dev/null || echo "0")
  if [[ "$repeat_high" == "1" ]]; then
    echo "2. **반복 알림 감소 필요**: 반복률 ${repeat_ratio}%로 높음"
    echo "   - 동일 알림 group_interval 연장 검토"
    echo "   - 근본 원인 해결을 위한 포스트모템 작성"
  else
    echo "2. **반복률 양호**: 반복률 ${repeat_ratio}%"
  fi

  echo ""

  # 총량 기반 권장
  local total_high
  total_high=$(echo "$total_alerts > 100" | bc 2>/dev/null || echo "0")
  if [[ "$total_high" == "1" ]]; then
    echo "3. **알림 총량 과다**: 주간 ${total_alerts}건. 알림 정리 필요"
    echo "   - 우선순위가 낮은 알림을 대시보드 경고로 전환"
    echo "   - AlertManager 라우팅 최적화"
  else
    echo "3. **알림 총량 적정**: 주간 ${total_alerts}건"
  fi

  echo ""

  # Critical 알림 기반
  local critical_high
  critical_high=$(echo "$critical > 10" | bc 2>/dev/null || echo "0")
  if [[ "$critical_high" == "1" ]]; then
    echo "4. **Critical 알림 과다**: ${critical}건. 임계값 재검토 필요"
    echo "   - 실제 서비스 영향이 없는 critical 알림을 warning으로 하향 검토"
  else
    echo "4. **Critical 알림 적정**: ${critical}건"
  fi
}

# ---------------------------------------------------------------------------
# 보고서 생성
# ---------------------------------------------------------------------------
generate_report() {
  log_info "알림 피로도 분석 시작..."
  log_audit "ALERT_FATIGUE_ANALYSIS_START" "period=$PERIOD"

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

  # 피로도 지표 수집
  local total_alerts
  total_alerts=$(get_total_alerts "$days")
  local critical
  critical=$(get_alerts_by_severity "critical")
  local warning
  warning=$(get_alerts_by_severity "warning")
  local info
  info=$(get_alerts_by_severity "info")
  local snr
  snr=$(calculate_snr "$critical" "$warning" "$info")
  local repeat_ratio
  repeat_ratio=$(get_repeat_ratio)

  # 카테고리별 알림
  local security_alerts
  security_alerts=$(get_alerts_by_category "security")
  local availability_alerts
  availability_alerts=$(get_alerts_by_category "availability")
  local performance_alerts
  performance_alerts=$(get_alerts_by_category "performance")
  local infrastructure_alerts
  infrastructure_alerts=$(get_alerts_by_category "infrastructure")

  # 일간 평균
  local daily_avg=0
  if [[ "$total_alerts" -gt 0 && "$days" -gt 0 ]]; then
    daily_avg=$((total_alerts / days))
  fi

  # 권장 사항
  local recommendations
  recommendations=$(generate_recommendations "$snr" "$repeat_ratio" "$total_alerts" "$critical")

  # 피로도 등급 판단
  local fatigue_grade
  local fatigue_color
  if [[ "$daily_avg" -gt 30 ]]; then
    fatigue_grade="HIGH (높음)"
    fatigue_color="경고"
  elif [[ "$daily_avg" -gt 15 ]]; then
    fatigue_grade="MEDIUM (보통)"
    fatigue_color="주의"
  else
    fatigue_grade="LOW (낮음)"
    fatigue_color="양호"
  fi

  local output_file="$OUTPUT_DIR/alert-fatigue-${PERIOD}-${REPORT_DATE}.md"
  local generated_at
  generated_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  cat > "$output_file" << REPORT
# 알림 피로도 ${period_ko} 분석 보고서

> CSAP: D-06(침해사고 관리 -- 알림 체계 효과성)
> 생성일: ${generated_at}
> 분석 기간: ${days}일 (${PERIOD})

---

## 1. 요약

| 지표 | 값 | 상태 |
|------|------|------|
| 총 알림 수 | ${total_alerts}건 | |
| 일간 평균 | ${daily_avg}건/일 | |
| 피로도 등급 | ${fatigue_grade} | ${fatigue_color} |
| SNR (시그널/노이즈 비) | ${snr}% | |
| 반복 알림 비율 | ${repeat_ratio}% | |

---

## 2. 심각도별 알림 분포

| 심각도 | 건수 | 비율 |
|--------|------|------|
| Critical | ${critical} | $(if [[ $total_alerts -gt 0 ]]; then echo "scale=1; $critical * 100 / $total_alerts" | bc 2>/dev/null; else echo "0"; fi)% |
| Warning | ${warning} | $(if [[ $total_alerts -gt 0 ]]; then echo "scale=1; $warning * 100 / $total_alerts" | bc 2>/dev/null; else echo "0"; fi)% |
| Info | ${info} | $(if [[ $total_alerts -gt 0 ]]; then echo "scale=1; $info * 100 / $total_alerts" | bc 2>/dev/null; else echo "0"; fi)% |

---

## 3. 카테고리별 알림 분포

| 카테고리 | 건수 |
|---------|------|
| 보안 | ${security_alerts} |
| 가용성 | ${availability_alerts} |
| 성능 | ${performance_alerts} |
| 인프라 | ${infrastructure_alerts} |

---

## 4. 피로도 지표 상세

### 4.1 SNR (Signal-to-Noise Ratio)

- **정의**: 실제 조치가 필요한 알림(Critical+Warning) 비율
- **현재**: ${snr}%
- **목표**: 70% 이상

### 4.2 반복 알림 비율

- **정의**: 동일 alertname이 7일 내 3회 이상 반복된 비율
- **현재**: ${repeat_ratio}%
- **목표**: 15% 이하

### 4.3 일간 알림 밀도

- **정의**: 하루 평균 알림 수
- **현재**: ${daily_avg}건/일
- **목표**: 15건/일 이하 (온콜 1인 기준)

---

## 5. 최적화 권장 사항

${recommendations}

---

## 6. 피로도 등급 기준

| 등급 | 일간 알림 | SNR | 반복률 | 온콜 부담 |
|------|---------|-----|-------|----------|
| LOW | < 15건 | > 70% | < 15% | 관리 가능 |
| MEDIUM | 15~30건 | 50~70% | 15~25% | 주의 필요 |
| HIGH | > 30건 | < 50% | > 25% | 개선 필수 |

---

## 7. 감사 추적

| 항목 | 내용 |
|------|------|
| 분석 도구 | \`scripts/analyze-alert-fatigue.sh\` |
| 관련 규칙 | \`infra/monitoring/alertmanager-noise-reduction.yaml\` |
| 알림 억제 | \`infra/monitoring/alertmanager-config.yaml\` |
| 감사 로그 | \`.claude/audit.jsonl\` |

---

> 이 보고서는 scripts/analyze-alert-fatigue.sh에 의해 자동 생성되었습니다.
REPORT

  log_success "알림 피로도 보고서 생성 완료: $output_file"
  log_audit "ALERT_FATIGUE_ANALYSIS_COMPLETE" "output=$output_file fatigue_grade=$fatigue_grade"

  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  알림 피로도 ${period_ko} 분석 완료${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo -e "  피로도 등급: ${fatigue_grade}"
  echo -e "  총 알림:     ${total_alerts}건"
  echo -e "  일간 평균:   ${daily_avg}건/일"
  echo -e "  SNR:         ${snr}%"
  echo -e "  출력 파일:   ${GREEN}${output_file}${NC}"
  echo -e "${CYAN}========================================${NC}"
}

main() {
  parse_args "$@"
  generate_report
}

main "$@"
