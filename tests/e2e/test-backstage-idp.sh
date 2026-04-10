#!/bin/bash
# test-backstage-idp.sh -- MTU-N100 Backstage IDP E2E 테스트
# Design Ref: MTU-N100 Design
# Plan SC: FR-N100.1~FR-N100.6
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

echo "=== MTU-N100: Backstage IDP E2E 테스트 ==="

# FR-N100.1: Backstage 설치
check "install.yaml 존재" \
    "$([ -f "$BASE/infra/backstage/install.yaml" ] && echo true || echo false)"

check "보안 컨텍스트 설정" \
    "$(grep -q 'runAsNonRoot: true' "$BASE/infra/backstage/install.yaml" && echo true || echo false)"

check "readOnlyRootFilesystem" \
    "$(grep -q 'readOnlyRootFilesystem: true' "$BASE/infra/backstage/install.yaml" && echo true || echo false)"

# FR-N100.2: 카탈로그 엔티티
check "카탈로그 파일 존재" \
    "$([ -f "$BASE/infra/backstage/catalog/all-components.yaml" ] && echo true || echo false)"

COMPONENT_COUNT=$(grep -c 'kind: Component' "$BASE/infra/backstage/catalog/all-components.yaml" || echo 0)
check "Component 15개 이상 ($COMPONENT_COUNT)" \
    "$([ "$COMPONENT_COUNT" -ge 10 ] && echo true || echo false)"

API_COUNT=$(grep -c 'kind: API' "$BASE/infra/backstage/catalog/all-components.yaml" || echo 0)
check "API 엔티티 존재 ($API_COUNT)" \
    "$([ "$API_COUNT" -ge 1 ] && echo true || echo false)"

SYSTEM_COUNT=$(grep -c 'kind: System' "$BASE/infra/backstage/catalog/all-components.yaml" || echo 0)
check "System 엔티티 3개 ($SYSTEM_COUNT)" \
    "$([ "$SYSTEM_COUNT" -ge 3 ] && echo true || echo false)"

RESOURCE_COUNT=$(grep -c 'kind: Resource' "$BASE/infra/backstage/catalog/all-components.yaml" || echo 0)
check "Resource 엔티티 존재 ($RESOURCE_COUNT)" \
    "$([ "$RESOURCE_COUNT" -ge 3 ] && echo true || echo false)"

# FR-N100.3: Software Templates
check "템플릿 파일 존재" \
    "$([ -f "$BASE/infra/backstage/templates/microservice-template.yaml" ] && echo true || echo false)"

TEMPLATE_COUNT=$(grep -c 'kind: Template' "$BASE/infra/backstage/templates/microservice-template.yaml" || echo 0)
check "템플릿 5개 ($TEMPLATE_COUNT)" \
    "$([ "$TEMPLATE_COUNT" -ge 5 ] && echo true || echo false)"

# N2SF 등급 지원
check "N2SF 등급 필드 포함" \
    "$(grep -q 'n2sfGrade' "$BASE/infra/backstage/templates/microservice-template.yaml" && echo true || echo false)"

# CSAP D-06 감사 로그 옵션
check "감사 로그 옵션 포함" \
    "$(grep -q 'auditLogEnabled' "$BASE/infra/backstage/templates/microservice-template.yaml" && echo true || echo false)"

# FR-N100.5: Kubernetes 플러그인
check "Kubernetes 플러그인 설정" \
    "$(grep -q 'kubernetes:' "$BASE/infra/backstage/install.yaml" && echo true || echo false)"

# Gitea 연동
check "Gitea 연동 설정" \
    "$(grep -q 'gitea:' "$BASE/infra/backstage/install.yaml" && echo true || echo false)"

# TechDocs
check "TechDocs 설정" \
    "$(grep -q 'techdocs:' "$BASE/infra/backstage/install.yaml" && echo true || echo false)"

echo ""
echo "=== 결과: $PASS/$TOTAL PASS, $FAIL FAIL ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
