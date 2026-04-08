#!/bin/bash
# WSL2 원클릭 설치 스크립트 -- k3s + Gitea + Harbor + Act Runner
# Design Ref: MTU-N13 | Plan SC: FR-N13.1~FR-N13.8
# CSAP: D-09 (시크릿 관리), D-10 (네트워크 격리), D-11 (가상화 보안)
#
# 사용법:
#   ./scripts/setup-wsl2-all.sh                # 전체 설치
#   ./scripts/setup-wsl2-all.sh --status       # 전체 상태 확인
#   ./scripts/setup-wsl2-all.sh --stop         # 전체 중지
#   ./scripts/setup-wsl2-all.sh --skip-harbor  # Harbor 없이 설치
#
# 실행 순서:
#   1. 사전 요건 확인
#   2. k3s 설치 (이미 있으면 스킵)
#   3. Gitea + PostgreSQL 시작
#   4. Harbor 시작
#   5. Gitea Act Runner 등록
#   6. k3s 레지스트리 미러 설정
#   7. 검증 테스트 실행

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SKIP_HARBOR=false
START_TIME=$(date +%s)

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${BLUE}[STEP]${NC}  $1"; }
log_header() { echo -e "${CYAN}$1${NC}"; }

# ============================================================
# 1. 사전 요건 확인
# ============================================================
check_prerequisites() {
  log_step "1/7. 사전 요건 확인"
  echo ""

  local missing=0
  local warnings=0

  # 필수 도구 확인
  for tool in docker curl; do
    if command -v "$tool" &>/dev/null; then
      log_info "  [OK] ${tool} -- $(${tool} --version 2>/dev/null | head -1)"
    else
      log_error "  [MISSING] ${tool}"
      missing=$((missing + 1))
    fi
  done

  # Docker Compose 확인
  if docker compose version &>/dev/null; then
    log_info "  [OK] docker compose -- $(docker compose version --short 2>/dev/null)"
  elif command -v docker-compose &>/dev/null; then
    log_info "  [OK] docker-compose -- $(docker-compose --version 2>/dev/null | head -1)"
  else
    log_error "  [MISSING] docker compose"
    missing=$((missing + 1))
  fi

  # 선택적 도구 확인
  for tool in helm kubectl; do
    if command -v "$tool" &>/dev/null; then
      log_info "  [OK] ${tool} -- $(${tool} version --short 2>/dev/null || ${tool} version --client=true --short 2>/dev/null || echo 'installed')"
    else
      log_warn "  [OPTIONAL] ${tool} -- 미설치 (k3s 배포 시 필요)"
      warnings=$((warnings + 1))
    fi
  done

  # Docker 데몬 확인
  if docker info &>/dev/null; then
    log_info "  [OK] Docker 데몬 실행 중"
  else
    log_error "  [FAIL] Docker 데몬이 실행 중이지 않습니다"
    missing=$((missing + 1))
  fi

  # WSL2 환경 확인
  if [ -f /proc/version ] && grep -qi "microsoft\|wsl" /proc/version 2>/dev/null; then
    log_info "  [OK] WSL2 환경 감지됨"
  else
    log_warn "  [WARN] WSL2 환경이 아닐 수 있습니다"
    warnings=$((warnings + 1))
  fi

  # 메모리 확인
  local total_mem_mb
  total_mem_mb=$(free -m 2>/dev/null | awk '/Mem:/{print $2}' || echo "0")
  if [ "$total_mem_mb" -gt 0 ]; then
    if [ "$total_mem_mb" -lt 4096 ]; then
      log_warn "  [WARN] 메모리: ${total_mem_mb}MB (최소 8GB 권장)"
      warnings=$((warnings + 1))
    else
      log_info "  [OK] 메모리: ${total_mem_mb}MB"
    fi
  fi

  # 포트 충돌 확인
  echo ""
  log_info "  포트 사용 확인:"
  for port_info in "3000:Gitea" "2222:Gitea SSH" "5433:PostgreSQL" "8080:Harbor"; do
    local port="${port_info%%:*}"
    local name="${port_info#*:}"
    if ss -tlnp 2>/dev/null | grep -q ":${port} " || netstat -tlnp 2>/dev/null | grep -q ":${port} "; then
      log_warn "    포트 ${port} (${name}): 사용 중"
      warnings=$((warnings + 1))
    else
      log_info "    포트 ${port} (${name}): 사용 가능"
    fi
  done

  if [ $missing -gt 0 ]; then
    echo ""
    log_error "필수 도구가 ${missing}개 누락되었습니다. 설치 후 다시 실행하십시오."
    exit 1
  fi

  echo ""
  if [ $warnings -gt 0 ]; then
    log_warn "${warnings}개 경고가 있습니다. 계속 진행합니다."
  else
    log_info "모든 사전 요건이 충족되었습니다."
  fi
}

