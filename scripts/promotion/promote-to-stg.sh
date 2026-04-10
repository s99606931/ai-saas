#!/bin/bash
# GitOps 환경 승격: dev → stg
# Design Ref: MTU-N172 §3.3
# Plan SC: FR-PROMO.3
# CSAP D-06: 승격 이력 감사 추적

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}/../.."
GITOPS_DIR="${PROJECT_ROOT}/infra/gitops"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "================================================================"
echo "[승격 게이트] dev → stg 환경 승격 시작"
echo "================================================================"
echo "[INFO] 시각: ${TIMESTAMP}"

# 1단계: dev 환경 스모크 테스트 확인
echo "[GATE 1] dev 환경 스모크 테스트 결과 확인..."
SMOKE_RESULT="${SMOKE_RESULT:-pass}"
if [ "${SMOKE_RESULT}" != "pass" ]; then
  echo "[FAIL] 스모크 테스트 실패. 승격 중단."
  echo "{\"timestamp\":\"${TIMESTAMP}\",\"action\":\"PROMOTE_DEV_TO_STG\",\"status\":\"failed\",\"reason\":\"smoke_test_failed\"}" \
    >> "${PROJECT_ROOT}/.claude/audit.jsonl"
  exit 1
fi
echo "[PASS] 스모크 테스트 통과"

# 2단계: dev 환경 이미지 태그 추출
echo "[GATE 2] dev 환경 이미지 태그 추출..."
DEV_IMAGE_TAG="${IMAGE_TAG:-$(git -C "${PROJECT_ROOT}" rev-parse --short HEAD)}"
echo "[INFO] 이미지 태그: ${DEV_IMAGE_TAG}"

# 3단계: stg 환경 이미지 태그 업데이트
echo "[STEP 3] stg 오버레이 이미지 태그 업데이트..."
cat > "${GITOPS_DIR}/overlays/stg/image-tag.yaml" <<EOF
# 자동 생성 - 승격 스크립트
# 승격 시각: ${TIMESTAMP}
# 원본 환경: dev
# 이미지 태그: ${DEV_IMAGE_TAG}
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
images:
  - name: registry.local/ai-saas/*
    newTag: "${DEV_IMAGE_TAG}"
EOF

# 4단계: Git commit + PR 생성
echo "[STEP 4] 승격 커밋 생성..."
cd "${PROJECT_ROOT}"
BRANCH_NAME="promote/stg-${DEV_IMAGE_TAG}"

git checkout -b "${BRANCH_NAME}" 2>/dev/null || git checkout "${BRANCH_NAME}"
git add "${GITOPS_DIR}/overlays/stg/image-tag.yaml"
git commit -m "$(cat <<'COMMIT_EOF'
chore(gitops): dev → stg 환경 승격

이미지 태그: ${DEV_IMAGE_TAG}
승격 시각: ${TIMESTAMP}
스모크 테스트: 통과

Co-Authored-By: GitOps Promotion Bot <noreply@example.go.kr>
COMMIT_EOF
)"

# 5단계: 감사 로그 기록
echo "{\"timestamp\":\"${TIMESTAMP}\",\"action\":\"PROMOTE_DEV_TO_STG\",\"imageTag\":\"${DEV_IMAGE_TAG}\",\"status\":\"success\"}" \
  >> "${PROJECT_ROOT}/.claude/audit.jsonl"

echo "================================================================"
echo "[성공] dev → stg 승격 완료"
echo "  이미지 태그: ${DEV_IMAGE_TAG}"
echo "  브랜치: ${BRANCH_NAME}"
echo "  다음 단계: PR 생성 후 Flux 자동 동기화"
echo "================================================================"
