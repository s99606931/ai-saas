#!/bin/bash
# WSL2 Harbor 로컬 레지스트리 자동 설치 스크립트
# Design Ref: MTU-N11 | Plan SC: FR-N11.1~FR-N11.6
# CSAP: D-09 (시크릿 관리), D-11-04 (이미지 스캔)
#
# 사용법:
#   ./scripts/setup-harbor-wsl2.sh
#   ./scripts/setup-harbor-wsl2.sh --status
#   ./scripts/setup-harbor-wsl2.sh --stop
#   ./scripts/setup-harbor-wsl2.sh --destroy
#
# 사전 조건:
#   - Docker + Docker Compose 설치
#   - 최소 2GB 여유 메모리

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
HARBOR_DIR="${PROJECT_ROOT}/infra/harbor"
MAX_WAIT=180

# 기본값 (환경변수 또는 .env로 오버라이드)
HARBOR_VERSION="${HARBOR_VERSION:-v2.11.2}"
HARBOR_HTTP_PORT="${HARBOR_HTTP_PORT:-8080}"
HARBOR_ADMIN_PASSWORD="${HARBOR_ADMIN_PASSWORD:-Harbor12345}"
HARBOR_DATA_VOLUME="${HARBOR_DATA_VOLUME:-/data/harbor}"
HARBOR_INSTALL_DIR="${HARBOR_INSTALL_DIR:-/opt/harbor}"
HARBOR_PROJECT_NAME="${HARBOR_PROJECT_NAME:-public-saas}"
HARBOR_URL="http://localhost:${HARBOR_HTTP_PORT}"

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
# .env 로드
# ============================================================
load_env() {
  if [ -f "${HARBOR_DIR}/.env" ]; then
    # shellcheck disable=SC1091
    source "${HARBOR_DIR}/.env"
    HARBOR_URL="http://localhost:${HARBOR_HTTP_PORT}"
  elif [ -f "${HARBOR_DIR}/env.example" ]; then
    log_warn ".env 파일이 없습니다. env.example에서 복사합니다."
    cp "${HARBOR_DIR}/env.example" "${HARBOR_DIR}/.env"

    # 비밀번호 자동 생성
    local admin_pass
    admin_pass="Harbor_$(openssl rand -hex 8 2>/dev/null || echo "dev_$(date +%s)")"
    if command -v sed &>/dev/null; then
      sed -i "s/CHANGE_ME_harbor_admin_password/${admin_pass}/" "${HARBOR_DIR}/.env"
      log_info "Harbor admin 비밀번호 자동 생성: ${admin_pass}"
    fi
    # shellcheck disable=SC1091
    source "${HARBOR_DIR}/.env"
    HARBOR_URL="http://localhost:${HARBOR_HTTP_PORT}"
  fi
}

# ============================================================
# 사전 요건 확인
# ============================================================
check_prerequisites() {
  log_step "1/7. 사전 요건 확인"

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

  if ! command -v curl &>/dev/null; then
    log_error "curl이 설치되지 않았습니다"
    missing=1
  fi

  if [ $missing -eq 1 ]; then
    log_error "사전 요건이 충족되지 않았습니다"
    exit 1
  fi

  # 포트 충돌 확인
  if ss -tlnp 2>/dev/null | grep -q ":${HARBOR_HTTP_PORT} " || netstat -tlnp 2>/dev/null | grep -q ":${HARBOR_HTTP_PORT} "; then
    log_warn "포트 ${HARBOR_HTTP_PORT}이 이미 사용 중입니다"
  fi

  # 메모리 확인
  local total_mem_mb
  total_mem_mb=$(free -m 2>/dev/null | awk '/Mem:/{print $2}' || echo "0")
  if [ "$total_mem_mb" -lt 4096 ] 2>/dev/null; then
    log_warn "메모리가 4GB 미만입니다 (${total_mem_mb}MB). Harbor는 최소 2GB 여유 메모리를 권장합니다."
  fi

  log_info "사전 요건 확인 완료"
}