# ============================================================
# 2. k3s 설치
# ============================================================
setup_k3s() {
  log_step "2/7. k3s 클러스터 설정"

  if command -v kubectl &>/dev/null && kubectl get nodes &>/dev/null 2>&1; then
    local node_status
    node_status=$(kubectl get nodes --no-headers 2>/dev/null | awk '{print $2}' | head -1)
    if [ "$node_status" = "Ready" ]; then
      log_info "k3s가 이미 실행 중입니다 (노드 상태: Ready)"
      return 0
    fi
  fi

  log_info "k3s 설치를 시작합니다..."

  # k3s 설치
  curl -sfL https://get.k3s.io | sh -s - \
    --write-kubeconfig-mode 644 \
    --disable traefik \
    --protect-kernel-defaults || {
      log_warn "k3s 설치 실패. WSL2에서는 systemd가 필요할 수 있습니다."
      log_warn "다음 명령으로 systemd를 활성화하십시오:"
      log_warn "  echo '[boot]' | sudo tee /etc/wsl.conf"
      log_warn "  echo 'systemd=true' | sudo tee -a /etc/wsl.conf"
      log_warn "  # Windows에서: wsl --shutdown && wsl"
      return 1
    }

  # kubeconfig 설정
  if [ -f /etc/rancher/k3s/k3s.yaml ]; then
    mkdir -p "${HOME}/.kube"
    sudo cp /etc/rancher/k3s/k3s.yaml "${HOME}/.kube/config"
    sudo chown "$(id -u):$(id -g)" "${HOME}/.kube/config"
    export KUBECONFIG="${HOME}/.kube/config"
    log_info "kubeconfig 설정 완료: ${HOME}/.kube/config"
  fi

  # 노드 Ready 대기
  log_info "k3s 노드 Ready 대기 (최대 120초)..."
  local elapsed=0
  while [ $elapsed -lt 120 ]; do
    if kubectl get nodes --no-headers 2>/dev/null | grep -q "Ready"; then
      log_info "k3s 노드 Ready (${elapsed}초)"
      return 0
    fi
    sleep 5
    elapsed=$((elapsed + 5))
    echo -n "."
  done
  echo ""
  log_warn "k3s 노드가 120초 내에 Ready가 되지 않았습니다"
}

# ============================================================
# 3. Gitea + PostgreSQL
# ============================================================
setup_gitea() {
  log_step "3/7. Gitea + PostgreSQL 설정"

  # 이미 실행 중인지 확인
  if curl -sf "http://localhost:3000/api/v1/version" &>/dev/null; then
    log_info "Gitea가 이미 실행 중입니다"
    return 0
  fi

  if [ -f "${SCRIPT_DIR}/setup-gitea-wsl2.sh" ]; then
    bash "${SCRIPT_DIR}/setup-gitea-wsl2.sh"
  else
    log_error "setup-gitea-wsl2.sh 스크립트를 찾을 수 없습니다"
    exit 1
  fi
}

# ============================================================
# 4. Harbor 레지스트리
# ============================================================
setup_harbor() {
  if [ "$SKIP_HARBOR" = true ]; then
    log_step "4/7. Harbor 설치 건너뜀 (--skip-harbor)"
    return 0
  fi

  log_step "4/7. Harbor 레지스트리 설정"

  # 이미 실행 중인지 확인
  if curl -sf "http://localhost:8080/api/v2.0/systeminfo" &>/dev/null; then
    log_info "Harbor가 이미 실행 중입니다"
    return 0
  fi

  if [ -f "${SCRIPT_DIR}/setup-harbor-wsl2.sh" ]; then
    bash "${SCRIPT_DIR}/setup-harbor-wsl2.sh"
  else
    log_error "setup-harbor-wsl2.sh 스크립트를 찾을 수 없습니다"
    exit 1
  fi
}

