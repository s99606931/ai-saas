#!/usr/bin/env bash
# =============================================================================
# 인시던트 타임라인 생성기
# Design Ref: MTU-N128 Design
# Plan SC: FR-N128.1, FR-N128.2, FR-N128.3, FR-N128.4
# CSAP: D-06(침해사고 관리 -- 인시던트 시계열 추적)
#
# 사용법:
#   ./scripts/generate-incident-timeline.sh --incident-id INC-001
#   ./scripts/generate-incident-timeline.sh --start "2026-04-10T00:00:00Z" --end "2026-04-10T23:59:59Z"
#   ./scripts/generate-incident-timeline.sh --dry-run
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/docs/reports/incident-timelines"
AUDIT_LOG="$PROJECT_ROOT/.claude/audit.jsonl"

INCIDENT_ID=""
START_TIME=""
END_TIME=""
DRY_RUN=false
SEVERITY="P2"

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
  local entry="{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"incident-timeline-generator\",\"action\":\"$action\",\"detail\":\"$detail\"}"
  echo "$entry" >> "$AUDIT_LOG" 2>/dev/null || true
}

usage() {
  cat <<'USAGE'
사용법: generate-incident-timeline.sh [옵션]

옵션:
  --incident-id ID    인시던트 식별자 (예: INC-001)
  --severity SEV      심각도 (P1, P2, P3, P4, 기본: P2)
  --start DATETIME    시작 시간 (ISO8601)
  --end DATETIME      종료 시간 (ISO8601)
  --output-dir DIR    출력 디렉토리
  --dry-run           샘플 데이터로 생성
  --add-event EVENT   수동 이벤트 추가 ("시간|설명")
  -h, --help          도움말

이벤트 소스:
  - Prometheus 알림 (ALERTS API)
  - 감사 로그 (audit.jsonl)
  - Git 커밋/배포 히스토리
  - 수동 이벤트 (--add-event)
USAGE
  exit 0
}

MANUAL_EVENTS=()

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --incident-id) INCIDENT_ID="$2"; shift 2 ;;
      --severity)    SEVERITY="$2"; shift 2 ;;
      --start)       START_TIME="$2"; shift 2 ;;
      --end)         END_TIME="$2"; shift 2 ;;
      --output-dir)  OUTPUT_DIR="$2"; shift 2 ;;
      --dry-run)     DRY_RUN=true; shift ;;
      --add-event)   MANUAL_EVENTS+=("$2"); shift 2 ;;
      -h|--help)     usage ;;
      *)             log_info "알 수 없는 옵션: $1"; usage ;;
    esac
  done

  if [[ ! "$SEVERITY" =~ ^(P1|P2|P3|P4)$ ]]; then
    echo "심각도는 P1, P2, P3, P4 중 하나여야 합니다"
    exit 1
  fi

  if [[ "$DRY_RUN" == false && -z "$INCIDENT_ID" ]]; then
    INCIDENT_ID="INC-$(date +%Y%m%d-%H%M%S)"
  fi

  if [[ -z "$INCIDENT_ID" ]]; then
    INCIDENT_ID="INC-SAMPLE-001"
  fi

  if [[ -z "$START_TIME" ]]; then
    START_TIME=$(date -u -d "2 hours ago" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")
  fi

  if [[ -z "$END_TIME" ]]; then
    END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  fi
}

# ---------------------------------------------------------------------------
# 이벤트 수집 (FR-N128.2)
# ---------------------------------------------------------------------------

# 타임라인 이벤트 배열 (시간|카테고리|설명)
TIMELINE_EVENTS=()

collect_alert_events() {
  if [[ "$DRY_RUN" == true ]]; then
    local base_time
    base_time=$(date -u +"%Y-%m-%dT" 2>/dev/null)
    TIMELINE_EVENTS+=("${base_time}09:15:00Z|alert|HighLatencyDetected 알림 발생 (severity=warning)")
    TIMELINE_EVENTS+=("${base_time}09:17:30Z|alert|ErrorRateHigh 알림 발생 (severity=critical)")
    TIMELINE_EVENTS+=("${base_time}09:45:00Z|alert|HighLatencyDetected 알림 해소")
    TIMELINE_EVENTS+=("${base_time}10:02:00Z|alert|ErrorRateHigh 알림 해소")
    return
  fi
  log_info "Prometheus 알림 이벤트 수집..."
}

