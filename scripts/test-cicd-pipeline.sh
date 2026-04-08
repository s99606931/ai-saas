#!/bin/bash
# CI/CD 파이프라인 End-to-End 검증 스크립트
# Design Ref: MTU-N14 | Plan SC: FR-N14.1~FR-N14.8
# CSAP: D-12 (시스템 개발 보안 -- 통합시험 자동화)
#
# 사용법:
#   ./scripts/test-cicd-pipeline.sh              # 전체 검증
#   ./scripts/test-cicd-pipeline.sh --quick      # 빠른 인프라 확인만
#   ./scripts/test-cicd-pipeline.sh --build      # 이미지 빌드+push 검증 포함
#
# 사전 조건:
#   - setup-wsl2-all.sh 실행 완료

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

GITEA_URL="http://localhost:3000"
HARBOR_URL="http://localhost:8080"
HARBOR_PROJECT="public-saas"
TEST_SERVICE="api-gateway"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PASSED=0
FAILED=0
WARNED=0
TOTAL=0
RESULTS=()

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${BLUE}[STEP]${NC}  $1"; }

# ============================================================
# 결과 기록 헬퍼
# ============================================================
record_pass() {
  TOTAL=$((TOTAL + 1))
  PASSED=$((PASSED + 1))
  RESULTS+=("[PASS] $1")
  log_info "  [PASS] $1"
}

record_fail() {
  TOTAL=$((TOTAL + 1))
  FAILED=$((FAILED + 1))
  RESULTS+=("[FAIL] $1 -- $2")
  log_error "  [FAIL] $1"
  log_error "         $2"
}

record_warn() {
  TOTAL=$((TOTAL + 1))
  WARNED=$((WARNED + 1))
  RESULTS+=("[WARN] $1 -- $2")
  log_warn "  [WARN] $1"
  log_warn "         $2"
}

