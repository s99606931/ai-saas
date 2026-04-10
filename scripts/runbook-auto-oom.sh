#!/usr/bin/env bash
# =============================================================================
# 자동 Runbook: OOM 킬 진단 + VPA 권장
# Design Ref: MTU-N94 Design §2.2
# Plan SC: FR-N94.4, FR-N94.5
# CSAP: D-06(인시던트 자동 진단)
#
# 사용법: bash scripts/runbook-auto-oom.sh [namespace] [pod-name]
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNBOOK_NAME="oom-kill-diag"
source "$SCRIPT_DIR/runbook-lib.sh"

NAMESPACE="${1:-default}"
POD_NAME="${2:-}"

if [ -z "$POD_NAME" ]; then
  log_error "사용법: $0 <namespace> <pod-name>"
  exit 1
fi

section "OOM 킬 자동 진단"
log_info "네임스페이스: $NAMESPACE"
log_info "Pod: $POD_NAME"
log_audit "RUNBOOK_START" "OOM 진단 시작: $NAMESPACE/$POD_NAME"

# ---------------------------------------------------------------------------
# STEP 1: OOM 이력 확인
# ---------------------------------------------------------------------------
section "STEP 1: OOM 이력 확인"

RESTART_COUNT=$(safe_kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null || echo "0")
LAST_REASON=$(safe_kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o jsonpath='{.status.containerStatuses[0].lastState.terminated.reason}' 2>/dev/null || echo "Unknown")
EXIT_CODE=$(safe_kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o jsonpath='{.status.containerStatuses[0].lastState.terminated.exitCode}' 2>/dev/null || echo "0")

log_info "재시작 횟수: $RESTART_COUNT"
log_info "마지막 종료 사유: $LAST_REASON (exit code: $EXIT_CODE)"

if [ "$EXIT_CODE" = "137" ] || echo "$LAST_REASON" | grep -qi "OOMKilled"; then
  add_finding "oom_confirmed" "critical" "OOM Killed 확인됨 (exit code 137)"
else
  add_finding "oom_not_confirmed" "warning" "OOM 여부 불확실 (exit code: $EXIT_CODE, reason: $LAST_REASON)"
fi

# ---------------------------------------------------------------------------
# STEP 2: 현재 리소스 설정 확인
# ---------------------------------------------------------------------------
section "STEP 2: 리소스 설정 확인"

MEM_REQUEST=$(safe_kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].resources.requests.memory}' 2>/dev/null || echo "미설정")
MEM_LIMIT=$(safe_kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].resources.limits.memory}' 2>/dev/null || echo "미설정")
CPU_REQUEST=$(safe_kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].resources.requests.cpu}' 2>/dev/null || echo "미설정")
CPU_LIMIT=$(safe_kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].resources.limits.cpu}' 2>/dev/null || echo "미설정")

log_info "Memory: Request=$MEM_REQUEST / Limit=$MEM_LIMIT"
log_info "CPU:    Request=$CPU_REQUEST / Limit=$CPU_LIMIT"
add_finding "resource_config" "info" "Memory: req=$MEM_REQUEST lim=$MEM_LIMIT, CPU: req=$CPU_REQUEST lim=$CPU_LIMIT"

# ---------------------------------------------------------------------------
# STEP 3: VPA 권장 출력
# ---------------------------------------------------------------------------
section "STEP 3: VPA 권장 사항"

# VPA 존재 여부 확인
VPA_EXISTS=$(safe_kubectl get vpa -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l || echo 0)
log_info "적용된 VPA 수: $VPA_EXISTS"

if [ "$VPA_EXISTS" -eq 0 ]; then
  log_warn "VPA가 적용되어 있지 않음 — VPA 적용 권장"
  add_finding "vpa_missing" "warning" "VPA 미적용 — 자동 리소스 조정 불가"

  # Deployment 이름 추출
  DEPLOYMENT=$(safe_kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o jsonpath='{.metadata.ownerReferences[0].name}' 2>/dev/null || echo "unknown")

  log_info "VPA 적용 예시:"
  cat <<VPA_EXAMPLE
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: ${DEPLOYMENT}-vpa
  namespace: $NAMESPACE
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: $DEPLOYMENT
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
      - containerName: "*"
        minAllowed:
          memory: "128Mi"
        maxAllowed:
          memory: "2Gi"
VPA_EXAMPLE
  add_action "vpa_recommendation" "VPA 적용 권장: ${DEPLOYMENT}-vpa" "recommendation"
fi

# ---------------------------------------------------------------------------
# STEP 4: 진단 결과
# ---------------------------------------------------------------------------
section "STEP 4: 진단 결과"

ROOT_CAUSE="메모리 한도(${MEM_LIMIT}) 초과로 OOM Killed"
RECOMMENDATION="메모리 limit를 2배로 증가하거나 VPA를 Auto 모드로 적용 권장"

output_diagnosis "$ROOT_CAUSE" "$RECOMMENDATION" "recommendation" "VPA 적용 또는 수동 리소스 조정 필요"

log_audit "RUNBOOK_COMPLETE" "OOM 진단 완료: $ROOT_CAUSE"
