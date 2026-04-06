#!/bin/bash
# 공공기관 SaaS 프레임워크 — 전체 Docker 빌드 스크립트
# Design Ref: DESIGN-MTU-DEP2 | CSAP: D-11
#
# 사용법:
#   ./scripts/build-all.sh              # 전체 빌드
#   ./scripts/build-all.sh --parallel   # 병렬 빌드 (4 동시)
#   ./scripts/build-all.sh auth-service # 특정 서비스만

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REGISTRY="${DOCKER_REGISTRY:-saas}"
TAG="${DOCKER_TAG:-dev}"
PARALLEL="${1:-}"
MAX_PARALLEL=4

# 서비스 목록 (포트 순서)
SERVICES=(
  "api-gateway"
  "auth-service"
  "user-service"
  "tenant-service"
  "menu-service"
  "saas-catalog-service"
  "subscription-service"
  "billing-service"
  "crm-service"
  "ai-service"
  "notification-service"
  "file-service"
  "audit-service"
  "compliance-service"
  "security-monitor-service"
)

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

build_service() {
  local svc=$1
  local dockerfile="platform/services/${svc}/Dockerfile"
  local image="${REGISTRY}/${svc}:${TAG}"

  if [ ! -f "${PROJECT_ROOT}/${dockerfile}" ]; then
    log_warn "Dockerfile 없음: ${dockerfile} (건너뜀)"
    return 0
  fi

  log_info "빌드 시작: ${svc} -> ${image}"
  if docker build -t "${image}" -f "${PROJECT_ROOT}/${dockerfile}" "${PROJECT_ROOT}" 2>&1; then
    log_info "빌드 성공: ${svc}"
    return 0
  else
    log_error "빌드 실패: ${svc}"
    return 1
  fi
}

build_portal() {
  local image="${REGISTRY}/portal:${TAG}"
  local dockerfile="platform/apps/portal/Dockerfile"

  log_info "빌드 시작: portal -> ${image}"
  if docker build -t "${image}" -f "${PROJECT_ROOT}/${dockerfile}" "${PROJECT_ROOT}" 2>&1; then
    log_info "빌드 성공: portal"
    return 0
  else
    log_error "빌드 실패: portal"
    return 1
  fi
}

# 특정 서비스만 빌드
if [ -n "${PARALLEL}" ] && [ "${PARALLEL}" != "--parallel" ]; then
  build_service "${PARALLEL}"
  exit $?
fi

echo ""
echo "==========================================="
echo "  공공기관 SaaS 프레임워크 Docker 빌드"
echo "  레지스트리: ${REGISTRY}"
echo "  태그: ${TAG}"
echo "  서비스: ${#SERVICES[@]}개 + portal"
echo "==========================================="
echo ""

FAILED=0
PASSED=0

# 포털 빌드
if build_portal; then
  PASSED=$((PASSED + 1))
else
  FAILED=$((FAILED + 1))
fi

# 서비스 빌드
if [ "${PARALLEL}" = "--parallel" ]; then
  log_info "병렬 빌드 모드 (최대 ${MAX_PARALLEL} 동시)"
  PIDS=()
  for svc in "${SERVICES[@]}"; do
    build_service "${svc}" &
    PIDS+=($!)
    if [ ${#PIDS[@]} -ge ${MAX_PARALLEL} ]; then
      for pid in "${PIDS[@]}"; do
        if wait "$pid"; then
          PASSED=$((PASSED + 1))
        else
          FAILED=$((FAILED + 1))
        fi
      done
      PIDS=()
    fi
  done
  for pid in "${PIDS[@]}"; do
    if wait "$pid"; then
      PASSED=$((PASSED + 1))
    else
      FAILED=$((FAILED + 1))
    fi
  done
else
  for svc in "${SERVICES[@]}"; do
    if build_service "${svc}"; then
      PASSED=$((PASSED + 1))
    else
      FAILED=$((FAILED + 1))
    fi
  done
fi

echo ""
echo "==========================================="
echo "  빌드 결과"
echo "  성공: ${PASSED}"
echo "  실패: ${FAILED}"
echo "  합계: $((PASSED + FAILED)) / $((${#SERVICES[@]} + 1))"
echo "==========================================="

if [ ${FAILED} -gt 0 ]; then
  log_error "${FAILED}개 서비스 빌드 실패"
  exit 1
fi

log_info "전체 빌드 성공"

# 이미지 목록 출력
echo ""
log_info "빌드된 이미지:"
docker images --format "  {{.Repository}}:{{.Tag}}\t{{.Size}}" | grep "${REGISTRY}/" | sort