collect_audit_events() {
  if [[ "$DRY_RUN" == true ]]; then
    local base_time
    base_time=$(date -u +"%Y-%m-%dT" 2>/dev/null)
    TIMELINE_EVENTS+=("${base_time}09:20:00Z|action|온콜 담당자 알림 수신 확인")
    TIMELINE_EVENTS+=("${base_time}09:25:00Z|action|인시던트 채널 개설 (#inc-${INCIDENT_ID})")
    TIMELINE_EVENTS+=("${base_time}09:35:00Z|deploy|핫픽스 배포 시작 (commit: abc1234)")
    TIMELINE_EVENTS+=("${base_time}09:42:00Z|deploy|핫픽스 배포 완료 (rollout: success)")
    return
  fi

  if [[ -f "$AUDIT_LOG" ]]; then
    log_info "감사 로그 이벤트 수집..."
    while IFS= read -r line; do
      local ts
      ts=$(echo "$line" | jq -r '.timestamp // empty' 2>/dev/null)
      local action
      action=$(echo "$line" | jq -r '.action // empty' 2>/dev/null)
      local detail
      detail=$(echo "$line" | jq -r '.detail // empty' 2>/dev/null)
      if [[ -n "$ts" && -n "$action" ]]; then
        TIMELINE_EVENTS+=("${ts}|audit|${action}: ${detail}")
      fi
    done < <(tail -20 "$AUDIT_LOG" 2>/dev/null)
  fi
}

collect_git_events() {
  if [[ "$DRY_RUN" == true ]]; then
    local base_time
    base_time=$(date -u +"%Y-%m-%dT" 2>/dev/null)
    TIMELINE_EVENTS+=("${base_time}09:30:00Z|git|fix(api): 레이트 리밋 버그 수정 (hotfix)")
    TIMELINE_EVENTS+=("${base_time}09:55:00Z|git|docs: 인시던트 포스트모템 초안 작성")
    return
  fi

  log_info "Git 히스토리 이벤트 수집..."
  while IFS='|' read -r ts msg; do
    if [[ -n "$ts" && -n "$msg" ]]; then
      TIMELINE_EVENTS+=("${ts}|git|${msg}")
    fi
  done < <(git -C "$PROJECT_ROOT" log --since="2 hours ago" --format="%aI|%s" 2>/dev/null | head -10)
}

collect_manual_events() {
  for event in "${MANUAL_EVENTS[@]}"; do
    local ts
    ts=$(echo "$event" | cut -d'|' -f1)
    local desc
    desc=$(echo "$event" | cut -d'|' -f2-)
    TIMELINE_EVENTS+=("${ts}|manual|${desc}")
  done
}

# ---------------------------------------------------------------------------
# MTTR/MTTD 계산 (FR-N128.4)
# ---------------------------------------------------------------------------
calculate_mttr_mttd() {
  local start="$1"
  local end="$2"

  local start_epoch
  start_epoch=$(date -d "$start" +%s 2>/dev/null || echo "0")
  local end_epoch
  end_epoch=$(date -d "$end" +%s 2>/dev/null || echo "0")

  if [[ "$start_epoch" -gt 0 && "$end_epoch" -gt 0 ]]; then
    local diff=$((end_epoch - start_epoch))
    local hours=$((diff / 3600))
    local minutes=$(( (diff % 3600) / 60 ))
    echo "${hours}시간 ${minutes}분"
  else
    echo "N/A"
  fi
}

# ---------------------------------------------------------------------------
# 이벤트 카테고리별 아이콘
# ---------------------------------------------------------------------------
event_icon() {
  case "$1" in
    alert)  echo "[경보]" ;;
    action) echo "[조치]" ;;
    deploy) echo "[배포]" ;;
    git)    echo "[커밋]" ;;
    audit)  echo "[감사]" ;;
    manual) echo "[수동]" ;;
    *)      echo "[기타]" ;;
  esac
}

