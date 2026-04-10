#!/bin/bash
# test-secret-rotation.sh -- MTU-N103 시크릿 회전 E2E 테스트
# Design Ref: MTU-N103 Design
# Plan SC: FR-N103.1~FR-N103.6
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
BASE="/data/ai-saas"

check() {
    local name="$1"; local result="$2"
    TOTAL=$((TOTAL + 1))
    if [ "$result" = "true" ]; then
        PASS=$((PASS + 1)); echo "  [PASS] $name"
    else
        FAIL=$((FAIL + 1)); echo "  [FAIL] $name"
    fi
}

echo "=== MTU-N103: 시크릿 회전 E2E 테스트 ==="

# FR-N103.1: Vault 설치
check "Vault install.yaml 존재" \
    "$([ -f "$BASE/infra/vault/install.yaml" ] && echo true || echo false)"

check "감사 로그 활성화" \
    "$(grep -q 'audit enable' "$BASE/infra/vault/install.yaml" && echo true || echo false)"

check "보안 컨텍스트" \
    "$(grep -q 'runAsNonRoot: true' "$BASE/infra/vault/install.yaml" && echo true || echo false)"

# FR-N103.2: ESO SecretStore
check "secret-store.yaml 존재" \
    "$([ -f "$BASE/infra/vault/secret-store.yaml" ] && echo true || echo false)"

check "ClusterSecretStore 정의" \
    "$(grep -q 'kind: ClusterSecretStore' "$BASE/infra/vault/secret-store.yaml" && echo true || echo false)"

check "Kubernetes Auth 연동" \
    "$(grep -q 'kubernetes:' "$BASE/infra/vault/secret-store.yaml" && echo true || echo false)"

# FR-N103.3: 회전 정책
check "rotation-policies.yaml 존재" \
    "$([ -f "$BASE/infra/vault/rotation-policies.yaml" ] && echo true || echo false)"

ES_COUNT=$(grep -c 'kind: ExternalSecret' "$BASE/infra/vault/rotation-policies.yaml" || echo 0)
check "ExternalSecret 5개 ($ES_COUNT)" \
    "$([ "$ES_COUNT" -ge 5 ] && echo true || echo false)"

check "DB 비밀번호 30일 교체" \
    "$(grep -q 'rotation-policy.*30d' "$BASE/infra/vault/rotation-policies.yaml" && echo true || echo false)"

check "API 키 90일 교체" \
    "$(grep -q 'rotation-policy.*90d' "$BASE/infra/vault/rotation-policies.yaml" && echo true || echo false)"

# FR-N103.4: Dual Secret (JWT)
check "JWT Dual Key 구조" \
    "$(grep -q 'current-key' "$BASE/infra/vault/rotation-policies.yaml" && echo true || echo false)"

check "JWT Previous Key 구조" \
    "$(grep -q 'previous-key' "$BASE/infra/vault/rotation-policies.yaml" && echo true || echo false)"

# FR-N103.5: 감사 로그 연동
check "audit-webhook.yaml 존재" \
    "$([ -f "$BASE/infra/vault/audit-webhook.yaml" ] && echo true || echo false)"

check "PrometheusRule 시크릿 만료 알림" \
    "$(grep -q 'SecretExpirationWarning' "$BASE/infra/vault/audit-webhook.yaml" && echo true || echo false)"

check "PrometheusRule 미교체 위험" \
    "$(grep -q 'SecretRotationOverdue' "$BASE/infra/vault/audit-webhook.yaml" && echo true || echo false)"

check "ExternalSecret 동기화 실패 알림" \
    "$(grep -q 'ExternalSecretSyncFailure' "$BASE/infra/vault/audit-webhook.yaml" && echo true || echo false)"

# CSAP D-09 참조
check "CSAP D-09 참조" \
    "$(grep -q 'D-09' "$BASE/infra/vault/audit-webhook.yaml" && echo true || echo false)"

echo ""
echo "=== 결과: $PASS/$TOTAL PASS, $FAIL FAIL ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
