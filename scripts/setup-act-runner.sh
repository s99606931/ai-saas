#!/bin/bash
# Gitea Act Runner 설치 및 등록 스크립트
# Design Ref: MTU-N10 | Plan SC: FR-N10.3, FR-N10.4
# CSAP: D-12 (시스템 개발 보안 -- CI/CD 자동화)
#
# 사용법:
#   ./scripts/setup-act-runner.sh
#   ./scripts/setup-act-runner.sh --status
#   ./scripts/setup-act-runner.sh --stop
#
# 사전 조건:
#   - Gitea가 실행 중이어야 합니다 (./scripts/setup-gitea-wsl2.sh 선행)
#   - .env에 RUNNER_REGISTRATION_TOKEN이 설정되어야 합니다

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
GITEA_DIR="${PROJECT_ROOT}/infra/gitea"
GITEA_URL="http://localhost:3000"
MAX_WAIT=60

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${BLUE}[STEP]${NC}  $1"; }

# ============================================================
# Gitea 접속 확인
# ============================================================
check_gitea() {
  log_step "1/4. Gitea 접속 확인"

  if ! curl -sf "${GITEA_URL}/api/v1/version" &>/dev/null; then
    log_error "Gitea에 접속할 수 없습니다: ${GITEA_URL}"
    log_error "Gitea를 먼저 설치하십시오: ./scripts/setup-gitea-wsl2.sh"
    exit 1
  fi

  local version
  version=$(curl -sf "${GITEA_URL}/api/v1/version" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
  log_info "Gitea 접속 확인: v${version}"
}

# ============================================================
# 환경변수 확인
# ============================================================
check_env() {
  log_step "2/4. 환경변수 확인"

  if [ ! -f "${GITEA_DIR}/.env" ]; then
    log_error ".env 파일이 없습니다: ${GITEA_DIR}/.env"
    log_error "Gitea를 먼저 설치하십시오: ./scripts/setup-gitea-wsl2.sh"
    exit 1
  fi

  # shellcheck disable=SC1091
  source "${GITEA_DIR}/.env"

  if [ -z "${RUNNER_REGISTRATION_TOKEN:-}" ] || [ "${RUNNER_REGISTRATION_TOKEN}" = "CHANGE_ME_runner_token" ]; then
    log_warn "============================================="
    log_warn " Runner 등록 토큰이 설정되지 않았습니다."
    log_warn ""
    log_warn " 토큰 발급 방법:"
    log_warn "   1. ${GITEA_URL}/-/admin/actions/runners 접속"
    log_warn "   2. 'Create New Runner' 클릭"
    log_warn "   3. 표시된 토큰을 복사"
    log_warn "   4. ${GITEA_DIR}/.env 파일에 입력:"
    log_warn "      RUNNER_REGISTRATION_TOKEN=<토큰>"
    log_warn "============================================="

    # 대화형 모드: 토큰 직접 입력
    echo ""
    read -r -p "등록 토큰을 입력하십시오 (건너뛰려면 Enter): " input_token
    if [ -n "$input_token" ]; then
      RUNNER_REGISTRATION_TOKEN="$input_token"
      # .env 파일에도 저장
      if command -v sed &>/dev/null; then
        sed -i "s/CHANGE_ME_runner_token/${input_token}/" "${GITEA_DIR}/.env"
        log_info "토큰이 .env 파일에 저장되었습니다"
      fi
    else
      log_error "등록 토큰 없이는 Runner를 시작할 수 없습니다"
      exit 1
    fi
  fi

  log_info "환경변수 확인 완료"
}

# ============================================================
# Runner 시작
# ============================================================
start_runner() {
  log_step "3/4. Act Runner 시작"

  cd "${GITEA_DIR}"

  local compose_cmd
  if docker compose version &>/dev/null; then
    compose_cmd="docker compose"
  else
    compose_cmd="docker-compose"
  fi

  ${compose_cmd} up -d runner

  log_info "Act Runner 컨테이너 시작됨"

  # Runner 등록 대기
  log_info "Runner 등록 대기 (최대 ${MAX_WAIT}초)..."
  local elapsed=0
  while [ $elapsed -lt $MAX_WAIT ]; do
    if docker logs gitea-runner 2>&1 | grep -q "runner registered successfully\|Runner registered successfully\|level=info msg=\"[^\"]*registered"; then
      log_info "Runner 등록 완료 (${elapsed}초 경과)"
      return 0
    fi
    sleep 3
    elapsed=$((elapsed + 3))
    echo -n "."
  done
  echo ""

  # 타임아웃이어도 Runner가 실행 중이면 성공으로 간주
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "gitea-runner"; then
    log_warn "Runner 등록 확인이 타임아웃되었으나 컨테이너는 실행 중입니다"
    log_warn "수동 확인: docker logs gitea-runner"
  else
    log_error "Runner 시작 실패. 로그 확인: docker logs gitea-runner"
    exit 1
  fi
}

# ============================================================
# 상태 확인 및 완료
# ============================================================
print_summary() {
  log_step "4/4. 설치 완료"

  echo ""
  echo "==========================================="
  echo "  Act Runner 설치 완료"
  echo "==========================================="
  echo ""
  echo "  Runner 이름: ${RUNNER_NAME:-wsl2-runner}"
  echo "  라벨: ${RUNNER_LABELS:-self-hosted,ubuntu-latest:host}"
  echo ""
  echo "  확인 방법:"
  echo "    - Gitea UI: ${GITEA_URL}/-/admin/actions/runners"
  echo "    - 로그: docker logs gitea-runner"
  echo ""
  echo "  워크플로우에서 사용:"
  echo "    runs-on: self-hosted"
  echo ""
  echo "==========================================="
}

show_status() {
  echo ""
  echo "==========================================="
  echo "  Act Runner 상태"
  echo "==========================================="
  echo ""

  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "gitea-runner"; then
    log_info "Act Runner: 실행 중"
    echo ""
    echo "  최근 로그:"
    docker logs --tail 10 gitea-runner 2>&1 | sed 's/^/    /'
  else
    log_error "Act Runner: 실행 중이 아님"
  fi
  echo ""
}

stop_runner() {
  log_info "Act Runner 중지 중..."
  cd "${GITEA_DIR}"
  local compose_cmd
  if docker compose version &>/dev/null; then
    compose_cmd="docker compose"
  else
    compose_cmd="docker-compose"
  fi
  ${compose_cmd} stop runner
  log_info "Act Runner 중지 완료"
}

# ============================================================
# Main
# ============================================================
case "${1:-}" in
  --status)
    show_status
    ;;
  --stop)
    stop_runner
    ;;
  *)
    echo ""
    echo "==========================================="
    echo "  Gitea Act Runner 설치 스크립트"
    echo "  Design Ref: MTU-N10"
    echo "==========================================="
    echo ""
    check_gitea
    check_env
    start_runner
    print_summary
    ;;
esac
