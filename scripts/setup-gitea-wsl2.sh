#!/bin/bash
# WSL2 Gitea + PostgreSQL 자동 설치 스크립트
# Design Ref: MTU-N10 | Plan SC: FR-N10.1, FR-N10.2
# CSAP: D-09 (시크릿 관리), D-10 (네트워크 격리)
#
# 사용법:
#   ./scripts/setup-gitea-wsl2.sh
#   ./scripts/setup-gitea-wsl2.sh --status
#   ./scripts/setup-gitea-wsl2.sh --stop
#   ./scripts/setup-gitea-wsl2.sh --destroy  (데이터 삭제 포함)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
GITEA_DIR="${PROJECT_ROOT}/infra/gitea"
GITEA_URL="http://localhost:3000"
MAX_WAIT=120

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
# 사전 요건 확인
# ============================================================
check_prerequisites() {
  log_step "1/6. 사전 요건 확인"

  local missing=0

  if ! command -v docker &>/dev/null; then
    log_error "docker가 설치되지 않았습니다"
    missing=1
  fi

  if ! docker compose version &>/dev/null && ! command -v docker-compose &>/dev/null; then
    log_error "docker compose가 설치되지 않았습니다"
    missing=1
  fi

  if ! docker info &>/dev/null; then
    log_error "Docker 데몬이 실행 중이지 않습니다"
    missing=1
  fi

  if [ $missing -eq 1 ]; then
    log_error "사전 요건이 충족되지 않았습니다. Docker Desktop 또는 Docker Engine을 설치하십시오."
    exit 1
  fi

  # 포트 충돌 확인
  for port in 3000 2222 5433; do
    if ss -tlnp 2>/dev/null | grep -q ":${port} " || netstat -tlnp 2>/dev/null | grep -q ":${port} "; then
      log_warn "포트 ${port}이 이미 사용 중입니다. 기존 Gitea 인스턴스가 있을 수 있습니다."
    fi
  done

  log_info "사전 요건 확인 완료"
}

# ============================================================
# .env 파일 설정
# ============================================================
setup_env_file() {
  log_step "2/6. 환경변수 설정"

  if [ ! -f "${GITEA_DIR}/.env" ]; then
    if [ -f "${GITEA_DIR}/.env.example" ]; then
      cp "${GITEA_DIR}/.env.example" "${GITEA_DIR}/.env"
      log_warn "============================================="
      log_warn " .env 파일이 생성되었습니다."
      log_warn " 반드시 비밀번호를 변경하십시오!"
      log_warn " 파일 위치: ${GITEA_DIR}/.env"
      log_warn "============================================="

      # 기본 비밀번호 자동 생성 (개발 환경 전용)
      local db_pass
      local admin_pass
      db_pass="gitea_$(openssl rand -hex 8 2>/dev/null || echo "dev_$(date +%s)")"
      admin_pass="admin_$(openssl rand -hex 8 2>/dev/null || echo "dev_$(date +%s)")"

      if command -v sed &>/dev/null; then
        sed -i "s/CHANGE_ME_gitea_db_password/${db_pass}/" "${GITEA_DIR}/.env"
        sed -i "s/CHANGE_ME_gitea_admin_password/${admin_pass}/" "${GITEA_DIR}/.env"
        log_info "임시 비밀번호가 자동 생성되었습니다 (운영 환경에서는 반드시 변경)"
        log_info "  DB 비밀번호: ${db_pass}"
        log_info "  Admin 비밀번호: ${admin_pass}"
      fi
    else
      log_error ".env.example 파일이 없습니다: ${GITEA_DIR}/.env.example"
      exit 1
    fi
  else
    log_info ".env 파일이 이미 존재합니다"
  fi

  # .env 파일에서 CHANGE_ME가 남아있는지 확인
  if grep -q "CHANGE_ME" "${GITEA_DIR}/.env" 2>/dev/null; then
    log_warn "============================================="
    log_warn " .env 파일에 변경되지 않은 기본값이 있습니다!"
    log_warn " ${GITEA_DIR}/.env 파일을 편집하십시오."
    log_warn "============================================="
  fi
}

