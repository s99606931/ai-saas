#!/usr/bin/env bash
# =============================================================================
# 자동 Runbook: 고지연 자동 진단
# Design Ref: MTU-N94 Design §2.2
# Plan SC: FR-N94.2, FR-N94.5
# CSAP: D-06(인시던트 자동 진단)
#
# 사용법: bash scripts/runbook-auto-high-latency.sh [service-name] [namespace]
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNBOOK_NAME="high-latency-diag"
source "$SCRIPT_DIR/runbook-lib.sh"

SERVICE="${1:-unknown}"
NAMESPACE="${2:-default}"

section "고지연 자동 진단"
log_info "서비스: $SERVICE"
log_info "네임스페이스: $NAMESPACE"
log_audit "RUNBOOK_START" "고지연 진단 시작: $NAMESPACE/$SERVICE"

# ---------------------------------------------------------------------------
# STEP 1: 서비스 Pod 상태 확인
# ---------------------------------------------------------------------------
section "STEP 1: 서비스 Pod 상태 확인"

PODS=$(safe_kubectl get pods -n "$NAMESPACE" -l "app=$SERVICE" --no-headers 2>/dev/null || echo "")
if [ -n "$PODS" ]; then
  POD_COUNT=$(echo "$PODS" | wc -l)
  READY_COUNT=$(echo "$PODS" | grep -c "Running" || echo 0)
  log_info "Pod 수: $POD_COUNT (Ready: $READY_COUNT)"
  add_finding "pod_status" "info" "총 ${POD_COUNT}개 Pod, ${READY_COUNT}개 Ready"

  if [ "$READY_COUNT" -lt "$POD_COUNT" ]; then
    log_warn "일부 Pod이 Ready 상태가 아님"
    add_finding "pod_not_ready" "warning" "Ready 비율: ${READY_COUNT}/${POD_COUNT}"
  fi
else
  log_warn "서비스 Pod을 찾을 수 없음"
  add_finding "pod_not_found" "warning" "서비스 $SERVICE의 Pod을 찾을 수 없음"
fi

# ---------------------------------------------------------------------------
# STEP 2: 리소스 사용량 확인
# ---------------------------------------------------------------------------
section "STEP 2: 리소스 사용량 확인"

POD_METRICS=$(safe_kubectl top pods -n "$NAMESPACE" -l "app=$SERVICE" --no-headers 2>/dev/null || echo "메트릭 없음")
if [ "$POD_METRICS" != "메트릭 없음" ]; then
  log_info "Pod 리소스 사용량:"
  echo "$POD_METRICS"
  add_finding "resource_usage" "info" "리소스 메트릭 수집됨"
else
  log_warn "메트릭 서버 접근 불가"
  add_finding "metrics_unavailable" "warning" "메트릭 서버 접근 불가"
fi

# ---------------------------------------------------------------------------
# STEP 3: 종속 서비스 연결 확인
# ---------------------------------------------------------------------------
section "STEP 3: 종속 서비스 연결 확인"

# PostgreSQL 연결 확인
PG_SVC=$(safe_kubectl get svc -n "$NAMESPACE" -o name 2>/dev/null | grep -i "postgres\|pg\|db" || echo "")
if [ -n "$PG_SVC" ]; then
  log_info "데이터베이스 서비스 발견: $PG_SVC"
  PG_ENDPOINTS=$(safe_kubectl get endpoints -n "$NAMESPACE" -o jsonpath='{.items[*].subsets[*].addresses[*].ip}' 2>/dev/null || echo "없음")
  log_info "DB 엔드포인트: $PG_ENDPOINTS"
  add_finding "db_connection" "info" "DB 엔드포인트: $PG_ENDPOINTS"
else
  log_info "네임스페이스 내 DB 서비스 없음 (외부 DB 사용 가능)"
fi

# Redis 연결 확인
REDIS_SVC=$(safe_kubectl get svc -n "$NAMESPACE" -o name 2>/dev/null | grep -i "redis" || echo "")
if [ -n "$REDIS_SVC" ]; then
  log_info "Redis 서비스 발견: $REDIS_SVC"
  add_finding "redis_connection" "info" "Redis 서비스: $REDIS_SVC"
fi

# ---------------------------------------------------------------------------
# STEP 4: 네트워크 정책 확인
# ---------------------------------------------------------------------------
section "STEP 4: 네트워크 정책 확인"

NP_COUNT=$(safe_kubectl get networkpolicy -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l || echo 0)
log_info "적용된 NetworkPolicy 수: $NP_COUNT"
if [ "$NP_COUNT" -gt 0 ]; then
  add_finding "network_policy" "info" "NetworkPolicy ${NP_COUNT}개 적용됨 (트래픽 제한 가능성)"
fi

# ---------------------------------------------------------------------------
# STEP 5: 근본 원인 판별
# ---------------------------------------------------------------------------
section "STEP 5: 진단 결과"

ROOT_CAUSE="특정 원인 미확인"
RECOMMENDATION="APM 도구(Tempo)로 분산 추적 분석 권장"

if [ "$READY_COUNT" -lt "$POD_COUNT" ] 2>/dev/null; then
  ROOT_CAUSE="일부 Pod 비정상 상태로 인한 부하 집중"
  RECOMMENDATION="비정상 Pod 상태 확인 후 재시작 또는 스케일 아웃"
fi

output_diagnosis "$ROOT_CAUSE" "$RECOMMENDATION" "none" "수동 분석 필요"

log_audit "RUNBOOK_COMPLETE" "고지연 진단 완료: $ROOT_CAUSE"