# ============================================================
# 5. Act Runner
# ============================================================
setup_runner() {
  log_step "5/7. Gitea Act Runner 설정"

  # Runner가 이미 실행 중인지 확인
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "gitea-runner"; then
    log_info "Act Runner가 이미 실행 중입니다"
    return 0
  fi

  if [ -f "${SCRIPT_DIR}/setup-act-runner.sh" ]; then
    bash "${SCRIPT_DIR}/setup-act-runner.sh"
  else
    log_error "setup-act-runner.sh 스크립트를 찾을 수 없습니다"
    exit 1
  fi
}

# ============================================================
# 6. k3s 레지스트리 설정
# ============================================================
configure_registry() {
  if [ "$SKIP_HARBOR" = true ]; then
    log_step "6/7. k3s 레지스트리 설정 건너뜀 (Harbor 없음)"
    return 0
  fi

  log_step "6/7. k3s 레지스트리 미러 설정"

  local k3s_registries="/etc/rancher/k3s/registries.yaml"
  local template="${PROJECT_ROOT}/infra/harbor/registries.yaml"

  if [ ! -f "${template}" ]; then
    log_warn "registries.yaml 템플릿이 없습니다"
    return 0
  fi

  if ! command -v kubectl &>/dev/null || ! kubectl get nodes &>/dev/null 2>&1; then
    log_warn "k3s가 실행 중이지 않습니다. 레지스트리 설정을 건너뜁니다."
    log_info "k3s 설치 후 수동 설정:"
    log_info "  sudo cp ${template} ${k3s_registries}"
    log_info "  sudo systemctl restart k3s"
    return 0
  fi

  if [ -f "${k3s_registries}" ]; then
    log_info "k3s registries.yaml가 이미 존재합니다"

    # Harbor 설정이 포함되어 있는지 확인
    if grep -q "localhost:8080" "${k3s_registries}" 2>/dev/null; then
      log_info "Harbor 레지스트리 설정이 이미 포함되어 있습니다"
      return 0
    fi

    log_warn "기존 registries.yaml에 Harbor 설정이 없습니다. 백업 후 업데이트합니다."
    sudo cp "${k3s_registries}" "${k3s_registries}.bak.$(date +%Y%m%d%H%M%S)"
  fi

  # Harbor .env에서 비밀번호 읽기
  local harbor_pass="Harbor12345"
  if [ -f "${PROJECT_ROOT}/infra/harbor/.env" ]; then
    # shellcheck disable=SC1091
    source "${PROJECT_ROOT}/infra/harbor/.env"
    harbor_pass="${HARBOR_ADMIN_PASSWORD:-Harbor12345}"
  fi

  sudo mkdir -p "$(dirname "${k3s_registries}")"
  sudo cp "${template}" "${k3s_registries}"
  sudo sed -i "s/CHANGE_ME_harbor_admin_password/${harbor_pass}/g" "${k3s_registries}"

  # k3s 재시작
  if systemctl is-active --quiet k3s 2>/dev/null; then
    log_info "k3s 재시작 중..."
    sudo systemctl restart k3s
    sleep 5

    # 재시작 후 Ready 대기
    local elapsed=0
    while [ $elapsed -lt 60 ]; do
      if kubectl get nodes --no-headers 2>/dev/null | grep -q "Ready"; then
        log_info "k3s 재시작 완료"
        return 0
      fi
      sleep 3
      elapsed=$((elapsed + 3))
    done
    log_warn "k3s 재시작 후 Ready 대기 타임아웃"
  else
    log_warn "k3s가 systemd로 관리되지 않습니다. 수동 재시작이 필요합니다."
  fi
}