# ============================================================
# Harbor 다운로드
# ============================================================
download_harbor() {
  log_step "2/7. Harbor ${HARBOR_VERSION} 다운로드"

  if [ -d "${HARBOR_INSTALL_DIR}" ] && [ -f "${HARBOR_INSTALL_DIR}/harbor.yml" ]; then
    log_info "Harbor가 이미 설치되어 있습니다: ${HARBOR_INSTALL_DIR}"
    return 0
  fi

  local installer_file="harbor-offline-installer-${HARBOR_VERSION}.tgz"
  local download_url="https://github.com/goharbor/harbor/releases/download/${HARBOR_VERSION}/${installer_file}"
  local tmp_dir="/tmp/harbor-install"

  mkdir -p "${tmp_dir}"

  if [ ! -f "${tmp_dir}/${installer_file}" ]; then
    log_info "다운로드 중: ${download_url}"
    curl -fSL -o "${tmp_dir}/${installer_file}" "${download_url}" || {
      log_error "Harbor 다운로드 실패. URL을 확인하십시오: ${download_url}"
      log_info "대안: https://github.com/goharbor/harbor/releases 에서 수동 다운로드"
      exit 1
    }
  else
    log_info "이미 다운로드됨: ${tmp_dir}/${installer_file}"
  fi

  log_info "압축 해제 중..."
  tar xzf "${tmp_dir}/${installer_file}" -C "${tmp_dir}/"

  sudo mkdir -p "$(dirname "${HARBOR_INSTALL_DIR}")"
  sudo mv "${tmp_dir}/harbor" "${HARBOR_INSTALL_DIR}"

  log_info "Harbor 설치 파일 준비 완료: ${HARBOR_INSTALL_DIR}"
}

# ============================================================
# Harbor 설정
# ============================================================
configure_harbor() {
  log_step "3/7. Harbor 설정"

  local config_file="${HARBOR_INSTALL_DIR}/harbor.yml"
  local template_file="${HARBOR_INSTALL_DIR}/harbor.yml.tmpl"

  if [ ! -f "${template_file}" ]; then
    log_error "harbor.yml.tmpl 파일이 없습니다: ${template_file}"
    exit 1
  fi

  # 템플릿에서 설정 파일 생성
  sudo cp "${template_file}" "${config_file}"

  # hostname 설정
  sudo sed -i "s/^hostname:.*/hostname: localhost/" "${config_file}"

  # HTTP 포트 설정
  sudo sed -i "s/^  port: 80$/  port: ${HARBOR_HTTP_PORT}/" "${config_file}"

  # HTTPS 비활성화 (개발 환경 전용)
  # https 관련 설정을 주석 처리
  sudo sed -i '/^https:/,/^[a-z]/{
    /^https:/s/^/#/
    /^  port: 443/s/^/#/
    /^  certificate:/s/^/#/
    /^  private_key:/s/^/#/
  }' "${config_file}"

  # admin 비밀번호 설정
  sudo sed -i "s/^harbor_admin_password:.*/harbor_admin_password: ${HARBOR_ADMIN_PASSWORD}/" "${config_file}"

  # 데이터 볼륨 설정
  sudo sed -i "s|^data_volume:.*|data_volume: ${HARBOR_DATA_VOLUME}|" "${config_file}"

  log_info "Harbor 설정 완료: ${config_file}"
  log_warn "HTTPS가 비활성화되어 있습니다 (개발 환경 전용)"
}

# ============================================================
# Harbor 설치 실행
# ============================================================
install_harbor() {
  log_step "4/7. Harbor 설치"

  cd "${HARBOR_INSTALL_DIR}"

  # 데이터 디렉토리 생성
  sudo mkdir -p "${HARBOR_DATA_VOLUME}"

  # install.sh 실행
  sudo ./install.sh --with-trivy 2>&1 | tail -5

  log_info "Harbor 설치 완료"
}

