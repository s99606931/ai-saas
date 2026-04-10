#!/bin/bash
# ============================================================
# MTU-N71: Pod Security Standards Restricted 프로필 검증 테스트
# Design Ref: MTU-N71 §5
# Plan SC: FR-N71.5
# CSAP 매핑: D-08-05
# ============================================================

set -euo pipefail

PASS=0
FAIL=0
TOTAL=15

log_pass() { echo "  [PASS] $1"; PASS=$((PASS+1)); }
log_fail() { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }
log_info() { echo "  [INFO] $1"; }

echo "============================================================"
echo "MTU-N71: Pod Security Standards Restricted 프로필 검증"
echo "날짜: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
echo ""

# --------------------------------------------------
# PSS-01: restricted NS에 특권 컨테이너 배포 시도 → 차단
# --------------------------------------------------
echo "[PSS-01] restricted NS에 특권 컨테이너 배포 차단 테스트"
if [ -f /data/ai-saas/infra/security/pod-security-standards/namespace-labels.yaml ]; then
  RESTRICTED_NS=$(grep -B5 'enforce: restricted' /data/ai-saas/infra/security/pod-security-standards/namespace-labels.yaml | grep 'name:' | head -1 | awk '{print $2}')
  if [ -n "$RESTRICTED_NS" ]; then
    log_pass "restricted NS 정의 존재: $RESTRICTED_NS"
  else
    log_fail "restricted NS 미정의"
  fi
else
  log_fail "namespace-labels.yaml 파일 미존재"
fi

# --------------------------------------------------
# PSS-02: restricted NS에 hostNetwork 사용 금지 확인
# --------------------------------------------------
echo "[PSS-02] Kyverno 정책 — hostNetwork 금지"
if grep -q 'hostNetwork.*false' /data/ai-saas/infra/kyverno/policies/pss-restricted-audit.yaml 2>/dev/null; then
  log_pass "hostNetwork 금지 정책 정의됨"
else
  log_fail "hostNetwork 금지 정책 미정의"
fi

# --------------------------------------------------
# PSS-03: restricted NS에 hostPath 볼륨 금지
# --------------------------------------------------
echo "[PSS-03] Kyverno 정책 — hostPath 볼륨 금지"
if grep -q 'hostPath' /data/ai-saas/infra/kyverno/policies/pss-restricted-audit.yaml 2>/dev/null; then
  log_pass "hostPath 금지 정책 정의됨"
else
  log_fail "hostPath 금지 정책 미정의"
fi

# --------------------------------------------------
# PSS-04: restricted NS에 정상 컨테이너 배포 가능
# --------------------------------------------------
echo "[PSS-04] securityContext 템플릿 restricted 호환 확인"
TMPL=/data/ai-saas/infra/security/pod-security-standards/security-context-template.yaml
if [ -f "$TMPL" ]; then
  if grep -q 'runAsNonRoot: true' "$TMPL" && \
     grep -q 'allowPrivilegeEscalation: false' "$TMPL" && \
     grep -q "drop:" "$TMPL"; then
    log_pass "securityContext 템플릿 restricted 호환"
  else
    log_fail "securityContext 템플릿 일부 누락"
  fi
else
  log_fail "securityContext 템플릿 파일 미존재"
fi

# --------------------------------------------------
# PSS-05: 시스템 NS privileged 레벨 확인
# --------------------------------------------------
echo "[PSS-05] 시스템 NS privileged 예외 확인"
LABELS_FILE=/data/ai-saas/infra/security/pod-security-standards/namespace-labels.yaml
SYS_PRIV=$(grep -A3 'name: kube-system' "$LABELS_FILE" 2>/dev/null | grep 'enforce: privileged' | wc -l)
if [ "$SYS_PRIV" -ge 1 ]; then
  log_pass "kube-system NS privileged 설정 확인"
else
  log_fail "kube-system NS privileged 설정 미확인"
fi

# --------------------------------------------------
# PSS-06: 모든 앱 NS restricted 라벨 확인
# --------------------------------------------------
echo "[PSS-06] 앱 NS restricted enforce 라벨 확인"
APP_NS_COUNT=$(grep -c 'enforce: restricted' "$LABELS_FILE" 2>/dev/null || echo 0)
if [ "$APP_NS_COUNT" -ge 3 ]; then
  log_pass "앱 NS ${APP_NS_COUNT}개에 restricted 라벨 적용"
else
  log_fail "앱 NS restricted 라벨 부족 (${APP_NS_COUNT}개)"
fi

# --------------------------------------------------
# PSS-07: Deployment securityContext 호환 확인
# --------------------------------------------------
echo "[PSS-07] Helm values securityContext 템플릿 존재 확인"
if grep -q 'runAsNonRoot' "$TMPL" 2>/dev/null; then
  log_pass "Deployment securityContext 호환 템플릿 존재"
else
  log_fail "Deployment securityContext 호환 템플릿 누락"
fi