# ============================================================
# Phase 1: 인프라 상태 확인
# ============================================================
phase1_infrastructure() {
  log_step "Phase 1: 인프라 상태 확인"
  echo ""

  # 1-1. Docker 데몬
  if docker info &>/dev/null; then
    record_pass "Docker 데몬 실행 중"
  else
    record_fail "Docker 데몬" "docker info 실패. Docker Desktop을 확인하십시오."
  fi

  # 1-2. Gitea 접속
  if curl -sf "${GITEA_URL}/api/v1/version" &>/dev/null; then
    local gitea_ver
    gitea_ver=$(curl -sf "${GITEA_URL}/api/v1/version" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
    record_pass "Gitea 접속 확인 (v${gitea_ver}, ${GITEA_URL})"
  else
    record_fail "Gitea 접속" "curl ${GITEA_URL} 실패. setup-gitea-wsl2.sh 실행 필요."
  fi

  # 1-3. PostgreSQL
  if docker exec gitea-postgres pg_isready -U gitea &>/dev/null 2>&1; then
    record_pass "PostgreSQL 접속 확인 (localhost:5433)"
  else
    record_fail "PostgreSQL 접속" "gitea-postgres 컨테이너 확인 필요"
  fi

  # 1-4. Harbor 접속
  if curl -sf "${HARBOR_URL}/api/v2.0/systeminfo" &>/dev/null; then
    local harbor_ver
    harbor_ver=$(curl -sf "${HARBOR_URL}/api/v2.0/systeminfo" | grep -o '"harbor_version":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
    record_pass "Harbor 접속 확인 (${harbor_ver}, ${HARBOR_URL})"
  else
    record_warn "Harbor 접속" "Harbor가 실행 중이지 않습니다. setup-harbor-wsl2.sh 실행 필요."
  fi

  # 1-5. Act Runner
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "gitea-runner"; then
    record_pass "Act Runner 실행 중"
  else
    record_warn "Act Runner" "gitea-runner 컨테이너가 실행 중이지 않습니다."
  fi

  # 1-6. k3s 클러스터
  if command -v kubectl &>/dev/null && kubectl get nodes --no-headers 2>/dev/null | grep -q "Ready"; then
    local node_info
    node_info=$(kubectl get nodes --no-headers 2>/dev/null | awk '{print $1, $2, $5}')
    record_pass "k3s 클러스터 Ready (${node_info})"
  else
    record_warn "k3s 클러스터" "k3s가 실행 중이지 않거나 노드가 Ready가 아닙니다."
  fi

  # 1-7. Docker 네트워크
  if docker network ls --format '{{.Name}}' 2>/dev/null | grep -q "saas-cicd"; then
    record_pass "saas-cicd Docker 네트워크 존재"
  else
    record_warn "saas-cicd 네트워크" "네트워크가 없습니다. Gitea docker-compose 실행 필요."
  fi

  echo ""
}

# ============================================================
# Phase 2: CI/CD 파이프라인 구성 확인
# ============================================================
phase2_cicd_config() {
  log_step "Phase 2: CI/CD 파이프라인 구성 확인"
  echo ""

  # 2-1. CI 워크플로우 파일 존재
  if [ -f "${PROJECT_ROOT}/.gitea/workflows/ci.yml" ]; then
    record_pass "CI 워크플로우 파일 존재 (.gitea/workflows/ci.yml)"
  else
    record_fail "CI 워크플로우" "ci.yml 파일이 없습니다."
  fi

  # 2-2. Deploy 워크플로우 파일 존재
  if [ -f "${PROJECT_ROOT}/.gitea/workflows/deploy.yml" ]; then
    record_pass "Deploy 워크플로우 파일 존재 (.gitea/workflows/deploy.yml)"
  else
    record_fail "Deploy 워크플로우" "deploy.yml 파일이 없습니다."
  fi

  # 2-3. self-hosted runner 설정 확인
  if grep -q "self-hosted" "${PROJECT_ROOT}/.gitea/workflows/ci.yml" 2>/dev/null; then
    record_pass "CI 워크플로우: self-hosted runner 설정됨"
  else
    record_warn "CI 워크플로우" "self-hosted runner 설정이 없습니다."
  fi

  # 2-4. Harbor push 활성화 확인
  if grep -q "Push to Harbor\|Push portal to Harbor\|docker push" "${PROJECT_ROOT}/.gitea/workflows/deploy.yml" 2>/dev/null; then
    record_pass "Deploy 워크플로우: Harbor push 활성화됨"
  else
    record_fail "Deploy 워크플로우" "Harbor push가 활성화되지 않았습니다."
  fi

  # 2-5. Dockerfile 존재 확인
  local dockerfile_count
  dockerfile_count=$(find "${PROJECT_ROOT}/platform/services" -name "Dockerfile" 2>/dev/null | wc -l)
  if [ "$dockerfile_count" -ge 16 ]; then
    record_pass "Dockerfile: ${dockerfile_count}개 존재 (서비스)"
  else
    record_warn "Dockerfile" "${dockerfile_count}개만 존재 (16개 이상 예상)"
  fi

  # 2-6. Helm Chart 존재
  if [ -f "${PROJECT_ROOT}/helm/saas-platform/Chart.yaml" ]; then
    record_pass "Helm Chart 존재 (helm/saas-platform/)"
  else
    record_fail "Helm Chart" "Chart.yaml이 없습니다."
  fi

  echo ""
}

# ============================================================
# Phase 3: 빌드 및 Push 검증 (--build 옵션 시)
# ============================================================
phase3_build_test() {
  log_step "Phase 3: Docker 이미지 빌드 + Harbor Push 검증"
  echo ""

  local test_image="localhost:8080/${HARBOR_PROJECT}/${TEST_SERVICE}"
  local test_tag="test-$(date +%Y%m%d%H%M%S)"

  # 3-1. 이미지 빌드
  log_info "  테스트 빌드: ${TEST_SERVICE}"
  if docker build -t "${test_image}:${test_tag}" \
    -f "${PROJECT_ROOT}/platform/services/${TEST_SERVICE}/Dockerfile" \
    "${PROJECT_ROOT}" &>/dev/null; then
    record_pass "Docker 이미지 빌드 성공 (${TEST_SERVICE})"
  else
    record_fail "Docker 이미지 빌드" "${TEST_SERVICE} 빌드 실패"
    return 1
  fi

  # 3-2. Harbor 로그인
  local harbor_pass="Harbor12345"
  if [ -f "${PROJECT_ROOT}/infra/harbor/.env" ]; then
    # shellcheck disable=SC1091
    source "${PROJECT_ROOT}/infra/harbor/.env"
    harbor_pass="${HARBOR_ADMIN_PASSWORD:-Harbor12345}"
  fi

  if echo "${harbor_pass}" | docker login "localhost:8080" -u admin --password-stdin &>/dev/null; then
    record_pass "Harbor 로그인 성공"
  else
    record_fail "Harbor 로그인" "인증 실패. 비밀번호와 insecure-registry 설정 확인 필요."
    return 1
  fi

  # 3-3. Harbor Push
  if docker push "${test_image}:${test_tag}" &>/dev/null; then
    record_pass "Harbor 이미지 Push 성공 (${test_image}:${test_tag})"
  else
    record_fail "Harbor 이미지 Push" "Push 실패. insecure-registry 설정 확인 필요."
    return 1
  fi

  # 3-4. Harbor API로 이미지 존재 확인
  local artifact_check
  artifact_check=$(curl -sf -u "admin:${harbor_pass}" \
    "${HARBOR_URL}/api/v2.0/projects/${HARBOR_PROJECT}/repositories/${TEST_SERVICE}/artifacts?page_size=1" 2>/dev/null || echo "")
  if [ -n "$artifact_check" ] && echo "$artifact_check" | grep -q "digest"; then
    record_pass "Harbor 이미지 존재 확인 (API 검증)"
  else
    record_warn "Harbor 이미지 확인" "API로 이미지를 확인할 수 없습니다."
  fi

  # 정리: 테스트 이미지 삭제
  docker rmi "${test_image}:${test_tag}" &>/dev/null || true

  echo ""
}

# ============================================================
# Phase 4: k3s 배포 검증
# ============================================================
phase4_k3s_deploy() {
  log_step "Phase 4: k3s 배포 검증"
  echo ""

  if ! command -v kubectl &>/dev/null || ! kubectl get nodes &>/dev/null 2>&1; then
    record_warn "k3s 배포 검증" "k3s가 실행 중이지 않아 건너뜁니다."
    return 0
  fi

  # 4-1. Helm template 검증
  if command -v helm &>/dev/null; then
    if helm template saas-test "${PROJECT_ROOT}/helm/saas-platform/" &>/dev/null; then
      record_pass "Helm template 렌더링 성공"
    else
      record_fail "Helm template" "helm template 실패"
    fi
  else
    record_warn "Helm" "helm이 설치되지 않았습니다."
  fi

  # 4-2. k3s registries.yaml 확인
  if [ -f "/etc/rancher/k3s/registries.yaml" ]; then
    if grep -q "localhost:8080" /etc/rancher/k3s/registries.yaml 2>/dev/null; then
      record_pass "k3s registries.yaml: Harbor 설정 포함"
    else
      record_warn "k3s registries.yaml" "Harbor 레지스트리 설정이 없습니다."
    fi
  else
    record_warn "k3s registries.yaml" "파일이 존재하지 않습니다."
  fi

  # 4-3. saas-platform 네임스페이스
  if kubectl get namespace saas-platform &>/dev/null 2>&1; then
    record_pass "saas-platform 네임스페이스 존재"
  else
    record_warn "saas-platform 네임스페이스" "아직 생성되지 않았습니다 (첫 배포 시 생성)"
  fi

  echo ""
}

# ============================================================
# 결과 보고
# ============================================================
print_results() {
  echo ""
  echo -e "${CYAN}==================================================${NC}"
  echo -e "${CYAN}  WSL2 CI/CD 파이프라인 검증 결과${NC}"
  echo -e "${CYAN}==================================================${NC}"
  echo ""

  for result in "${RESULTS[@]}"; do
    if echo "$result" | grep -q "^\[PASS\]"; then
      echo -e "  ${GREEN}${result}${NC}"
    elif echo "$result" | grep -q "^\[FAIL\]"; then
      echo -e "  ${RED}${result}${NC}"
    else
      echo -e "  ${YELLOW}${result}${NC}"
    fi
  done

  echo ""
  echo -e "${CYAN}==================================================${NC}"
  echo "  합계: ${TOTAL}개 항목"
  echo -e "  통과: ${GREEN}${PASSED}${NC}"
  echo -e "  경고: ${YELLOW}${WARNED}${NC}"
  echo -e "  실패: ${RED}${FAILED}${NC}"
  echo -e "${CYAN}==================================================${NC}"
  echo ""

  if [ $FAILED -gt 0 ]; then
    log_error "실패 항목이 있습니다. 위의 안내를 참조하여 해결하십시오."
    exit 1
  elif [ $WARNED -gt 0 ]; then
    log_warn "경고 항목이 있습니다. 필수가 아니지만 확인을 권장합니다."
    exit 0
  else
    log_info "모든 검증 항목을 통과했습니다."
    exit 0
  fi
}

# ============================================================
# Main
# ============================================================
MODE="full"
for arg in "$@"; do
  case "$arg" in
    --quick)
      MODE="quick"
      ;;
    --build)
      MODE="build"
      ;;
    --help|-h)
      echo "사용법: $0 [옵션]"
      echo ""
      echo "옵션:"
      echo "  --quick   인프라 상태 확인만"
      echo "  --build   이미지 빌드+push 검증 포함"
      echo "  --help    도움말"
      exit 0
      ;;
  esac
done

echo ""
echo -e "${CYAN}==================================================${NC}"
echo -e "${CYAN}  WSL2 CI/CD 파이프라인 E2E 검증${NC}"
echo -e "${CYAN}  Design Ref: MTU-N14${NC}"
echo -e "${CYAN}==================================================${NC}"
echo ""

phase1_infrastructure

if [ "$MODE" != "quick" ]; then
  phase2_cicd_config
fi

if [ "$MODE" = "build" ]; then
  phase3_build_test
fi

if [ "$MODE" != "quick" ]; then
  phase4_k3s_deploy
fi

print_results
