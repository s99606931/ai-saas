#!/bin/bash
# test-argo-rollouts.sh -- MTU-N101 Argo Rollouts E2E 테스트
# Design Ref: MTU-N101 Design
# Plan SC: FR-N101.1~FR-N101.6
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

echo "=== MTU-N101: Argo Rollouts E2E 테스트 ==="

# FR-N101.1: 설치
check "install.yaml 존재" \
    "$([ -f "$BASE/infra/argo-rollouts/install.yaml" ] && echo true || echo false)"

check "ServiceMonitor 활성화" \
    "$(grep -q 'serviceMonitor' "$BASE/infra/argo-rollouts/install.yaml" && echo true || echo false)"

check "보안 컨텍스트" \
    "$(grep -q 'runAsNonRoot: true' "$BASE/infra/argo-rollouts/install.yaml" && echo true || echo false)"

# FR-N101.2: Blue/Green
check "blue-green-rollout.yaml 존재" \
    "$([ -f "$BASE/infra/argo-rollouts/blue-green-rollout.yaml" ] && echo true || echo false)"

check "Blue/Green 전략 정의" \
    "$(grep -q 'blueGreen:' "$BASE/infra/argo-rollouts/blue-green-rollout.yaml" && echo true || echo false)"

check "Active/Preview Service 쌍" \
    "$(grep -q 'activeService:' "$BASE/infra/argo-rollouts/blue-green-rollout.yaml" && echo true || echo false)"

check "prePromotionAnalysis 설정" \
    "$(grep -q 'prePromotionAnalysis' "$BASE/infra/argo-rollouts/blue-green-rollout.yaml" && echo true || echo false)"

# FR-N101.3: A/B 테스트
check "ab-test-rollout.yaml 존재" \
    "$([ -f "$BASE/infra/argo-rollouts/ab-test-rollout.yaml" ] && echo true || echo false)"

check "Header 기반 라우팅" \
    "$(grep -q 'setHeaderRoute' "$BASE/infra/argo-rollouts/ab-test-rollout.yaml" && echo true || echo false)"

check "가중치 기반 단계" \
    "$(grep -q 'setWeight:' "$BASE/infra/argo-rollouts/ab-test-rollout.yaml" && echo true || echo false)"

# FR-N101.4: AnalysisTemplates
check "analysis-templates.yaml 존재" \
    "$([ -f "$BASE/infra/argo-rollouts/analysis-templates.yaml" ] && echo true || echo false)"

AT_COUNT=$(grep -c 'kind: AnalysisTemplate' "$BASE/infra/argo-rollouts/analysis-templates.yaml" || echo 0)
check "AnalysisTemplate 3개 ($AT_COUNT)" \
    "$([ "$AT_COUNT" -ge 3 ] && echo true || echo false)"

check "Prometheus 메트릭 프로바이더" \
    "$(grep -q 'prometheus:' "$BASE/infra/argo-rollouts/analysis-templates.yaml" && echo true || echo false)"

# 보안: Pod Security
check "readOnlyRootFilesystem (B/G)" \
    "$(grep -q 'readOnlyRootFilesystem: true' "$BASE/infra/argo-rollouts/blue-green-rollout.yaml" && echo true || echo false)"

check "capabilities drop ALL (B/G)" \
    "$(grep -q 'drop:' "$BASE/infra/argo-rollouts/blue-green-rollout.yaml" && echo true || echo false)"

echo ""
echo "=== 결과: $PASS/$TOTAL PASS, $FAIL FAIL ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