# ============================================================
# Docker Compose 시작
# ============================================================
start_gitea() {
  log_step "3/6. Gitea + PostgreSQL 시작"

  cd "${GITEA_DIR}"

  # docker compose 명령 감지
  local compose_cmd
  if docker compose version &>/dev/null; then
    compose_cmd="docker compose"
  else
    compose_cmd="docker-compose"
  fi

  # Gitea와 PostgreSQL만 먼저 시작 (runner는 나중에)
  ${compose_cmd} up -d postgres gitea

  log_info "Gitea + PostgreSQL 컨테이너 시작됨"
}

# ============================================================
# Gitea 준비 대기
# ============================================================
wait_for_gitea() {
  log_step "4/6. Gitea 준비 대기 (최대 ${MAX_WAIT}초)"

  local elapsed=0
  while [ $elapsed -lt $MAX_WAIT ]; do
    if curl -sf "${GITEA_URL}/api/v1/version" &>/dev/null; then
      log_info "Gitea가 준비되었습니다 (${elapsed}초 경과)"
      return 0
    fi
    sleep 3
    elapsed=$((elapsed + 3))
    echo -n "."
  done
  echo ""

  log_error "Gitea가 ${MAX_WAIT}초 내에 시작되지 않았습니다"
  log_error "로그 확인: docker logs gitea"
  exit 1
}

# ============================================================
# Gitea 초기 설정
# ============================================================
configure_gitea() {
  log_step "5/6. Gitea 초기 설정"

  # .env에서 admin 정보 읽기
  # shellcheck disable=SC1091
  source "${GITEA_DIR}/.env"

  local admin_user="${GITEA_ADMIN_USER:-saas-admin}"
  # H-05 수정: 기본값 'admin' 제거 — 배포 전 GITEA_ADMIN_PASSWORD 환경변수 필수
  # .env에 설정되어 있지 않으면 환경변수에서 읽음. 예: export GITEA_ADMIN_PASSWORD=$(openssl rand -hex 12)
  local admin_pass="${GITEA_ADMIN_PASSWORD:?오류: GITEA_ADMIN_PASSWORD 환경변수를 설정하세요}"
  local admin_email="${GITEA_ADMIN_EMAIL:-admin@public-saas.local}"

  # admin 계정 생성 (이미 존재하면 스킵)
  if ! curl -sf -u "${admin_user}:${admin_pass}" "${GITEA_URL}/api/v1/user" &>/dev/null; then
    log_info "Admin 계정 생성: ${admin_user}"
    docker exec gitea gitea admin user create \
      --username "${admin_user}" \
      --password "${admin_pass}" \
      --email "${admin_email}" \
      --admin \
      --must-change-password=false 2>/dev/null || log_warn "Admin 계정이 이미 존재하거나 생성 실패"
  else
    log_info "Admin 계정이 이미 존재합니다: ${admin_user}"
  fi

  # Organization 생성: public-saas
  local org_check
  org_check=$(curl -sf -u "${admin_user}:${admin_pass}" "${GITEA_URL}/api/v1/orgs/public-saas" 2>/dev/null || echo "")
  if [ -z "$org_check" ] || echo "$org_check" | grep -q '"message"'; then
    log_info "Organization 생성: public-saas"
    curl -sf -X POST -u "${admin_user}:${admin_pass}" \
      -H "Content-Type: application/json" \
      -d '{"username":"public-saas","visibility":"public","description":"공공기관 SaaS 프레임워크"}' \
      "${GITEA_URL}/api/v1/orgs" &>/dev/null || log_warn "Organization 생성 실패 (이미 존재할 수 있음)"
  else
    log_info "Organization이 이미 존재합니다: public-saas"
  fi

  # Repository 생성: saas-platform
  local repo_check
  repo_check=$(curl -sf -u "${admin_user}:${admin_pass}" "${GITEA_URL}/api/v1/repos/public-saas/saas-platform" 2>/dev/null || echo "")
  if [ -z "$repo_check" ] || echo "$repo_check" | grep -q '"message"'; then
    log_info "Repository 생성: public-saas/saas-platform"
    curl -sf -X POST -u "${admin_user}:${admin_pass}" \
      -H "Content-Type: application/json" \
      -d '{"name":"saas-platform","description":"공공기관 SaaS 프레임워크","private":false,"auto_init":false}' \
      "${GITEA_URL}/api/v1/orgs/public-saas/repos" &>/dev/null || log_warn "Repository 생성 실패 (이미 존재할 수 있음)"
  else
    log_info "Repository가 이미 존재합니다: public-saas/saas-platform"
  fi

  # Actions 워크플로우를 위한 secrets 안내
  log_info "Gitea 초기 설정 완료"
  log_info ""
  log_info "다음 단계: Gitea에서 Actions Runner를 등록하십시오"
  log_info "  1. ${GITEA_URL}/-/admin/actions/runners 접속"
  log_info "  2. 'Create New Runner' 클릭"
  log_info "  3. 등록 토큰을 .env의 RUNNER_REGISTRATION_TOKEN에 입력"
}

