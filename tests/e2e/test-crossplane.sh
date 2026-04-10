#!/bin/bash
# test-crossplane.sh -- MTU-N99 Crossplane IaC E2E 테스트
# Design Ref: MTU-N99 Design
# Plan SC: FR-N99.1~FR-N99.6
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

echo "=== MTU-N99: Crossplane IaC E2E 테스트 ==="

# FR-N99.1: Crossplane 설치
check "install.yaml 존재" \
    "$([ -f "$BASE/infra/crossplane/install.yaml" ] && echo true || echo false)"

check "보안 컨텍스트 설정" \
    "$(grep -q 'runAsNonRoot: true' "$BASE/infra/crossplane/install.yaml" && echo true || echo false)"

# FR-N99.2: Provider-Kubernetes
check "provider-kubernetes.yaml 존재" \
    "$([ -f "$BASE/infra/crossplane/provider-kubernetes.yaml" ] && echo true || echo false)"

check "ProviderConfig 정의" \
    "$(grep -q 'kind: ProviderConfig' "$BASE/infra/crossplane/provider-kubernetes.yaml" && echo true || echo false)"

# FR-N99.3: XRD 3개
check "XDatabase XRD 존재" \
    "$([ -f "$BASE/infra/crossplane/xrd/xdatabase.yaml" ] && echo true || echo false)"

check "XCache XRD 존재" \
    "$([ -f "$BASE/infra/crossplane/xrd/xcache.yaml" ] && echo true || echo false)"

check "XNamespace XRD 존재" \
    "$([ -f "$BASE/infra/crossplane/xrd/xnamespace.yaml" ] && echo true || echo false)"

check "XDatabase N2SF 등급 필드" \
    "$(grep -q 'n2sfGrade' "$BASE/infra/crossplane/xrd/xdatabase.yaml" && echo true || echo false)"

check "XNamespace 테넌트 필드" \
    "$(grep -q 'tenantName' "$BASE/infra/crossplane/xrd/xnamespace.yaml" && echo true || echo false)"

# FR-N99.4: Compositions
check "Database Composition 존재" \
    "$([ -f "$BASE/infra/crossplane/compositions/database-composition.yaml" ] && echo true || echo false)"

check "Cache Composition 존재" \
    "$([ -f "$BASE/infra/crossplane/compositions/cache-composition.yaml" ] && echo true || echo false)"

check "Namespace Composition 존재" \
    "$([ -f "$BASE/infra/crossplane/compositions/namespace-composition.yaml" ] && echo true || echo false)"

# Composition에 NetworkPolicy 포함 (보안)
check "Namespace Composition에 NetworkPolicy 포함" \
    "$(grep -q 'NetworkPolicy' "$BASE/infra/crossplane/compositions/namespace-composition.yaml" && echo true || echo false)"

check "Namespace Composition에 ResourceQuota 포함" \
    "$(grep -q 'ResourceQuota' "$BASE/infra/crossplane/compositions/namespace-composition.yaml" && echo true || echo false)"

# FR-N99.5: Claims 예제
check "Claim 예제 존재" \
    "$([ -f "$BASE/infra/crossplane/claims/example-database.yaml" ] && echo true || echo false)"

XRD_COUNT=$(ls "$BASE/infra/crossplane/xrd/" | wc -l)
COMP_COUNT=$(ls "$BASE/infra/crossplane/compositions/" | wc -l)
check "XRD 3개 확인 ($XRD_COUNT)" \
    "$([ "$XRD_COUNT" -ge 3 ] && echo true || echo false)"

check "Composition 3개 이상 ($COMP_COUNT)" \
    "$([ "$COMP_COUNT" -ge 3 ] && echo true || echo false)"

# PSS restricted 프로필
check "Pod Security Standards restricted" \
    "$(grep -q 'pod-security.kubernetes.io/enforce: restricted' "$BASE/infra/crossplane/compositions/namespace-composition.yaml" && echo true || echo false)"

echo ""
echo "=== 결과: $PASS/$TOTAL PASS, $FAIL FAIL ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