# ============================================================
# 7. 검증
# ============================================================
verify_all() {
  log_step "7/7. 전체 검증"
  echo ""

  local passed=0
  local failed=0
  local total=0

  # Gitea 확인
  total=$((total + 1))
  if curl -sf "http://localhost:3000/api/v1/version" &>/dev/null; then
    log_info "  [PASS] Gitea 접속 확인 (localhost:3000)"
    passed=$((passed + 1))
  else
    log_error "  [FAIL] Gitea 접속 실패"
    failed=$((failed + 1))
  fi

  # PostgreSQL 확인
  total=$((total + 1))
  if docker exec gitea-postgres pg_isready -U gitea &>/dev/null 2>&1; then
    log_info "  [PASS] PostgreSQL 접속 확인 (localhost:5433)"
    passed=$((passed + 1))
  else
    log_error "  [FAIL] PostgreSQL 접속 실패"
    failed=$((failed + 1))
  fi

  # Act Runner 확인
  total=$((total + 1))
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "gitea-runner"; then
    log_info "  [PASS] Act Runner 실행 중"
    passed=$((passed + 1))
  else
    log_warn "  [WARN] Act Runner 미실행 (등록 토큰 필요)"
    failed=$((failed + 1))
  fi

  # Harbor 확인
  if [ "$SKIP_HARBOR" = false ]; then
    total=$((total + 1))
    if curl -sf "http://localhost:8080/api/v2.0/systeminfo" &>/dev/null; then
      log_info "  [PASS] Harbor 접속 확인 (localhost:8080)"
      passed=$((passed + 1))
    else
      log_error "  [FAIL] Harbor 접속 실패"
      failed=$((failed + 1))
    fi
  fi

  # k3s 확인
  total=$((total + 1))
  if command -v kubectl &>/dev/null && kubectl get nodes --no-headers 2>/dev/null | grep -q "Ready"; then
    log_info "  [PASS] k3s 노드 Ready"
    passed=$((passed + 1))
  else
    log_warn "  [WARN] k3s 미실행 또는 Not Ready"
    failed=$((failed + 1))
  fi

  # Docker 네트워크 확인
  total=$((total + 1))
  if docker network ls --format '{{.Name}}' 2>/dev/null | grep -q "saas-cicd"; then
    log_info "  [PASS] saas-cicd 네트워크 존재"
    passed=$((passed + 1))
  else
    log_warn "  [WARN] saas-cicd 네트워크 없음"
    failed=$((failed + 1))
  fi

  local end_time
  end_time=$(date +%s)
  local elapsed=$((end_time - START_TIME))

  echo ""
  echo "==========================================="
  echo "  검증 결과: ${passed}/${total} 통과"
  echo "  소요 시간: ${elapsed}초"
  echo "==========================================="
}

