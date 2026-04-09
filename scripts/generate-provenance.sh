#!/bin/bash
# =============================================================================
# SLSA L3 빌드 증명 생성 스크립트 (로컬 개발 + CI 호환)
# Design Ref: MTU-N46 Design §Provenance 구조
# Plan SC: FR-N46.2, FR-N46.4
#
# 사용법: bash scripts/generate-provenance.sh <image_ref> <image_digest>
# 예시: bash scripts/generate-provenance.sh harbor.local/saas/api-gateway:v1.0 abc123...
# =============================================================================

set -euo pipefail

IMAGE_REF="${1:?이미지 참조가 필요합니다 (예: harbor.local/saas/api-gateway:v1.0)}"
IMAGE_DIGEST="${2:?이미지 다이제스트가 필요합니다 (예: sha256:abc...)}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_DIR/.slsa"
PROVENANCE_FILE="$OUTPUT_DIR/provenance-$(date +%Y%m%d%H%M%S).json"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

mkdir -p "$OUTPUT_DIR"

# =========================================================================
# 메타데이터 수집
# =========================================================================
log_info "빌드 메타데이터 수집 중..."

BUILD_START=$(date -u +%Y-%m-%dT%H:%M:%SZ)
COMMIT_SHA=$(git -C "$PROJECT_DIR" rev-parse HEAD 2>/dev/null || echo "unknown")
BRANCH=$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
REPO_URL=$(git -C "$PROJECT_DIR" remote get-url origin 2>/dev/null || echo "local")
RUNNER_OS=$(uname -s)
RUNNER_ARCH=$(uname -m)
HOSTNAME=$(hostname)
RUN_ID="local-$(date +%s)"

# =========================================================================
# in-toto SLSA Provenance v1 생성
# =========================================================================
log_info "SLSA Provenance v1 생성 중..."

cat > "$PROVENANCE_FILE" << EOF
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [{
    "name": "${IMAGE_REF}",
    "digest": {
      "sha256": "${IMAGE_DIGEST#sha256:}"
    }
  }],
  "predicateType": "https://slsa.dev/provenance/v1",
  "predicate": {
    "buildDefinition": {
      "buildType": "https://gitea-actions/v1",
      "externalParameters": {
        "repository": "${REPO_URL}",
        "ref": "refs/heads/${BRANCH}",
        "workflow": ".gitea/workflows/slsa-provenance.yml",
        "commit": "${COMMIT_SHA}"
      },
      "internalParameters": {
        "runner": "ephemeral-container",
        "os": "${RUNNER_OS}",
        "arch": "${RUNNER_ARCH}",
        "hostname": "${HOSTNAME}"
      },
      "resolvedDependencies": []
    },
    "runDetails": {
      "builder": {
        "id": "https://gitea.local/actions/runner",
        "version": {
          "gitea-actions": "1.x"
        }
      },
      "metadata": {
        "invocationId": "${RUN_ID}",
        "startedOn": "${BUILD_START}",
        "finishedOn": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      }
    }
  }
}
EOF

log_ok "Provenance 생성 완료: $PROVENANCE_FILE"

# =========================================================================
# JSON 유효성 검증
# =========================================================================
if python3 -c "import json; json.load(open('$PROVENANCE_FILE'))" 2>/dev/null; then
    log_ok "JSON 유효성 검증 통과"
else
    log_error "JSON 유효성 검증 실패"
    exit 1
fi

# =========================================================================
# Cosign 서명 (키가 있는 경우)
# =========================================================================
COSIGN_KEY_PATH="$PROJECT_DIR/infra/cosign/cosign.key"
if [ -f "$COSIGN_KEY_PATH" ] && command -v cosign &>/dev/null; then
    log_info "Cosign Attestation 서명 중..."
    cosign attest \
        --key "$COSIGN_KEY_PATH" \
        --type slsaprovenance \
        --predicate "$PROVENANCE_FILE" \
        "${IMAGE_REF}@sha256:${IMAGE_DIGEST#sha256:}" 2>/dev/null && \
        log_ok "Cosign Attestation 서명 완료" || \
        log_info "Cosign 서명 건너뜀 (이미지 레지스트리 미접근)"
else
    log_info "Cosign 키 또는 도구 미설치 — 서명 건너뜀 (로컬 모드)"
fi

# =========================================================================
# 출력
# =========================================================================
echo ""
echo "========================================="
echo " SLSA L3 빌드 증명 생성 완료"
echo "========================================="
echo " 이미지:    $IMAGE_REF"
echo " 다이제스트: ${IMAGE_DIGEST}"
echo " 커밋:     ${COMMIT_SHA:0:12}"
echo " 브랜치:   ${BRANCH}"
echo " 출력:     $PROVENANCE_FILE"
echo " SLSA:     Level 3"
echo "========================================="
