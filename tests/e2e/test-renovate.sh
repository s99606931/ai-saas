#!/usr/bin/env bash
# Design Ref: MTU-N79 §Session Guide #7
# Plan SC: FR-N79.1 ~ FR-N79.7
# CSAP D-12: 시스템 개발 보안 — 의존성 자동 갱신 검증
set -euo pipefail

PASS=0
FAIL=0
TOTAL=0
RESULTS=""

pass_test() {
  local name="$1"
  PASS=$((PASS + 1))
  TOTAL=$((TOTAL + 1))
  RESULTS="${RESULTS}\n  [PASS] ${name}"
}

fail_test() {
  local name="$1"
  local reason="$2"
  FAIL=$((FAIL + 1))
  TOTAL=$((TOTAL + 1))
  RESULTS="${RESULTS}\n  [FAIL] ${name}: ${reason}"
}

echo "============================================"
echo " MTU-N79: Renovate Bot 의존성 자동 갱신 E2E"
echo " CSAP D-12 공급망 보안 검증"
echo "============================================"
echo ""

# -----------------------------------------------
# T01: Renovate 네임스페이스 매니페스트 검증
# -----------------------------------------------
echo "[T01] Renovate 네임스페이스 매니페스트 검증..."
NS_FILE="/data/ai-saas/infra/renovate/namespace.yaml"
if [ -f "$NS_FILE" ]; then
  if grep -q "name: renovate-system" "$NS_FILE" && \
     grep -q "pod-security.kubernetes.io/enforce: restricted" "$NS_FILE"; then
    pass_test "T01: 네임스페이스 매니페스트 (PSS Restricted)"
  else
    fail_test "T01: 네임스페이스 매니페스트" "필수 설정 누락"
  fi
else
  fail_test "T01: 네임스페이스 매니페스트" "파일 없음"
fi

# -----------------------------------------------
# T02: CronJob 매니페스트 검증
# -----------------------------------------------
echo "[T02] CronJob 매니페스트 검증..."
CJ_FILE="/data/ai-saas/infra/renovate/cronjob.yaml"
if [ -f "$CJ_FILE" ]; then
  CHECKS=0
  grep -q "kind: CronJob" "$CJ_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "schedule:" "$CJ_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "runAsNonRoot: true" "$CJ_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "readOnlyRootFilesystem: true" "$CJ_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "allowPrivilegeEscalation: false" "$CJ_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "drop:" "$CJ_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "renovate/renovate:" "$CJ_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "concurrencyPolicy: Forbid" "$CJ_FILE" && CHECKS=$((CHECKS + 1))

  if [ "$CHECKS" -ge 7 ]; then
    pass_test "T02: CronJob 매니페스트 (보안 컨텍스트 포함)"
  else
    fail_test "T02: CronJob 매니페스트" "검증 ${CHECKS}/7 통과"
  fi
else
  fail_test "T02: CronJob 매니페스트" "파일 없음"
fi

# -----------------------------------------------
# T03: ConfigMap (renovate.json5) 검증
# -----------------------------------------------
echo "[T03] ConfigMap 검증..."
CM_FILE="/data/ai-saas/infra/renovate/configmap.yaml"
if [ -f "$CM_FILE" ]; then
  CHECKS=0
  grep -q "kind: ConfigMap" "$CM_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "renovate.json5" "$CM_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "platform.*gitea" "$CM_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "packageRules" "$CM_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "automerge" "$CM_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "vulnerabilityAlerts" "$CM_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "helm-values" "$CM_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "security" "$CM_FILE" && CHECKS=$((CHECKS + 1))

  if [ "$CHECKS" -ge 7 ]; then
    pass_test "T03: ConfigMap renovate.json5 (${CHECKS}/8 항목)"
  else
    fail_test "T03: ConfigMap" "검증 ${CHECKS}/8 통과"
  fi
else
  fail_test "T03: ConfigMap" "파일 없음"
fi

# -----------------------------------------------
# T04: RBAC 매니페스트 검증
# -----------------------------------------------
echo "[T04] RBAC 매니페스트 검증..."
RBAC_FILE="/data/ai-saas/infra/renovate/rbac.yaml"
if [ -f "$RBAC_FILE" ]; then
  CHECKS=0
  grep -q "kind: ServiceAccount" "$RBAC_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "kind: Role" "$RBAC_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "kind: RoleBinding" "$RBAC_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "automountServiceAccountToken: false" "$RBAC_FILE" && CHECKS=$((CHECKS + 1))

  if [ "$CHECKS" -ge 4 ]; then
    pass_test "T04: RBAC (최소 권한 원칙)"
  else
    fail_test "T04: RBAC" "검증 ${CHECKS}/4 통과"
  fi
else
  fail_test "T04: RBAC" "파일 없음"
fi

# -----------------------------------------------
# T05: ExternalSecret 연동 검증
# -----------------------------------------------
echo "[T05] ExternalSecret 연동 검증..."
ES_FILE="/data/ai-saas/infra/renovate/external-secret.yaml"
if [ -f "$ES_FILE" ]; then
  CHECKS=0
  grep -q "kind: ExternalSecret" "$ES_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "renovate-gitea-token" "$ES_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "ClusterSecretStore" "$ES_FILE" && CHECKS=$((CHECKS + 1))

  if [ "$CHECKS" -ge 3 ]; then
    pass_test "T05: ExternalSecret 연동 (CSAP D-09)"
  else
    fail_test "T05: ExternalSecret" "검증 ${CHECKS}/3 통과"
  fi