# ============================================================
# Harbor 준비 대기
# ============================================================
wait_for_harbor() {
  log_step "5/7. Harbor 준비 대기 (최대 ${MAX_WAIT}초)"

  local elapsed=0
  while [ $elapsed -lt $MAX_WAIT ]; do
    if curl -sf "${HARBOR_URL}/api/v2.0/systeminfo" &>/dev/null; then
      log_info "Harbor가 준비되었습니다 (${elapsed}초 경과)"
      return 0
    fi
    sleep 5
    elapsed=$((elapsed + 5))
    echo -n "."
  done
  echo ""

  log_error "Harbor가 ${MAX_WAIT}초 내에 시작되지 않았습니다"
  log_error "로그 확인: cd ${HARBOR_INSTALL_DIR} && docker compose logs"
  exit 1
}

# ============================================================
# 프로젝트 생성
# ============================================================
create_project() {
  log_step "6/7. Harbor 프로젝트 생성: ${HARBOR_PROJECT_NAME}"

  # 프로젝트 존재 확인
  local project_check
  project_check=$(curl -sf -u "admin:${HARBOR_ADMIN_PASSWORD}" \
    "${HARBOR_URL}/api/v2.0/projects?name=${HARBOR_PROJECT_NAME}" 2>/dev/null || echo "[]")

  if echo "$project_check" | grep -q "\"name\":\"${HARBOR_PROJECT_NAME}\""; then
    log_info "프로젝트가 이미 존재합니다: ${HARBOR_PROJECT_NAME}"
    return 0
  fi

  # 프로젝트 생성
  curl -sf -X POST -u "admin:${HARBOR_ADMIN_PASSWORD}" \
    -H "Content-Type: application/json" \
    -d "{\"project_name\":\"${HARBOR_PROJECT_NAME}\",\"public\":true,\"metadata\":{\"public\":\"true\"}}" \
    "${HARBOR_URL}/api/v2.0/projects" &>/dev/null || {
      log_warn "프로젝트 생성에 실패했습니다 (이미 존재할 수 있음)"
      return 0
    }

  log_info "프로젝트 생성 완료: ${HARBOR_PROJECT_NAME}"
}

# ============================================================
# k3s 레지스트리 설정
# ============================================================
configure_k3s_registry() {
  log_step "7/7. k3s 레지스트리 설정"

  local k3s_registries="/etc/rancher/k3s/registries.yaml"
  local template="${HARBOR_DIR}/registries.yaml"

  if [ ! -f "${template}" ]; then
    log_warn "registries.yaml 템플릿이 없습니다: ${template}"
    return 0
  fi

  if command -v kubectl &>/dev/null && kubectl get nodes &>/dev/null; then
    if [ -f "${k3s_registries}" ]; then
      log_warn "k3s registries.yaml가 이미 존재합니다. 백업 후 덮어씁니다."
      sudo cp "${k3s_registries}" "${k3s_registries}.bak.$(date +%Y%m%d%H%M%S)"
    fi

    # 템플릿 복사 및 비밀번호 치환
    sudo mkdir -p "$(dirname "${k3s_registries}")"
    sudo cp "${template}" "${k3s_registries}"
    sudo sed -i "s/CHANGE_ME_harbor_admin_password/${HARBOR_ADMIN_PASSWORD}/" "${k3s_registries}"

    log_info "k3s registries.yaml 설정 완료"
    log_warn "k3s 재시작이 필요합니다: sudo systemctl restart k3s"
  else
    log_warn "k3s가 설치되지 않았습니다. registries.yaml 설정을 건너뜁니다."
    log_info "k3s 설치 후 수동 설정:"
    log_info "  sudo cp ${template} ${k3s_registries}"
    log_info "  sudo systemctl restart k3s"
  fi

  # Docker insecure-registry 안내
  echo ""
  log_info "Docker insecure-registry 설정이 필요합니다:"
  log_info "  /etc/docker/daemon.json 에 다음 추가:"
  log_info '  {"insecure-registries": ["localhost:'"${HARBOR_HTTP_PORT}"'"]}'
  log_info "  설정 후: sudo systemctl restart docker"
}

