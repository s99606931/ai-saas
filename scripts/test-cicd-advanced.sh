#!/usr/bin/env bash
# =============================================================================
# CI/CD 고도화 통합 검증 스크립트
# Design Ref: MTU-N44 Design
# Plan SC: FR-N44.1, FR-N44.2, FR-N44.3
#
# MTU-N37 ~ MTU-N43 전체 산출물 존재 + 설정 유효성 검증
# =============================================================================

set -euo pipefail

PASS=0
FAIL=0
TOTAL=0

check() {
  TOTAL=$((TOTAL + 1))
  local DESC="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    PASS=$((PASS + 1))
    echo "  [PASS] ${DESC}"
  else
    FAIL=$((FAIL + 1))
    echo "  [FAIL] ${DESC}"
  fi
}

echo "================================================================"
echo "  CI/CD 고도화 통합 검증 -- $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "================================================================"
echo ""

cd /data/ai-saas

# ===== MTU-N37: SBOM + Grype =====
echo "--- MTU-N37: SBOM + Grype 파이프라인 ---"
check "sbom-scan.yml 존재" test -f .gitea/workflows/sbom-scan.yml
check ".grype.yaml 존재" test -f infra/security/.grype.yaml
check "ci-cd-pipeline.yml에 SBOM 단계" grep -q "SBOM" .gitea/workflows/ci-cd-pipeline.yml
check "SBOM 운영 가이드" test -f docs/framework/08-infra/supply-chain/sbom-pipeline-guide.md
check ".grype.yaml fail-on-severity" grep -q "fail-on-severity: high" infra/security/.grype.yaml
echo ""

# ===== MTU-N38: 워크플로우 최적화 =====
echo "--- MTU-N38: 워크플로우 최적화 ---"
check "setup-node-pnpm.yml 존재" test -f .gitea/workflows/setup-node-pnpm.yml
check "ci.yml pnpm 캐싱" grep -q "pnpm-store" .gitea/workflows/ci.yml
check "ci.yml concurrency" grep -q "concurrency" .gitea/workflows/ci.yml
check "ci-cd-pipeline.yml pnpm 캐싱" grep -q "pnpm-store" .gitea/workflows/ci-cd-pipeline.yml
echo ""

# ===== MTU-N39: Sealed Secrets =====
echo "--- MTU-N39: Sealed Secrets ---"
check "values.yaml 존재" test -f infra/sealed-secrets/values.yaml
check "kustomization.yaml 존재" test -f infra/sealed-secrets/kustomization.yaml
check "SealedSecret 템플릿 5개+" test "$(ls infra/sealed-secrets/templates/*.yaml 2>/dev/null | wc -l)" -ge 5
check "Kyverno strict scope 정책" test -f infra/sealed-secrets/templates/sealed-secret-policy.yaml
check "운영 가이드" test -f docs/framework/08-infra/sealed-secrets-guide.md
echo ""

# ===== MTU-N40: Flagger 카나리 =====
echo "--- MTU-N40: Flagger 카나리 배포 ---"
check "flagger values.yaml" test -f infra/flagger/values.yaml
check "canary-api-gateway.yaml" test -f infra/flagger/canary-api-gateway.yaml
check "metric-templates.yaml" test -f infra/flagger/metric-templates.yaml
check "alert-provider.yaml" test -f infra/flagger/alert-provider.yaml
check "카나리 배포 가이드" test -f docs/framework/08-infra/canary-deployment-guide.md
echo ""

# ===== MTU-N41: 멀티환경 GitOps =====
echo "--- MTU-N41: 멀티환경 GitOps ---"
check "deploy/base/ 존재" test -d deploy/base
check "deploy/envs/dev/ 존재" test -d deploy/envs/dev
check "deploy/envs/stg/ 존재" test -d deploy/envs/stg
check "deploy/envs/prod/ 존재" test -d deploy/envs/prod
check "Flux dev kustomization" test -f infra/flux/environments/dev-kustomization.yaml
check "Flux stg kustomization" test -f infra/flux/environments/stg-kustomization.yaml
check "Flux prod kustomization" test -f infra/flux/environments/prod-kustomization.yaml
check "멀티환경 가이드" test -f docs/framework/08-infra/multi-env-gitops-guide.md
echo ""

# ===== MTU-N42: Semantic Release =====
echo "--- MTU-N42: Semantic Release ---"
check ".releaserc.yaml 존재" test -f .releaserc.yaml
check "commitlint.config.js 존재" test -f commitlint.config.js
check "release.yml 워크플로우" test -f .gitea/workflows/release.yml
check "릴리스 가이드" test -f docs/framework/08-infra/release-automation-guide.md
echo ""

# ===== MTU-N43: 파이프라인 벤치마크 =====
echo "--- MTU-N43: 파이프라인 벤치마크 ---"
check "benchmark-pipeline.sh 존재" test -f scripts/benchmark-pipeline.sh
check "benchmark-pipeline.sh 실행 권한" test -x scripts/benchmark-pipeline.sh
check "Grafana 대시보드" test -f infra/monitoring/dashboards/pipeline-metrics.yaml
check "성능 가이드" test -f docs/framework/08-infra/pipeline-performance-guide.md
echo ""

# ===== CSAP 매핑 검증 =====
echo "--- CSAP D-12 매핑 검증 ---"
check "D-12 참조 (sbom-scan.yml)" grep -q "D-12" .gitea/workflows/sbom-scan.yml
check "D-06 참조 (sbom-scan.yml)" grep -q "D-06" .gitea/workflows/sbom-scan.yml
check "D-09 참조 (sealed-secrets)" grep -q "D-09" infra/sealed-secrets/values.yaml
check "CSAP 참조 (ci-cd-pipeline.yml)" grep -q "CSAP" .gitea/workflows/ci-cd-pipeline.yml
echo ""

# ===== Gitea 워크플로우 전체 =====
echo "--- Gitea 워크플로우 전체 목록 ---"
ls -la .gitea/workflows/*.yml 2>/dev/null
echo ""

# 결과 요약
echo "================================================================"
echo "  통합 검증 결과"
echo "================================================================"
echo "  총 테스트: ${TOTAL}"
echo "  통과:     ${PASS}"
echo "  실패:     ${FAIL}"
RATE=$(echo "scale=1; $PASS * 100 / $TOTAL" | bc 2>/dev/null || echo "$(($PASS * 100 / $TOTAL))")
echo "  통과율:   ${RATE}%"
echo "================================================================"

if [ "$FAIL" -eq 0 ]; then
  echo "  [ALL PASS] CI/CD 고도화 MTU-N37~N43 전체 검증 성공"
  exit 0
else
  echo "  [PARTIAL] ${FAIL}건 실패 -- 확인 필요"
  exit 1
fi
