#!/usr/bin/env bash
# =============================================================================
# DORA 이벤트 Push 스크립트
# Design Ref: MTU-N251 Design §3.1
# Plan SC: FR-N251.1
# CSAP: D-06(침해사고 관리), D-12(시스템 개발 보안)
#
# CI/CD 파이프라인에서 호출하여 DORA 메트릭을 Pushgateway로 전송
#
# 사용법:
#   ./scripts/dora-event-push.sh deploy --namespace prod --team platform --duration 300
#   ./scripts/dora-event-push.sh failure --namespace prod --team platform --reason "test-failure"
#   ./scripts/dora-event-push.sh rollback --namespace prod --team platform
#   ./scripts/dora-event-push.sh hotfix --namespace prod --team platform --duration 120
#   ./scripts/dora-event-push.sh incident-start --severity critical --team platform
#   ./scripts/dora-event-push.sh incident-end --severity critical --team platform --duration 3600
# =============================================================================

set -euo pipefail

# --- 설정 ---
PUSHGATEWAY_URL="${PUSHGATEWAY_URL:-http://pushgateway.monitoring.svc:9091}"
JOB_NAME="dora-four-keys"
AUDIT_LOG="${AUDIT_LOG:-/data/ai-saas/.claude/audit.jsonl}"

# --- 색상 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[DORA]${NC} $(date '+%H:%M:%S') $1"; }
log_success() { echo -e "${GREEN}[DORA]${NC} $(date '+%H:%M:%S') $1"; }
log_warn()    { echo -e "${YELLOW}[DORA]${NC} $(date '+%H:%M:%S') $1"; }
log_error()   { echo -e "${RED}[DORA]${NC} $(date '+%H:%M:%S') $1"; }

# --- 감사 로그 기록 ---
# Design Ref: §3.1 (CSAP D-06 감사 추적)
log_audit() {
  local action="$1"
  local detail="$2"
  local entry
  entry=$(cat <<EOF
{"timestamp":"$(date -u +"%Y-%m-%dT%H:%M:%SZ")","actor":"dora-event-push","action":"$action","detail":"$detail","csap_ref":"D-06"}
EOF
  )
  echo "$entry" >> "$AUDIT_LOG" 2>/dev/null || true
}

# --- 사용법 ---
usage() {
  cat <<'USAGE'
사용법: dora-event-push.sh <이벤트유형> [옵션]

이벤트 유형:
  deploy          배포 완료 이벤트
  failure         배포 실패 이벤트
  rollback        롤백 이벤트
  hotfix          핫픽스 배포 이벤트
  incident-start  인시던트 시작 이벤트
  incident-end    인시던트 종료 이벤트

옵션:
  --namespace NS    대상 네임스페이스 (기본: default)
  --team TEAM       팀 이름 (기본: platform)
  --duration SEC    소요 시간(초) (deploy/hotfix/incident-end)
  --severity SEV    심각도 (incident-start/end: critical, warning, info)
  --reason TEXT     실패 사유 (failure)
  --commit SHA      커밋 SHA (deploy)
  --dry-run         실제 전송 없이 확인만

환경변수:
  PUSHGATEWAY_URL   Pushgateway 주소 (기본: http://pushgateway.monitoring.svc:9091)

USAGE
  exit 0
}

# --- 인자 파싱 ---
EVENT_TYPE="${1:-}"
shift || true

NAMESPACE="default"
TEAM="platform"
DURATION="0"
SEVERITY="warning"
REASON="unknown"
COMMIT_SHA="unknown"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --namespace)  NAMESPACE="$2"; shift 2 ;;
    --team)       TEAM="$2"; shift 2 ;;
    --duration)   DURATION="$2"; shift 2 ;;
    --severity)   SEVERITY="$2"; shift 2 ;;
    --reason)     REASON="$2"; shift 2 ;;
    --commit)     COMMIT_SHA="$2"; shift 2 ;;
    --dry-run)    DRY_RUN=true; shift ;;
    -h|--help)    usage ;;
    *)            log_error "알 수 없는 옵션: $1"; usage ;;
  esac
done

if [[ -z "$EVENT_TYPE" ]]; then
  log_error "이벤트 유형을 지정하십시오."
  usage
fi

# --- 메트릭 전송 함수 ---
push_metrics() {
  local metrics="$1"
  local instance="$2"

  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "[DRY-RUN] 전송 대상: ${PUSHGATEWAY_URL}/metrics/job/${JOB_NAME}/instance/${instance}"
    echo "$metrics"
    return 0
  fi

  local response
  response=$(echo "$metrics" | curl -s -w "%{http_code}" \
    --data-binary @- \
    "${PUSHGATEWAY_URL}/metrics/job/${JOB_NAME}/instance/${instance}" 2>&1) || true

  local http_code="${response: -3}"
  if [[ "$http_code" == "200" || "$http_code" == "202" ]]; then
    log_success "메트릭 전송 성공 (HTTP ${http_code})"
    return 0
  else
    log_warn "Pushgateway 전송 실패 (HTTP ${http_code}) -- 로컬 기록만 수행"
    return 1
  fi
}