# ============================================================
# 상태 확인
# ============================================================
show_status() {
  echo ""
  echo "==========================================="
  echo "  Harbor 레지스트리 상태"
  echo "==========================================="
  echo ""

  if curl -sf "${HARBOR_URL}/api/v2.0/systeminfo" &>/dev/null; then
    local version
    version=$(curl -sf "${HARBOR_URL}/api/v2.0/systeminfo" | grep -o '"harbor_version":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
    log_info "Harbor: 실행 중 (${version}) -- ${HARBOR_URL}"

    # 프로젝트 목록
    local projects
    projects=$(curl -sf -u "admin:${HARBOR_ADMIN_PASSWORD}" \
      "${HARBOR_URL}/api/v2.0/projects" 2>/dev/null || echo "[]")
    echo "  프로젝트:"
    echo "$projects" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | while read -r p; do
      echo "    - ${p}"
    done
  else
    log_error "Harbor: 응답 없음 (${HARBOR_URL})"
  fi
  echo ""
}

# ============================================================
# 중지
# ============================================================
stop_harbor() {
  log_info "Harbor 중지 중..."
  if [ -d "${HARBOR_INSTALL_DIR}" ]; then
    cd "${HARBOR_INSTALL_DIR}"
    local compose_cmd
    if docker compose version &>/dev/null; then
      compose_cmd="docker compose"
    else
      compose_cmd="docker-compose"
    fi
    sudo ${compose_cmd} down
    log_info "Harbor 중지 완료"
  else
    log_warn "Harbor 설치 디렉토리를 찾을 수 없습니다: ${HARBOR_INSTALL_DIR}"
  fi
}

# ============================================================
# 완전 삭제
# ============================================================
destroy_harbor() {
  log_warn "Harbor 완전 삭제 (데이터 포함)"
  read -r -p "정말 삭제하시겠습니까? (y/N): " confirm
  if [ "${confirm}" = "y" ] || [ "${confirm}" = "Y" ]; then
    stop_harbor
    sudo rm -rf "${HARBOR_DATA_VOLUME}"
    sudo rm -rf "${HARBOR_INSTALL_DIR}"
    log_info "Harbor 완전 삭제 완료"
  else
    log_info "삭제 취소"
  fi
}

# ============================================================
# 완료 보고
# ============================================================
print_summary() {
  echo ""
  echo "==========================================="
  echo "  Harbor 설치 완료"
  echo "==========================================="
  echo ""
  echo "  Web UI:    ${HARBOR_URL}"
  echo "  사용자:    admin"
  echo "  비밀번호:  ${HARBOR_ADMIN_PASSWORD}"
  echo "  프로젝트:  ${HARBOR_PROJECT_NAME}"
  echo ""
  echo "  Docker 이미지 push 방법:"
  echo "    docker login localhost:${HARBOR_HTTP_PORT}"
  echo "    docker tag <image> localhost:${HARBOR_HTTP_PORT}/${HARBOR_PROJECT_NAME}/<name>:<tag>"
  echo "    docker push localhost:${HARBOR_HTTP_PORT}/${HARBOR_PROJECT_NAME}/<name>:<tag>"
  echo ""
  echo "  다음 단계:"
  echo "    1. Docker insecure-registry 설정"
  echo "    2. k3s 재시작: sudo systemctl restart k3s"
  echo ""
  echo "==========================================="
}

# ============================================================
# Main
# ============================================================
load_env

case "${1:-}" in
  --status)
    show_status
    ;;
  --stop)
    stop_harbor
    ;;
  --destroy)
    destroy_harbor
    ;;
  *)
    echo ""
    echo "==========================================="
    echo "  WSL2 Harbor 레지스트리 설치 스크립트"
    echo "  Design Ref: MTU-N11"
    echo "==========================================="
    echo ""
    check_prerequisites
    download_harbor
    configure_harbor
    install_harbor
    wait_for_harbor
    create_project
    configure_k3s_registry
    print_summary
    ;;
esac