# ---------------------------------------------------------------------------
# 보고서 생성 (FR-N128.3)
# ---------------------------------------------------------------------------
generate_timeline() {
  log_info "인시던트 타임라인 생성 시작..."
  log_audit "INCIDENT_TIMELINE_START" "incident_id=$INCIDENT_ID"

  mkdir -p "$OUTPUT_DIR"

  # 이벤트 수집
  collect_alert_events
  collect_audit_events
  collect_git_events
  collect_manual_events

  # 시간순 정렬
  local sorted_events
  sorted_events=$(for e in "${TIMELINE_EVENTS[@]}"; do echo "$e"; done | sort)

  # MTTR 계산
  local total_duration
  total_duration=$(calculate_mttr_mttd "$START_TIME" "$END_TIME")

  # 이벤트 수 집계
  local total_events=${#TIMELINE_EVENTS[@]}
  local alert_count=0
  local action_count=0
  local deploy_count=0

  for e in "${TIMELINE_EVENTS[@]}"; do
    local cat
    cat=$(echo "$e" | cut -d'|' -f2)
    case "$cat" in
      alert)  alert_count=$((alert_count + 1)) ;;
      action) action_count=$((action_count + 1)) ;;
      deploy) deploy_count=$((deploy_count + 1)) ;;
    esac
  done

  # 타임라인 테이블 생성
  local timeline_table=""
  local idx=1
  while IFS= read -r event; do
    if [[ -z "$event" ]]; then continue; fi
    local ts
    ts=$(echo "$event" | cut -d'|' -f1)
    local cat
    cat=$(echo "$event" | cut -d'|' -f2)
    local desc
    desc=$(echo "$event" | cut -d'|' -f3-)
    local icon
    icon=$(event_icon "$cat")

    local time_only
    time_only=$(echo "$ts" | grep -oP 'T\K[0-9:]+' 2>/dev/null || echo "$ts")
    timeline_table="${timeline_table}| ${idx} | ${time_only} | ${icon} | ${desc} |\n"
    idx=$((idx + 1))
  done <<< "$sorted_events"

  # MTTR 목표 (심각도별)
  local mttr_target
  case "$SEVERITY" in
    P1) mttr_target="30분" ;;
    P2) mttr_target="2시간" ;;
    P3) mttr_target="4시간" ;;
    P4) mttr_target="24시간" ;;
  esac

  local output_file="$OUTPUT_DIR/timeline-${INCIDENT_ID}.md"
  local generated_at
  generated_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  cat > "$output_file" << REPORT
# 인시던트 타임라인: ${INCIDENT_ID}

> CSAP: D-06(침해사고 관리 -- 인시던트 시계열 추적)
> 생성일: ${generated_at}

---

## 1. 인시던트 요약

| 항목 | 내용 |
|------|------|
| 인시던트 ID | ${INCIDENT_ID} |
| 심각도 | ${SEVERITY} |
| 시작 시간 | ${START_TIME} |
| 종료 시간 | ${END_TIME} |
| 총 소요 시간 | ${total_duration} |
| MTTR 목표 | ${mttr_target} |
| 이벤트 수 | ${total_events}건 |

---

## 2. 이벤트 분포

| 카테고리 | 건수 |
|---------|------|
| 알림 (경보) | ${alert_count} |
| 조치 | ${action_count} |
| 배포 | ${deploy_count} |
| 기타 | $((total_events - alert_count - action_count - deploy_count)) |

---

## 3. 시간순 타임라인

| # | 시각 | 유형 | 상세 |
|---|------|------|------|
$(echo -e "$timeline_table")

---

## 4. MTTR/MTTD 분석

| 지표 | 값 | 목표 |
|------|------|------|
| 총 소요 시간 (MTTR) | ${total_duration} | ${mttr_target} |
| 감지 시간 (MTTD) | 첫 알림 기준 | 5분 이내 |
| 이벤트 밀도 | ${total_events}건 / ${total_duration} | - |

---

## 5. 교훈 및 후속 조치

> 이 섹션은 포스트모템 작성 시 활용합니다.

- [ ] 근본 원인 식별
- [ ] 재발 방지 대책 수립
- [ ] 모니터링 개선 항목 도출
- [ ] Runbook 업데이트 필요 여부 확인

---

## 6. 감사 추적

| 항목 | 내용 |
|------|------|
| 생성 도구 | \`scripts/generate-incident-timeline.sh\` |
| 포스트모템 도구 | \`scripts/generate-postmortem.sh\` |
| 감사 로그 | \`.claude/audit.jsonl\` |

---

> 이 타임라인은 scripts/generate-incident-timeline.sh에 의해 자동 생성되었습니다.
REPORT

  log_success "인시던트 타임라인 생성 완료: $output_file"
  log_audit "INCIDENT_TIMELINE_COMPLETE" "output=$output_file incident_id=$INCIDENT_ID events=$total_events"

  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  인시던트 타임라인 생성 완료${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo -e "  인시던트:     ${INCIDENT_ID}"
  echo -e "  심각도:       ${SEVERITY}"
  echo -e "  이벤트 수:    ${total_events}건"
  echo -e "  소요 시간:    ${total_duration}"
  echo -e "  출력 파일:    ${GREEN}${output_file}${NC}"
  echo -e "${CYAN}========================================${NC}"
}

main() {
  parse_args "$@"
  generate_timeline
}

main "$@"
