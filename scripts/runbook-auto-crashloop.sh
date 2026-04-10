#!/usr/bin/env bash
# =============================================================================
# 자동 Runbook: Pod CrashLoopBackOff 진단
# Design Ref: MTU-N94 Design §2.2
# Plan SC: FR-N94.1, FR-N94.5
# CSAP: D-06(인시던트 자동 진단 + 감사 로그)
#
# 사용법: bash scripts/runbook-auto-crashloop.sh [namespace] [pod-name]
# 예시:   bash scripts/runbook-auto-crashloop.sh production api-gateway-abc123
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNBOOK_NAME="pod-crashloop-diag"
source "$SCRIPT_DIR/runbook-lib.sh"

# ---------------------------------------------------------------------------
# 파라미터
# ---------------------------------------------------------------------------
NAMESPACE="${1:-default}"
POD_NAME="${2:-}"

if [ -z "$POD_NAME" ]; then
  log_error "사용법: $0 <namespace> <pod-name>"
  exit 1
fi

section "Pod CrashLoopBackOff 자동 진단"
log_info "네임스페이스: $NAMESPACE"
log_info "Pod: $POD_NAME"
log_audit "RUNBOOK_START" "Pod CrashLoop 진단 시작: $NAMESPACE/$POD_NAME"

# ---------------------------------------------------------------------------
# STEP 1: Pod 상태 확인
# ---------------------------------------------------------------------------
section "STEP 1: Pod 상태 확인"

POD_STATUS=$(safe_kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null || echo "NotFound")
RESTART_COUNT=$(safe_kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null || echo "0")
LAST_STATE=$(safe_kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o jsonpath='{.status.containerStatuses[0].lastState.terminated.reason}' 2>/dev/null || echo "Unknown")

log_info "Pod 상태: $POD_STATUS"
log_info "재시작 횟수: $RESTART_COUNT"
log_info "마지막 종료 사유: $LAST_STATE"

add_finding "pod_status" "info" "상태: $POD_STATUS, 재시작: $RESTART_COUNT회, 종료사유: $LAST_STATE"

# ---------------------------------------------------------------------------
# STEP 2: 컨테이너 로그 분석
# ---------------------------------------------------------------------------
section "STEP 2: 컨테이너 로그 분석"

RECENT_LOGS=$(safe_kubectl logs "$POD_NAME" -n "$NAMESPACE" --tail=50 --previous 2>/dev/null || echo "로그 없음")

# OOM 킬 감지
if echo "$LAST_STATE" | grep -qi "OOMKilled"; then
  log_warn "OOM Killed 감지됨"
  add_finding "oom_killed" "critical" "컨테이너가 메모리 한도 초과로 종료됨"

  # 메모리 리밋 확인
  MEM_LIMIT=$(safe_kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].resources.limits.memory}' 2>/dev/null || echo "미설정")
  MEM_REQUEST=$(safe_kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].resources.requests.memory}' 2>/dev/null || echo "미설정")
  log_info "메모리 Request: $MEM_REQUEST / Limit: $MEM_LIMIT"
  add_finding "memory_config" "warning" "Request: $MEM_REQUEST, Limit: $MEM_LIMIT"
fi

# 에러 패턴 감지
if echo "$RECENT_LOGS" | grep -qi "connection refused\|ECONNREFUSED"; then
  log_warn "연결 거부 에러 감지 (DB 또는 외부 서비스)"
  add_finding "connection_error" "warning" "외부 서비스 연결 거부 감지됨"
fi

if echo "$RECENT_LOGS" | grep -qi "permission denied\|EACCES"; then
  log_warn "권한 거부 에러 감지"
  add_finding "permission_error" "warning" "파일 시스템 또는 네트워크 권한 거부"
fi

if echo "$RECENT_LOGS" | grep -qi "panic\|fatal\|segfault"; then
  log_error "심각한 에러 감지 (panic/fatal/segfault)"
  add_finding "fatal_error" "critical" "애플리케이션 패닉/치명적 오류 감지"
fi

# ---------------------------------------------------------------------------
# STEP 3: 리소스 상태 확인
# ---------------------------------------------------------------------------
section "STEP 3: 리소스 상태 확인"

# Deployment 확인
DEPLOYMENT=$(safe_kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o jsonpath='{.metadata.ownerReferences[0].name}' 2>/dev/null || echo "Unknown")
log_info "소유자: $DEPLOYMENT"

# 이전 ReplicaSet 확인 (롤백 가능 여부)
if [ "$DEPLOYMENT" != "Unknown" ]; then
  AVAILABLE_RS=$(safe_kubectl get rs -n "$NAMESPACE" -l "app=$DEPLOYMENT" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
  log_info "사용 가능한 ReplicaSet: $AVAILABLE_RS"
fi

# 노드 리소스 확인
NODE=$(safe_kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.nodeName}' 2>/dev/null || echo "Unknown")
log_info "배포된 노드: $NODE"

# ---------------------------------------------------------------------------
# STEP 4: 근본 원인 판별 + 권장 조치
# ---------------------------------------------------------------------------
section "STEP 4: 근본 원인 판별"

ROOT_CAUSE="알 수 없음"
RECOMMENDATION="추가 조사 필요"

if echo "$LAST_STATE" | grep -qi "OOMKilled"; then
  ROOT_CAUSE="메모리 한도 초과 (OOM Killed)"
  RECOMMENDATION="메모리 limit를 현재의 2배로 증가하거나 VPA 적용 권장"
elif echo "$RECENT_LOGS" | grep -qi "connection refused"; then
  ROOT_CAUSE="외부 서비스 연결 실패"
  RECOMMENDATION="종속 서비스(DB, Redis 등) 상태 확인 후 재시작"
elif echo "$RECENT_LOGS" | grep -qi "panic\|fatal"; then
  ROOT_CAUSE="애플리케이션 치명적 오류"
  RECOMMENDATION="이전 안정 버전으로 롤백 검토"
elif [ "$RESTART_COUNT" -gt 10 ]; then
  ROOT_CAUSE="반복적 CrashLoop (재시작 ${RESTART_COUNT}회)"
  RECOMMENDATION="ConfigMap/Secret 설정 검토 및 이미지 버전 확인"
fi

log_info "근본 원인: $ROOT_CAUSE"
log_info "권장 조치: $RECOMMENDATION"

# ---------------------------------------------------------------------------
# 결과 출력 (JSON)
# ---------------------------------------------------------------------------
section "진단 결과 (JSON)"
output_diagnosis "$ROOT_CAUSE" "$RECOMMENDATION" "none" "수동 승인 필요"

log_audit "RUNBOOK_COMPLETE" "진단 완료: $ROOT_CAUSE"