# ============================================================
# 상태 확인
# ============================================================
show_status() {
  echo ""
  log_header "==========================================="
  log_header "  WSL2 CI/CD 인프라 전체 상태"
  log_header "==========================================="
  echo ""

  # k3s
  if command -v kubectl &>/dev/null && kubectl get nodes --no-headers 2>/dev/null | grep -q "Ready"; then
    log_info "k3s: 실행 중 (Ready)"
  else
    log_error "k3s: 미실행 또는 Not Ready"
  fi

  # Gitea
  if curl -sf "http://localhost:3000/api/v1/version" &>/dev/null; then
    local gitea_ver
    gitea_ver=$(curl -sf "http://localhost:3000/api/v1/version" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
    log_info "Gitea: 실행 중 (v${gitea_ver}) -- http://localhost:3000"
  else
    log_error "Gitea: 미실행"
  fi

  # PostgreSQL
  if docker exec gitea-postgres pg_isready -U gitea &>/dev/null 2>&1; then
    log_info "PostgreSQL: 실행 중 (localhost:5433)"
  else
    log_error "PostgreSQL: 미실행"
  fi

  # Act Runner
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "gitea-runner"; then
    log_info "Act Runner: 실행 중"
  else
    log_warn "Act Runner: 미실행"
  fi

  # Harbor
  if curl -sf "http://localhost:8080/api/v2.0/systeminfo" &>/dev/null; then
    local harbor_ver
    harbor_ver=$(curl -sf "http://localhost:8080/api/v2.0/systeminfo" | grep -o '"harbor_version":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
    log_info "Harbor: 실행 중 (${harbor_ver}) -- http://localhost:8080"
  else
    log_warn "Harbor: 미실행"
  fi

  # Docker 네트워크
  if docker network ls --format '{{.Name}}' 2>/dev/null | grep -q "saas-cicd"; then
    log_info "Docker Network: saas-cicd 존재"
  else
    log_warn "Docker Network: saas-cicd 없음"
  fi

  echo ""
}

# ============================================================
# 전체 중지
# ============================================================
stop_all() {
  log_info "전체 서비스 중지 중..."

  # Gitea + Runner
  if [ -f "${PROJECT_ROOT}/infra/gitea/docker-compose.yml" ]; then
    cd "${PROJECT_ROOT}/infra/gitea"
    local compose_cmd
    if docker compose version &>/dev/null; then
      compose_cmd="docker compose"
    else
      compose_cmd="docker-compose"
    fi
    ${compose_cmd} down 2>/dev/null || true
    log_info "Gitea + Runner 중지 완료"
  fi

  # Harbor
  if [ -d "/opt/harbor" ]; then
    cd /opt/harbor
    if docker compose version &>/dev/null; then
      sudo docker compose down 2>/dev/null || true
    else
      sudo docker-compose down 2>/dev/null || true
    fi
    log_info "Harbor 중지 완료"
  fi

  log_info "전체 중지 완료"
}

# ============================================================
# 완료 보고
# ============================================================
print_final_summary() {
  local end_time
  end_time=$(date +%s)
  local elapsed=$((end_time - START_TIME))

  echo ""
  log_header "================================================================"
  log_header "  WSL2 CI/CD 인프라 설치 완료"
  log_header "================================================================"
  echo ""
  echo "  소요 시간: ${elapsed}초"
  echo ""
  echo "  서비스 URL:"
  echo "    Gitea:    http://localhost:3000"
  echo "    Harbor:   http://localhost:8080"
  echo ""
  echo "  포트 요약:"
  echo "    3000  -- Gitea Web UI"
  echo "    2222  -- Gitea SSH"
  echo "    5433  -- PostgreSQL (Gitea)"
  echo "    8080  -- Harbor Registry"
  echo ""
  echo "  Git Remote 설정:"
  echo "    git remote add gitea http://localhost:3000/public-saas/saas-platform.git"
  echo ""
  echo "  CI/CD 파이프라인 사용법:"
  echo "    1. 코드를 Gitea에 push하면 자동 CI 실행"
  echo "    2. main 브랜치 push 시 Docker 이미지 빌드 + Harbor push"
  echo "    3. helm deploy로 k3s 클러스터에 자동 배포"
  echo ""
  echo "  유용한 명령어:"
  echo "    ./scripts/setup-wsl2-all.sh --status   # 상태 확인"
  echo "    ./scripts/setup-wsl2-all.sh --stop     # 전체 중지"
  echo "    ./scripts/test-cicd-pipeline.sh        # E2E 검증"
  echo ""
  log_header "================================================================"
}

# ============================================================
# Main
# ============================================================

# 옵션 파싱
for arg in "$@"; do
  case "$arg" in
    --status)
      show_status
      exit 0
      ;;
    --stop)
      stop_all
      exit 0
      ;;
    --skip-harbor)
      SKIP_HARBOR=true
      ;;
    --help|-h)
      echo "사용법: $0 [옵션]"
      echo ""
      echo "옵션:"
      echo "  --status       전체 상태 확인"
      echo "  --stop         전체 중지"
      echo "  --skip-harbor  Harbor 없이 설치"
      echo "  --help         도움말"
      exit 0
      ;;
  esac
done

echo ""
log_header "================================================================"
log_header "  WSL2 CI/CD 인프라 원클릭 설치"
log_header "  k3s + Gitea + Harbor + Act Runner"
log_header "  Design Ref: MTU-N13"
log_header "================================================================"
echo ""

check_prerequisites
setup_k3s
setup_gitea
setup_harbor
setup_runner
configure_registry
verify_all
print_final_summary