# ============================================================
# 상태 확인
# ============================================================
show_status() {
  echo ""
  echo "==========================================="
  echo "  Gitea 인프라 상태"
  echo "==========================================="
  echo ""

  # Gitea 상태
  if curl -sf "${GITEA_URL}/api/v1/version" &>/dev/null; then
    local version
    version=$(curl -sf "${GITEA_URL}/api/v1/version" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
    log_info "Gitea: 실행 중 (v${version}) -- ${GITEA_URL}"
  else
    log_error "Gitea: 응답 없음"
  fi

  # PostgreSQL 상태
  if docker exec gitea-postgres pg_isready -U gitea &>/dev/null; then
    log_info "PostgreSQL: 실행 중 (localhost:5433)"
  else
    log_error "PostgreSQL: 응답 없음"
  fi

  # Runner 상태
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "gitea-runner"; then
    log_info "Act Runner: 실행 중"
  else
    log_warn "Act Runner: 실행 중이 아님"
  fi

  echo ""
}

# ============================================================
# 완료 보고
# ============================================================
print_summary() {
  log_step "6/6. 설치 완료"
  echo ""
  echo "==========================================="
  echo "  Gitea 설치 완료"
  echo "==========================================="
  echo ""
  echo "  Web UI:  ${GITEA_URL}"
  echo "  SSH:     localhost:${GITEA_SSH_PORT:-2222}"
  echo "  DB:      localhost:5433"
  echo ""
  echo "  Git Remote 설정:"
  echo "    git remote add gitea http://localhost:3000/public-saas/saas-platform.git"
  echo ""
  echo "  다음 단계:"
  echo "    1. Act Runner 등록: ./scripts/setup-act-runner.sh"
  echo "    2. Harbor 설치: ./scripts/setup-harbor-wsl2.sh"
  echo ""
  echo "==========================================="
}

# ============================================================
# 중지
# ============================================================
stop_gitea() {
  log_info "Gitea 중지 중..."
  cd "${GITEA_DIR}"
  local compose_cmd
  if docker compose version &>/dev/null; then
    compose_cmd="docker compose"
  else
    compose_cmd="docker-compose"
  fi
  ${compose_cmd} down
  log_info "Gitea 중지 완료"
}

# ============================================================
# 삭제 (데이터 포함)
# ============================================================
destroy_gitea() {
  log_warn "Gitea 완전 삭제 (데이터 포함)"
  read -r -p "정말 삭제하시겠습니까? (y/N): " confirm
  if [ "${confirm}" = "y" ] || [ "${confirm}" = "Y" ]; then
    cd "${GITEA_DIR}"
    local compose_cmd
    if docker compose version &>/dev/null; then
      compose_cmd="docker compose"
    else
      compose_cmd="docker-compose"
    fi
    ${compose_cmd} down -v
    log_info "Gitea 완전 삭제 완료 (볼륨 포함)"
  else
    log_info "삭제 취소"
  fi
}

# ============================================================
# Main
# ============================================================
case "${1:-}" in
  --status)
    show_status
    ;;
  --stop)
    stop_gitea
    ;;
  --destroy)
    destroy_gitea
    ;;
  *)
    echo ""
    echo "==========================================="
    echo "  WSL2 Gitea 설치 스크립트"
    echo "  Design Ref: MTU-N10"
    echo "==========================================="
    echo ""
    check_prerequisites
    setup_env_file
    start_gitea
    wait_for_gitea
    configure_gitea
    print_summary
    ;;
esac
