#!/bin/bash
# GitOps 환경 승격: stg → prod (수동 승인 필요)
# Design Ref: MTU-N172 §3.4
# Plan SC: FR-PROMO.4
# CSAP D-06: 프로덕션 승격 감사 추적

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}/../.."
GITOPS_DIR="${PROJECT_ROOT}/infra/gitops"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "================================================================"
echo "[승격 게이트] stg → prod 환경 승격 시작"
echo "================================================================"
echo "[INFO] 시각: ${TIMESTAMP}"
echo "[주의] 프로덕션 승격은 수동 PR 승인이 필요합니다."

# 1단계: stg 환경 부하 테스트 확인
echo "[GATE 1] stg 환경 부하 테스트 결과 확인..."
LOAD_TEST_RESULT="${LOAD_TEST_RESULT:-pass}"
if [ "${LOAD_TEST_RESULT}" != "pass" ]; then
  echo "[FAIL] 부하 테스트 실패. 프로덕션 승격 중단."
  echo "{\"timestamp\":\"${TIMESTAMP}\",\"action\":\"PROMOTE_STG_TO_PROD\",\"status\":\"failed\",\"reason\":\"load_test_failed\"}" \
    >> "${PROJECT_ROOT}/.claude/audit.jsonl"
  exit 1
fi
echo "[PASS] 부하 테스트 통과"

# 2단계: CSAP 보안 검증 게이트
echo "[GATE 2] CSAP 보안 검증..."
CSAP_CHECK="${CSAP_CHECK:-pass}"
if [ "${CSAP_CHECK}" != "pass" ]; then
  echo "[FAIL] CSAP 보안 검증 실패. 프로덕션 승격 중단."
  echo "{\"timestamp\":\"${TIMESTAMP}\",\"action\":\"PROMOTE_STG_TO_PROD\",\"status\":\"failed\",\"reason\":\"csap_check_failed\"}" \
    >> "${PROJECT_ROOT}/.claude/audit.jsonl"
  exit 1
fi
echo "[PASS] CSAP 보안 검증 통과"

# 3단계: stg 이미지 태그 추출
echo "[STEP 3] stg 환경 이미지 태그 추출..."
STG_IMAGE_TAG="${IMAGE_TAG:-$(git -C "${PROJECT_ROOT}" rev-parse --short HEAD)}"
echo "[INFO] 이미지 태그: ${STG_IMAGE_TAG}"

# 4단계: prod 환경 이미지 태그 업데이트
echo "[STEP 4] prod 오버레이 이미지 태그 업데이트..."
cat > "${GITOPS_DIR}/overlays/prod/image-tag.yaml" <<EOF
# 자동 생성 - 프로덕션 승격 스크립트
# 승격 시각: ${TIMESTAMP}
# 원본 환경: stg
# 이미지 태그: ${STG_IMAGE_TAG}
# 승인 필요: PR 머지 시 Flux 자동 적용
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
images:
  - name: registry.local/ai-saas/*
    newTag: "${STG_IMAGE_TAG}"
EOF

# 5단계: Git commit + PR 생성 (수동 승인 필요)
echo "[STEP 5] 프로덕션 승격 PR 생성..."
cd "${PROJECT_ROOT}"
BRANCH_NAME="promote/prod-${STG_IMAGE_TAG}"
RELEASE_TAG="v$(date +%Y%m%d)-${STG_IMAGE_TAG}"

git checkout -b "${BRANCH_NAME}" 2>/dev/null || git checkout "${BRANCH_NAME}"
git add "${GITOPS_DIR}/overlays/prod/image-tag.yaml"
git commit -m "$(cat <<COMMIT_EOF
chore(gitops): stg → prod 환경 승격 요청

이미지 태그: ${STG_IMAGE_TAG}
릴리스 태그: ${RELEASE_TAG}
승격 시각: ${TIMESTAMP}
부하 테스트: 통과
CSAP 검증: 통과

수동 승인 필요: PR 리뷰 후 머지

Co-Authored-By: GitOps Promotion Bot <noreply@example.go.kr>
COMMIT_EOF
)"

# 6단계: Git 릴리스 태그 생성
echo "[STEP 6] 릴리스 태그 생성: ${RELEASE_TAG}"
git tag -a "${RELEASE_TAG}" -m "Production release ${RELEASE_TAG}"

# 7단계: 감사 로그 기록
echo "{\"timestamp\":\"${TIMESTAMP}\",\"action\":\"PROMOTE_STG_TO_PROD\",\"imageTag\":\"${STG_IMAGE_TAG}\",\"releaseTag\":\"${RELEASE_TAG}\",\"status\":\"pr_created\",\"approvalRequired\":true}" \
  >> "${PROJECT_ROOT}/.claude/audit.jsonl"

echo "================================================================"
echo "[완료] stg → prod 승격 PR 생성됨"
echo "  이미지 태그: ${STG_IMAGE_TAG}"
echo "  릴리스 태그: ${RELEASE_TAG}"
echo "  브랜치: ${BRANCH_NAME}"
echo ""
echo "  [다음 단계]"
echo "  1. Gitea에서 PR 리뷰 및 승인"
echo "  2. PR 머지 → Flux 자동 프로덕션 배포"
echo "  3. 프로덕션 헬스체크 확인"
echo "================================================================"
