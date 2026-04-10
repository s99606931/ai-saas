#!/bin/bash
# Design Ref: MTU-N237
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
check() {
  TOTAL=$((TOTAL + 1))
  if [ "$2" = "0" ]; then echo "  [PASS] $1"; PASS=$((PASS + 1))
  else echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); fi
}

echo "============================================"
echo " MTU-N237: Hotfix 파이프라인 검증"
echo "============================================"

echo ""
echo "[TC-01] Gitea Actions 워크플로우"
test -f .gitea/workflows/hotfix-pipeline.yaml; check "워크플로우 파일 존재" $?
grep -q "hotfix/" .gitea/workflows/hotfix-pipeline.yaml; check "hotfix 브랜치 트리거" $?
grep -q "build-and-test" .gitea/workflows/hotfix-pipeline.yaml; check "빌드+테스트 단계" $?
grep -q "security-scan" .gitea/workflows/hotfix-pipeline.yaml; check "보안 스캔 단계" $?
grep -q "staging-deploy" .gitea/workflows/hotfix-pipeline.yaml; check "스테이징 배포 단계" $?
grep -q "production-deploy" .gitea/workflows/hotfix-pipeline.yaml; check "프로덕션 배포 단계" $?
grep -q "environment: production" .gitea/workflows/hotfix-pipeline.yaml; check "수동 승인 게이트" $?
grep -q "trivy" .gitea/workflows/hotfix-pipeline.yaml; check "Trivy 보안 스캔" $?
grep -q "cosign" .gitea/workflows/hotfix-pipeline.yaml; check "Cosign 서명" $?
grep -q "rollback" .gitea/workflows/hotfix-pipeline.yaml; check "자동 롤백 포함" $?
grep -q "audit" .gitea/workflows/hotfix-pipeline.yaml; check "감사 로그 기록" $?

echo ""
echo "[TC-02] 배포 스크립트"
test -f scripts/hotfix-deploy.sh; check "hotfix-deploy.sh 존재" $?
grep -q "verify_deployment" scripts/hotfix-deploy.sh; check "배포 검증 함수" $?
grep -q "\-\-verify-only" scripts/hotfix-deploy.sh; check "검증 전용 모드" $?
grep -q "helm upgrade" scripts/hotfix-deploy.sh; check "Helm 배포" $?

echo ""
echo "[TC-03] 롤백 스크립트"
test -f scripts/hotfix-rollback.sh; check "hotfix-rollback.sh 존재" $?
grep -q "helm rollback" scripts/hotfix-rollback.sh; check "Helm 롤백" $?
grep -q "audit" scripts/hotfix-rollback.sh; check "롤백 감사 로그" $?

echo ""
echo "[TC-04] 보안 검증"
grep -q "CRITICAL,HIGH" .gitea/workflows/hotfix-pipeline.yaml; check "Critical/High 차단" $?
grep -q "COSIGN" .gitea/workflows/hotfix-pipeline.yaml; check "Cosign 시크릿 참조" $?
! grep -q "password\|secret_key" .gitea/workflows/hotfix-pipeline.yaml; check "하드코딩 시크릿 없음" $?

echo ""
echo "[TC-05] Design/Plan 추적성"
grep -q "Design Ref" .gitea/workflows/hotfix-pipeline.yaml; check "워크플로우 Design Ref" $?
grep -q "Design Ref" scripts/hotfix-deploy.sh; check "배포 스크립트 Design Ref" $?
grep -q "Plan SC" scripts/hotfix-deploy.sh; check "배포 스크립트 Plan SC" $?

echo ""
echo "============================================"
echo " 결과: $PASS / $TOTAL PASS  ($FAIL FAIL)"
echo "============================================"
[ "$FAIL" -eq 0 ] && echo "ALL TESTS PASSED" || echo "SOME TESTS FAILED"
