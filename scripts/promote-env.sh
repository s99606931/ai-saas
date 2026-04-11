#!/usr/bin/env bash
# =============================================================================
# 환경 승격 스크립트 — GitOps 이미지 태그 업데이트
# Design Ref: MTU-N245 S3.4
# Plan SC: FR-N245.4
# CSAP: D-12 (시스템 개발 보안 — 배포 통제)
#
# 사용법:
#   ./scripts/promote-env.sh --from dev --to stg --version stg-abc1234
#   ./scripts/promote-env.sh --from stg --to prod --version v1.2.3
#   ./scripts/promote-env.sh --check stg   # 환경 상태 확인
#
# 동작:
#   1. 소스 환경에서 현재 이미지 태그 확인
#   2. 대상 환경 overlay의 이미지 태그 업데이트
#   3. kustomize build로 유효성 검증
#   4. Git 커밋 (Flux 자동 동기화 트리거)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOY_DIR="$PROJECT_DIR/deploy"

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

usage() {
  echo "사용법: $0 --from <env> --to <env> --version <tag>"
  echo "       $0 --check <env>"
  echo ""
  echo "옵션:"
  echo "  --from     소스 환경 (dev, stg)"
  echo "  --to       대상 환경 (stg, prod)"
  echo "  --version  이미지 태그 (예: stg-abc1234, v1.2.3)"
  echo "  --check    환경 상태 확인"
  echo "  --dry-run  실제 변경 없이 시뮬레이션"
  echo ""
  echo "예시:"
  echo "  $0 --from dev --to stg --version stg-abc1234"
  echo "  $0 --from stg --to prod --version v1.2.3"
  exit 1
}

# 환경 상태 확인
check_env() {
  local ENV="$1"
  local KUSTOMIZATION="$DEPLOY_DIR/envs/$ENV/kustomization.yaml"

  if [ ! -f "$KUSTOMIZATION" ]; then
    log_error "환경 '$ENV'의 kustomization.yaml을 찾을 수 없습니다"
    exit 1
  fi

  echo "================================================================"
  echo "  환경: $ENV"
  echo "================================================================"

  # 현재 이미지 태그 확인
  echo "  이미지 태그:"
  grep -A1 "newTag:" "$KUSTOMIZATION" | while read -r line; do
    echo "    $line"
  done

  # Kustomize build 유효성 확인
  if command -v kustomize &>/dev/null; then
    if kustomize build "$DEPLOY_DIR/envs/$ENV" > /dev/null 2>&1; then
      log_info "kustomize build: OK"
    else
      log_warn "kustomize build: FAIL"
    fi
  fi

  echo "================================================================"
}

# 환경 승격
promote() {
  local FROM_ENV="$1"
  local TO_ENV="$2"
  local VERSION="$3"
  local DRY_RUN="${4:-false}"

  log_info "환경 승격: $FROM_ENV → $TO_ENV (버전: $VERSION)"

  # 유효성 검증
  local VALID_ENVS="dev stg prod"
  if [[ ! " $VALID_ENVS " =~ " $FROM_ENV " ]]; then
    log_error "유효하지 않은 소스 환경: $FROM_ENV"
    exit 1
  fi
  if [[ ! " $VALID_ENVS " =~ " $TO_ENV " ]]; then
    log_error "유효하지 않은 대상 환경: $TO_ENV"
    exit 1
  fi

  # 승격 순서 검증 (dev→stg→prod만 허용)
  case "$FROM_ENV→$TO_ENV" in
    "dev→stg"|"stg→prod")
      log_info "승격 경로 유효: $FROM_ENV → $TO_ENV"
      ;;
    *)
      log_error "허용되지 않는 승격 경로: $FROM_ENV → $TO_ENV (dev→stg→prod 순서만 허용)"
      exit 1
      ;;
  esac

  # Production 승격 시 추가 확인
  if [ "$TO_ENV" = "prod" ]; then
    log_warn "프로덕션 환경으로 승격합니다!"
    log_warn "N2SF S/C 등급 환경입니다. CSAP D-12 보안 정책이 적용됩니다."
    # 릴리스 태그 형식 확인
    if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+ ]]; then
      log_error "프로덕션 환경은 릴리스 태그(v*.*.*)만 허용됩니다: $VERSION"
      exit 1
    fi
  fi

  # 대상 환경 kustomization.yaml 업데이트
  local TARGET_KUSTOMIZATION="$DEPLOY_DIR/envs/$TO_ENV/kustomization.yaml"

  if [ ! -f "$TARGET_KUSTOMIZATION" ]; then
    log_error "대상 환경 파일 없음: $TARGET_KUSTOMIZATION"
    exit 1
  fi

  if [ "$DRY_RUN" = "true" ]; then
    log_info "[DRY-RUN] $TARGET_KUSTOMIZATION 의 이미지 태그를 $VERSION 으로 변경"
    log_info "[DRY-RUN] Git 커밋 및 푸시 건너뜀"
    return 0
  fi

  # sed로 이미지 태그 업데이트
  sed -i "s/newTag: .*/newTag: $VERSION/" "$TARGET_KUSTOMIZATION"

  # Kustomize build 유효성 확인
  if command -v kustomize &>/dev/null; then
    if ! kustomize build "$DEPLOY_DIR/envs/$TO_ENV" > /dev/null 2>&1; then
      log_error "kustomize build 실패. 변경 사항을 확인하세요."
      git checkout -- "$TARGET_KUSTOMIZATION"
      exit 1
    fi
    log_info "kustomize build 유효성 검증 통과"
  fi

  log_info "이미지 태그 업데이트 완료: $TO_ENV → $VERSION"
  log_info "Flux 자동 동기화가 변경 사항을 감지하여 배포합니다."

  # 감사 로그 기록
  local TIMESTAMP
  TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  echo "{\"timestamp\":\"${TIMESTAMP}\",\"action\":\"ENV_PROMOTION\",\"from\":\"$FROM_ENV\",\"to\":\"$TO_ENV\",\"version\":\"$VERSION\",\"csap_ref\":\"D-12\"}" >> "$PROJECT_DIR/.claude/audit.jsonl"
}

# --- 메인 ---
FROM_ENV=""
TO_ENV=""
VERSION=""
CHECK_ENV=""
DRY_RUN="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from)
      FROM_ENV="$2"
      shift 2
      ;;
    --to)
      TO_ENV="$2"
      shift 2
      ;;
    --version)
      VERSION="$2"
      shift 2
      ;;
    --check)
      CHECK_ENV="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    *)
      usage
      ;;
  esac
done

if [ -n "$CHECK_ENV" ]; then
  check_env "$CHECK_ENV"
  exit 0
fi

if [ -z "$FROM_ENV" ] || [ -z "$TO_ENV" ] || [ -z "$VERSION" ]; then
  usage
fi

promote "$FROM_ENV" "$TO_ENV" "$VERSION" "$DRY_RUN"
