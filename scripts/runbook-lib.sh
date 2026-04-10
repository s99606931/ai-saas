#!/usr/bin/env bash
# =============================================================================
# Runbook 자동화 공통 라이브러리
# Design Ref: MTU-N94 Design §2.1
# Plan SC: FR-N94.6
# CSAP: D-06(인시던트 진단 감사 로그)
#
# 사용법: source scripts/runbook-lib.sh
# =============================================================================

# ---------------------------------------------------------------------------
# 전역 변수
# ---------------------------------------------------------------------------
RUNBOOK_NAME="${RUNBOOK_NAME:-unknown}"
RUNBOOK_START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
RUNBOOK_RESULTS=()
RUNBOOK_ACTIONS=()
AUDIT_LOG="${AUDIT_LOG:-.claude/audit.jsonl}"

# ---------------------------------------------------------------------------
# 색상 코드
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ---------------------------------------------------------------------------
# 로깅 함수
# ---------------------------------------------------------------------------
log_info() {
  echo -e "${BLUE}[INFO]${NC} $(date '+%H:%M:%S') $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $(date '+%H:%M:%S') $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $1"
}

log_success() {
  echo -e "${GREEN}[OK]${NC} $(date '+%H:%M:%S') $1"
}

# ---------------------------------------------------------------------------
# 진단 결과 수집
# ---------------------------------------------------------------------------
add_finding() {
  local category="$1"
  local severity="$2"
  local message="$3"
  RUNBOOK_RESULTS+=("{\"category\":\"$category\",\"severity\":\"$severity\",\"message\":\"$message\"}")
}

add_action() {
  local action_type="$1"
  local description="$2"
  local status="$3"
  RUNBOOK_ACTIONS+=("{\"type\":\"$action_type\",\"description\":\"$description\",\"status\":\"$status\"}")
}

# ---------------------------------------------------------------------------
# kubectl 안전 래퍼 (읽기 전용 명령만 허용)
# ---------------------------------------------------------------------------
safe_kubectl() {
  local cmd="$1"
  shift

  # 위험 명령 차단
  case "$cmd" in
    delete|patch|apply|replace|edit|scale)
      log_error "위험 명령 차단: kubectl $cmd (자동 Runbook에서 금지)"
      return 1
      ;;
  esac

  kubectl "$cmd" "$@" 2>/dev/null
}

# ---------------------------------------------------------------------------
# 진단 완료 시 JSON 결과 출력
# ---------------------------------------------------------------------------
output_diagnosis() {
  local root_cause="${1:-알 수 없음}"
  local recommendation="${2:-추가 조사 필요}"
  local auto_action_type="${3:-none}"
  local auto_action_reason="${4:-수동 승인 필요}"

  # 결과 배열을 JSON으로 변환
  local findings_json="["
  for i in "${!RUNBOOK_RESULTS[@]}"; do
    if [ "$i" -gt 0 ]; then findings_json+=","; fi
    findings_json+="${RUNBOOK_RESULTS[$i]}"
  done
  findings_json+="]"

  local actions_json="["
  for i in "${!RUNBOOK_ACTIONS[@]}"; do
    if [ "$i" -gt 0 ]; then actions_json+=","; fi
    actions_json+="${RUNBOOK_ACTIONS[$i]}"
  done
  actions_json+="]"

  cat <<EOF
{
  "runbook": "$RUNBOOK_NAME",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "started_at": "$RUNBOOK_START_TIME",
  "duration_seconds": $(($(date +%s) - $(date -d "$RUNBOOK_START_TIME" +%s 2>/dev/null || echo 0))),
  "diagnosis": {
    "root_cause": "$root_cause",
    "findings": $findings_json,
    "recommendation": "$recommendation"
  },
  "auto_actions": $actions_json,
  "auto_action_summary": {
    "type": "$auto_action_type",
    "reason": "$auto_action_reason"
  }
}
EOF
}

# ---------------------------------------------------------------------------
# 감사 로그 기록 (CSAP D-06)
# ---------------------------------------------------------------------------
log_audit() {
  local action="$1"
  local detail="$2"
  local entry="{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"actor\":\"runbook:$RUNBOOK_NAME\",\"action\":\"$action\",\"detail\":\"$detail\"}"
  echo "$entry" >> "$AUDIT_LOG" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# 섹션 구분선
# ---------------------------------------------------------------------------
section() {
  echo ""
  echo "================================================================"
  echo "  $1"
  echo "================================================================"
}