# --- 이벤트 처리 ---
case "$EVENT_TYPE" in
  deploy)
    log_info "배포 완료 이벤트: namespace=${NAMESPACE}, team=${TEAM}, duration=${DURATION}s"

    METRICS=$(cat <<EOF
# HELP dora_deployment_total 배포 횟수
# TYPE dora_deployment_total counter
dora_deployment_total{namespace="${NAMESPACE}",team="${TEAM}",type="normal",commit="${COMMIT_SHA}"} 1
# HELP dora_deployment_duration_seconds 배포 소요 시간
# TYPE dora_deployment_duration_seconds histogram
dora_deployment_duration_seconds_sum{namespace="${NAMESPACE}",team="${TEAM}"} ${DURATION}
dora_deployment_duration_seconds_count{namespace="${NAMESPACE}",team="${TEAM}"} 1
EOF
    )
    push_metrics "$METRICS" "deploy-${NAMESPACE}-$(date +%s)"
    log_audit "DORA_DEPLOY" "namespace=${NAMESPACE},team=${TEAM},duration=${DURATION}s,commit=${COMMIT_SHA}"
    ;;

  failure)
    log_info "배포 실패 이벤트: namespace=${NAMESPACE}, team=${TEAM}, reason=${REASON}"

    METRICS=$(cat <<EOF
# HELP dora_deployment_failure_total 실패 배포 횟수
# TYPE dora_deployment_failure_total counter
dora_deployment_failure_total{namespace="${NAMESPACE}",team="${TEAM}",reason="${REASON}"} 1
# HELP dora_deployment_total 배포 횟수 (실패 포함)
# TYPE dora_deployment_total counter
dora_deployment_total{namespace="${NAMESPACE}",team="${TEAM}",type="failure"} 1
EOF
    )
    push_metrics "$METRICS" "failure-${NAMESPACE}-$(date +%s)"
    log_audit "DORA_DEPLOY_FAILURE" "namespace=${NAMESPACE},team=${TEAM},reason=${REASON}"
    ;;

  rollback)
    log_info "롤백 이벤트: namespace=${NAMESPACE}, team=${TEAM}"

    METRICS=$(cat <<EOF
# HELP dora_deployment_total 배포 횟수 (롤백)
# TYPE dora_deployment_total counter
dora_deployment_total{namespace="${NAMESPACE}",team="${TEAM}",type="rollback"} 1
# HELP dora_deployment_failure_total 실패 배포 횟수
# TYPE dora_deployment_failure_total counter
dora_deployment_failure_total{namespace="${NAMESPACE}",team="${TEAM}",reason="rollback"} 1
EOF
    )
    push_metrics "$METRICS" "rollback-${NAMESPACE}-$(date +%s)"
    log_audit "DORA_ROLLBACK" "namespace=${NAMESPACE},team=${TEAM}"
    ;;

  hotfix)
    log_info "핫픽스 이벤트: namespace=${NAMESPACE}, team=${TEAM}, duration=${DURATION}s"

    METRICS=$(cat <<EOF
# HELP dora_deployment_total 배포 횟수 (핫픽스)
# TYPE dora_deployment_total counter
dora_deployment_total{namespace="${NAMESPACE}",team="${TEAM}",type="hotfix"} 1
# HELP dora_deployment_duration_seconds 배포 소요 시간
# TYPE dora_deployment_duration_seconds histogram
dora_deployment_duration_seconds_sum{namespace="${NAMESPACE}",team="${TEAM}"} ${DURATION}
dora_deployment_duration_seconds_count{namespace="${NAMESPACE}",team="${TEAM}"} 1
EOF
    )
    push_metrics "$METRICS" "hotfix-${NAMESPACE}-$(date +%s)"
    log_audit "DORA_HOTFIX" "namespace=${NAMESPACE},team=${TEAM},duration=${DURATION}s"
    ;;

  incident-start)
    log_info "인시던트 시작: severity=${SEVERITY}, team=${TEAM}"

    METRICS=$(cat <<EOF
# HELP dora_incident_created_total 인시던트 생성 횟수
# TYPE dora_incident_created_total counter
dora_incident_created_total{severity="${SEVERITY}",team="${TEAM}"} 1
EOF
    )
    push_metrics "$METRICS" "incident-start-$(date +%s)"
    log_audit "DORA_INCIDENT_START" "severity=${SEVERITY},team=${TEAM}"
    ;;

  incident-end)
    log_info "인시던트 종료: severity=${SEVERITY}, team=${TEAM}, duration=${DURATION}s"

    METRICS=$(cat <<EOF
# HELP dora_incident_resolved_total 인시던트 해결 횟수
# TYPE dora_incident_resolved_total counter
dora_incident_resolved_total{severity="${SEVERITY}",team="${TEAM}"} 1
# HELP dora_incident_duration_seconds 인시던트 지속 시간
# TYPE dora_incident_duration_seconds histogram
dora_incident_duration_seconds_sum{severity="${SEVERITY}",team="${TEAM}"} ${DURATION}
dora_incident_duration_seconds_count{severity="${SEVERITY}",team="${TEAM}"} 1
EOF
    )
    push_metrics "$METRICS" "incident-end-$(date +%s)"
    log_audit "DORA_INCIDENT_END" "severity=${SEVERITY},team=${TEAM},duration=${DURATION}s"
    ;;

  *)
    log_error "알 수 없는 이벤트 유형: ${EVENT_TYPE}"
    usage
    ;;
esac

log_success "DORA 이벤트 처리 완료: ${EVENT_TYPE}"