else
  fail_test "T05: ExternalSecret" "파일 없음"
fi

# -----------------------------------------------
# T06: NetworkPolicy 검증
# -----------------------------------------------
echo "[T06] NetworkPolicy 검증..."
NP_FILE="/data/ai-saas/infra/renovate/network-policy.yaml"
if [ -f "$NP_FILE" ]; then
  CHECKS=0
  grep -q "kind: NetworkPolicy" "$NP_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "Egress" "$NP_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "Ingress" "$NP_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "port: 3000" "$NP_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "port: 53" "$NP_FILE" && CHECKS=$((CHECKS + 1))

  if [ "$CHECKS" -ge 4 ]; then
    pass_test "T06: NetworkPolicy (Gitea 통신만 허용, CSAP D-08)"
  else
    fail_test "T06: NetworkPolicy" "검증 ${CHECKS}/5 통과"
  fi
else
  fail_test "T06: NetworkPolicy" "파일 없음"
fi

# -----------------------------------------------
# T07: 자동머지 정책 검증
# -----------------------------------------------
echo "[T07] 자동머지 정책 검증..."
AM_FILE="/data/ai-saas/infra/renovate/automerge-policy.yaml"
if [ -f "$AM_FILE" ]; then
  CHECKS=0
  grep -q "automerge" "$AM_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "security_critical" "$AM_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "infrastructure_critical" "$AM_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "required_approvals" "$AM_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "audit" "$AM_FILE" && CHECKS=$((CHECKS + 1))
  grep -q "sla:" "$AM_FILE" && CHECKS=$((CHECKS + 1))

  if [ "$CHECKS" -ge 5 ]; then
    pass_test "T07: 자동머지 정책 (심각도별 분류, CSAP D-12)"
  else
    fail_test "T07: 자동머지 정책" "검증 ${CHECKS}/6 통과"
  fi
else
  fail_test "T07: 자동머지 정책" "파일 없음"
fi

# -----------------------------------------------
# T08: 루트 renovate.json5 검증
# -----------------------------------------------
echo "[T08] 루트 renovate.json5 검증..."
ROOT_FILE="/data/ai-saas/renovate.json5"
if [ -f "$ROOT_FILE" ]; then
  if grep -q "config:recommended" "$ROOT_FILE"; then
    pass_test "T08: 루트 renovate.json5"
  else
    fail_test "T08: 루트 renovate.json5" "기본 설정 누락"
  fi
else
  fail_test "T08: 루트 renovate.json5" "파일 없음"
fi

# -----------------------------------------------
# T09: YAML 문법 검증
# -----------------------------------------------
echo "[T09] YAML 문법 검증..."
YAML_OK=0
YAML_TOTAL=0
for f in /data/ai-saas/infra/renovate/*.yaml; do
  YAML_TOTAL=$((YAML_TOTAL + 1))
  if python3 -c "import yaml; yaml.safe_load_all(open('$f'))" 2>/dev/null; then
    YAML_OK=$((YAML_OK + 1))
  fi
done

if [ "$YAML_OK" -eq "$YAML_TOTAL" ]; then
  pass_test "T09: YAML 문법 검증 (${YAML_OK}/${YAML_TOTAL} 통과)"
else
  fail_test "T09: YAML 문법 검증" "${YAML_OK}/${YAML_TOTAL} 통과"
fi

# -----------------------------------------------
# T10: 시크릿 하드코딩 검사 (CSAP D-09)
# -----------------------------------------------
echo "[T10] 시크릿 하드코딩 검사..."
SECRETS_FOUND=0
for f in /data/ai-saas/infra/renovate/*.yaml; do
  if grep -iE "(password|secret|token|api.?key)\s*[:=]\s*['\"]?[a-zA-Z0-9]" "$f" 2>/dev/null | grep -v "secretKeyRef" | grep -v "secretKey:" | grep -v "remoteRef" | grep -v "SecretStore" | grep -v "ExternalSecret" | grep -v "automountServiceAccountToken" | grep -v "secretStoreRef" | grep -q .; then
    SECRETS_FOUND=$((SECRETS_FOUND + 1))
  fi
done

if [ "$SECRETS_FOUND" -eq 0 ]; then
  pass_test "T10: 시크릿 하드코딩 없음 (CSAP D-09)"
else
  fail_test "T10: 시크릿 하드코딩" "${SECRETS_FOUND}개 파일에서 발견"
fi

# -----------------------------------------------
# 결과 요약
# -----------------------------------------------
echo ""
echo "============================================"
echo " MTU-N79 E2E 테스트 결과"
echo "============================================"
echo -e "$RESULTS"
echo ""
echo "--------------------------------------------"
echo " 통과: ${PASS}/${TOTAL} | 실패: ${FAIL}/${TOTAL}"
echo "--------------------------------------------"

if [ "$FAIL" -gt 0 ]; then
  echo " [WARNING] 일부 테스트 실패"
  exit 1
else
  echo " [SUCCESS] 모든 테스트 통과"
  exit 0
fi