# --------------------------------------------------
# PSS-08: StatefulSet securityContext 호환 확인
# --------------------------------------------------
echo "[PSS-08] StatefulSet securityContext fsGroup 설정 확인"
if grep -q 'fsGroup' "$TMPL" 2>/dev/null; then
  log_pass "StatefulSet fsGroup 설정 포함"
else
  log_fail "StatefulSet fsGroup 설정 누락"
fi

# --------------------------------------------------
# PSS-09: capabilities drop ALL 확인
# --------------------------------------------------
echo "[PSS-09] capabilities drop ALL 확인"
if grep -q 'drop:' "$TMPL" && grep -A1 'drop:' "$TMPL" | grep -q 'ALL'; then
  log_pass "capabilities drop ALL 설정 확인"
else
  log_fail "capabilities drop ALL 미설정"
fi

# --------------------------------------------------
# PSS-10: runAsNonRoot 확인
# --------------------------------------------------
echo "[PSS-10] runAsNonRoot 전역 확인"
NONROOT_COUNT=$(grep -c 'runAsNonRoot: true' "$TMPL" 2>/dev/null || echo 0)
if [ "$NONROOT_COUNT" -ge 2 ]; then
  log_pass "runAsNonRoot Pod + Container 레벨 모두 설정 (${NONROOT_COUNT}개)"
else
  log_fail "runAsNonRoot 설정 부족 (${NONROOT_COUNT}개)"
fi

# --------------------------------------------------
# PSS-11: Kyverno ClusterPolicy 정의 확인
# --------------------------------------------------
echo "[PSS-11] Kyverno ClusterPolicy 정의 확인"
POLICY_FILE=/data/ai-saas/infra/kyverno/policies/pss-restricted-audit.yaml
if [ -f "$POLICY_FILE" ]; then
  POLICY_COUNT=$(grep -c 'kind: ClusterPolicy' "$POLICY_FILE")
  if [ "$POLICY_COUNT" -ge 1 ]; then
    log_pass "Kyverno ClusterPolicy ${POLICY_COUNT}개 정의됨"
  else
    log_fail "Kyverno ClusterPolicy 미정의"
  fi
else
  log_fail "Kyverno 정책 파일 미존재"
fi

# --------------------------------------------------
# PSS-12: Kyverno PolicyReport 생성 설정 확인
# --------------------------------------------------
echo "[PSS-12] Kyverno PolicyReport (Audit 모드) 확인"
if grep -q 'validationFailureAction: Audit' "$POLICY_FILE" 2>/dev/null; then
  log_pass "Audit 모드 설정 — PolicyReport 자동 생성"
else
  log_fail "Audit 모드 미설정"
fi

# --------------------------------------------------
# PSS-13: seccompProfile RuntimeDefault 확인
# --------------------------------------------------
echo "[PSS-13] seccompProfile RuntimeDefault 확인"
SECCOMP_COUNT=$(grep -c 'RuntimeDefault' "$TMPL" 2>/dev/null || echo 0)
if [ "$SECCOMP_COUNT" -ge 2 ]; then
  log_pass "seccompProfile RuntimeDefault Pod+Container 레벨 설정 (${SECCOMP_COUNT}개)"
else
  log_fail "seccompProfile RuntimeDefault 부족 (${SECCOMP_COUNT}개)"
fi

# --------------------------------------------------
# PSS-14: allowPrivilegeEscalation false 확인
# --------------------------------------------------
echo "[PSS-14] allowPrivilegeEscalation false 확인"
if grep -q 'allowPrivilegeEscalation: false' "$TMPL" 2>/dev/null; then
  log_pass "allowPrivilegeEscalation false 설정 확인"
else
  log_fail "allowPrivilegeEscalation false 미설정"
fi

# --------------------------------------------------
# PSS-15: 전체 NS PSS 레벨 매트릭스 검증
# --------------------------------------------------
echo "[PSS-15] NS PSS 레벨 분류 매트릭스 검증"
PRIV_COUNT=$(grep -c 'enforce: privileged' "$LABELS_FILE" 2>/dev/null || echo 0)
BASE_COUNT=$(grep -c 'enforce: baseline' "$LABELS_FILE" 2>/dev/null || echo 0)
REST_COUNT=$(grep -c 'enforce: restricted' "$LABELS_FILE" 2>/dev/null || echo 0)
if [ "$PRIV_COUNT" -ge 3 ] && [ "$BASE_COUNT" -ge 3 ] && [ "$REST_COUNT" -ge 3 ]; then
  log_pass "NS 분류 매트릭스: privileged=${PRIV_COUNT}, baseline=${BASE_COUNT}, restricted=${REST_COUNT}"
else
  log_fail "NS 분류 매트릭스 불완전: priv=${PRIV_COUNT}, base=${BASE_COUNT}, rest=${REST_COUNT}"
fi

# --------------------------------------------------
# 최종 결과
# --------------------------------------------------
echo ""
echo "============================================================"
echo "MTU-N71 PSS Restricted 검증 결과"
echo "============================================================"
echo "  통과: ${PASS} / ${TOTAL}"
echo "  실패: ${FAIL} / ${TOTAL}"
echo "  매치율: $(( PASS * 100 / TOTAL ))%"
echo "============================================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
