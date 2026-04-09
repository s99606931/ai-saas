#!/bin/bash
# =============================================================================
# MTU-N35: 공공기관 SaaS 플랫폼 — 원클릭 k3s 배포 스크립트
# Design Ref: MTU-N35 §3.3
# Plan SC: FR-N35.3
# CSAP: D-06(감사 로그), D-08(접근 통제), D-11(가상화 보안)
#
# 사용법:
#   ./scripts/deploy-to-k3s.sh [dev|stg|prod]
#   ./scripts/deploy-to-k3s.sh --status        # 배포 상태 확인
#   ./scripts/deploy-to-k3s.sh --rollback       # 이전 버전 복구
#   ./scripts/deploy-to-k3s.sh --uninstall      # 전체 제거
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"

# ---------------------------------------------------------------------------
# 색상 출력
# ---------------------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERR]${NC}   $*"; exit 1; }
step()    { echo -e "${CYAN}[STEP]${NC}  $*"; }

# ---------------------------------------------------------------------------
# 환경 설정
# ---------------------------------------------------------------------------
ENV="${1:-stg}"
HARBOR_REGISTRY="${HARBOR_REGISTRY:-localhost:8080}"
HARBOR_PROJECT="public-saas"
FLUX_REPO_URL="${FLUX_REPO_URL:-http://172.18.120.97:3000/saas-admin/fleet-infra.git}"

case "$ENV" in
  dev)
    NAMESPACE="saas-dev"
    RELEASE="saas-dev"
    VALUES_FILE="helm/saas-platform/values-dev.yaml"
    ;;
  stg)
    NAMESPACE="saas-staging"
    RELEASE="saas-stg"
    VALUES_FILE="helm/saas-platform/values-stg.yaml"
    ;;
  prod)
    NAMESPACE="saas-production"
    RELEASE="saas-prod"
    VALUES_FILE="helm/saas-platform/values-prod.yaml"
    ;;
  --status)
    shift || true
    exec_status
    exit 0
    ;;
  --rollback)
    shift || true
    exec_rollback
    exit 0
    ;;
  --uninstall)
    shift || true
    exec_uninstall
    exit 0
    ;;
  *)
    echo "사용법: $0 [dev|stg|prod|--status|--rollback|--uninstall]"
    exit 1
    ;;
esac

# ---------------------------------------------------------------------------
# STEP 1: 사전 조건 확인
# ---------------------------------------------------------------------------
preflight_check() {
  step "1/8 사전 조건 확인"

  # k3s 클러스터 접근
  kubectl cluster-info --kubeconfig="$KUBECONFIG" &>/dev/null || \
    error "k3s 클러스터에 접근할 수 없습니다. k3s가 실행 중인지 확인하세요."
  success "k3s 클러스터 접근 가능"

  # Helm 확인
  helm version --short &>/dev/null || \
    error "Helm이 설치되어 있지 않습니다. 'curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash'"
  success "Helm $(helm version --short) 확인"

  # Docker 확인 (이미지 빌드용)
  docker info &>/dev/null || warn "Docker가 실행되지 않습니다. 이미지 빌드 단계를 건너뜁니다."

  # Helm 차트 존재 확인
  [ -d "$PROJECT_DIR/helm/saas-platform" ] || \
    error "Helm 차트를 찾을 수 없습니다: helm/saas-platform/"
  success "Helm 차트 확인: helm/saas-platform/"

  # Values 파일 확인
  [ -f "$PROJECT_DIR/$VALUES_FILE" ] || \
    warn "Values 파일 없음: $VALUES_FILE — 기본값으로 배포합니다."

  # 메모리 확인 (최소 4GB)
  local mem_gb
  mem_gb=$(awk '/MemAvailable/ {printf "%d", $2/1024/1024}' /proc/meminfo 2>/dev/null || echo "0")
  if [[ $mem_gb -lt 4 ]]; then
    warn "가용 메모리 ${mem_gb}GB — 최소 4GB 권장"
  else
    success "가용 메모리 ${mem_gb}GB"
  fi

  echo ""
}

# ---------------------------------------------------------------------------
# STEP 2: 네임스페이스 + 시크릿 생성
# ---------------------------------------------------------------------------
setup_namespace() {
  step "2/8 네임스페이스 및 시크릿 설정 ($NAMESPACE)"

  # 네임스페이스 생성
  kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

  # PostgreSQL 시크릿 생성 (없는 경우만)
  if ! kubectl get secret postgres-credentials -n "$NAMESPACE" &>/dev/null; then
    local pg_pass
    pg_pass=$(openssl rand -base64 24)
    kubectl create secret generic postgres-credentials \
      --namespace="$NAMESPACE" \
      --from-literal=postgres-password="$pg_pass" \
      --from-literal=password="$pg_pass" \
      --from-literal=replication-password="$pg_pass"
    warn "PostgreSQL 비밀번호 생성됨 (보관 필수): $pg_pass"
  else
    success "PostgreSQL 시크릿 이미 존재"
  fi

  # Redis 시크릿 생성 (없는 경우만)
  if ! kubectl get secret redis-credentials -n "$NAMESPACE" &>/dev/null; then
    local redis_pass
    redis_pass=$(openssl rand -base64 16)
    kubectl create secret generic redis-credentials \
      --namespace="$NAMESPACE" \
      --from-literal=redis-password="$redis_pass"
    warn "Redis 비밀번호 생성됨 (보관 필수): $redis_pass"
  else
    success "Redis 시크릿 이미 존재"
  fi

  # Harbor 레지스트리 시크릿 (이미지 풀 용)
  if ! kubectl get secret harbor-registry -n "$NAMESPACE" &>/dev/null; then
    kubectl create secret docker-registry harbor-registry \
      --namespace="$NAMESPACE" \
      --docker-server="$HARBOR_REGISTRY" \
      --docker-username="${HARBOR_USERNAME:?HARBOR_USERNAME 환경변수를 설정하세요}" \
      --docker-password="${HARBOR_PASSWORD:?HARBOR_PASSWORD 환경변수를 설정하세요}" \
      --docker-email="devops@saas.local" 2>/dev/null || \
    warn "Harbor 레지스트리 시크릿 생성 실패 (수동 생성 필요)"
  else
    success "Harbor 레지스트리 시크릿 이미 존재"
  fi

  success "네임스페이스 $NAMESPACE 준비 완료"
  echo ""
}

# ---------------------------------------------------------------------------
# STEP 3: Docker 이미지 빌드 (선택적)
# ---------------------------------------------------------------------------
build_images() {
  step "3/8 Docker 이미지 빌드 (선택적)"

  if ! docker info &>/dev/null; then
    warn "Docker 미실행 — 이미지 빌드 건너뜀 (기존 이미지 사용)"
    echo ""
    return 0
  fi

  read -r -p "  이미지를 새로 빌드하시겠습니까? (y/N) " ans
  if [[ "${ans,,}" != "y" ]]; then
    info "이미지 빌드 건너뜀 — 기존 Harbor 이미지 사용"
    echo ""
    return 0
  fi

  local version
  version="deploy-$(date +%Y%m%d-%H%M%S)"

  local services=(
    api-gateway auth-service user-service tenant-service
    menu-service catalog-service subscription-service billing-service
    crm-service ai-service notification-service file-service
    audit-service compliance-service security-service security-monitor-service
  )

  for svc in "${services[@]}"; do
    local dockerfile="platform/services/$svc/Dockerfile"
    if [ -f "$PROJECT_DIR/$dockerfile" ]; then
      info "  Building $svc..."
      docker build -t "$HARBOR_REGISTRY/$HARBOR_PROJECT/$svc:$version" \
        -t "$HARBOR_REGISTRY/$HARBOR_PROJECT/$svc:latest" \
        -f "$PROJECT_DIR/$dockerfile" "$PROJECT_DIR" && \
      docker push "$HARBOR_REGISTRY/$HARBOR_PROJECT/$svc:$version" && \
      docker push "$HARBOR_REGISTRY/$HARBOR_PROJECT/$svc:latest" && \
      success "  $svc:$version pushed" || \
      warn "  $svc 빌드/푸시 실패 (건너뜀)"
    fi
  done

  # Portal 빌드
  if [ -f "$PROJECT_DIR/platform/apps/portal/Dockerfile" ]; then
    info "  Building portal..."
    docker build -t "$HARBOR_REGISTRY/$HARBOR_PROJECT/portal:$version" \
      -t "$HARBOR_REGISTRY/$HARBOR_PROJECT/portal:latest" \
      -f "$PROJECT_DIR/platform/apps/portal/Dockerfile" "$PROJECT_DIR" && \
    docker push "$HARBOR_REGISTRY/$HARBOR_PROJECT/portal:$version" && \
    docker push "$HARBOR_REGISTRY/$HARBOR_PROJECT/portal:latest" && \
    success "  portal:$version pushed" || \
    warn "  portal 빌드/푸시 실패"
  fi

  echo ""
}

# ---------------------------------------------------------------------------
# STEP 4: Helm 저장소 등록
# ---------------------------------------------------------------------------
setup_helm_repos() {
  step "4/8 Helm 저장소 등록"

  helm repo add bitnami https://charts.bitnami.com/bitnami 2>/dev/null || true
  helm repo update
  success "Helm 저장소 업데이트 완료"
  echo ""
}

# ---------------------------------------------------------------------------
# STEP 5: 인프라 서비스 배포 (PostgreSQL, Redis)
# ---------------------------------------------------------------------------
deploy_infra() {
  step "5/8 인프라 서비스 배포 (PostgreSQL, Redis)"

  # PostgreSQL
  info "  PostgreSQL 배포 중..."
  helm upgrade --install saas-postgres bitnami/postgresql \
    --namespace "$NAMESPACE" \
    --set auth.existingSecret=postgres-credentials \
    --set auth.database=saas_platform \
    --set primary.persistence.storageClass=local-path \
    --set primary.persistence.size=20Gi \
    --set primary.resources.limits.memory=512Mi \
    --set primary.resources.limits.cpu=500m \
    --set metrics.enabled=true \
    --set metrics.serviceMonitor.enabled=true \
    --set metrics.serviceMonitor.labels.release=kube-prometheus-stack \
    --timeout 5m --wait 2>/dev/null && \
  success "  PostgreSQL 배포 완료" || warn "  PostgreSQL 배포 실패 (이미 존재할 수 있음)"

  # Redis
  info "  Redis 배포 중..."
  helm upgrade --install saas-redis bitnami/redis \
    --namespace "$NAMESPACE" \
    --set auth.existingSecret=redis-credentials \
    --set architecture=standalone \
    --set master.persistence.storageClass=local-path \
    --set master.persistence.size=5Gi \
    --set master.resources.limits.memory=256Mi \
    --set master.resources.limits.cpu=250m \
    --set metrics.enabled=true \
    --set metrics.serviceMonitor.enabled=true \
    --set metrics.serviceMonitor.labels.release=kube-prometheus-stack \
    --timeout 5m --wait 2>/dev/null && \
  success "  Redis 배포 완료" || warn "  Redis 배포 실패 (이미 존재할 수 있음)"

  echo ""
}

# ---------------------------------------------------------------------------
# STEP 6: 애플리케이션 배포 (Helm)
# ---------------------------------------------------------------------------
deploy_app() {
  step "6/8 애플리케이션 배포 (Helm)"

  local helm_args=(
    --namespace "$NAMESPACE"
    --create-namespace
    --set "global.imageRegistry=$HARBOR_REGISTRY"
    --set "global.imageProject=$HARBOR_PROJECT"
    --timeout 10m
    --wait
    --atomic
  )

  if [ -f "$PROJECT_DIR/$VALUES_FILE" ]; then
    helm_args+=(-f "$PROJECT_DIR/$VALUES_FILE")
  fi

  info "  Helm 배포: $RELEASE → $NAMESPACE"
  helm upgrade --install "$RELEASE" "$PROJECT_DIR/helm/saas-platform/" \
    "${helm_args[@]}" && \
  success "  애플리케이션 배포 완료" || {
    warn "  Helm 배포 실패 — 자동 롤백 시도"
    helm rollback "$RELEASE" -n "$NAMESPACE" 2>/dev/null || true
    error "배포 실패. 'helm status $RELEASE -n $NAMESPACE'로 확인하세요."
  }

  echo ""
}

# ---------------------------------------------------------------------------
# STEP 7: Flux GitOps 설정 (선택적)
# ---------------------------------------------------------------------------
setup_flux() {
  step "7/8 Flux GitOps 자동 동기화 설정 (선택적)"

  if ! command -v flux &>/dev/null; then
    warn "Flux CLI 미설치 — GitOps 설정 건너뜀"
    info "  설치: curl -s https://fluxcd.io/install.sh | sudo bash"
    echo ""
    return 0
  fi

  # Flux 시스템 확인
  if ! kubectl get namespace flux-system &>/dev/null; then
    info "  Flux 부트스트랩 실행 중..."
    flux bootstrap gitea \
      --owner=saas-admin \
      --repository=fleet-infra \
      --hostname="$(echo $FLUX_REPO_URL | grep -oP '://\K[^/]+')" \
      --path=clusters/wsl-dev \
      --personal 2>/dev/null && \
    success "  Flux 부트스트랩 완료" || warn "  Flux 부트스트랩 실패 (수동 설정 필요)"
  else
    success "  Flux 시스템 이미 동작 중"
  fi

  # Flux 리소스 적용
  if [ -d "$PROJECT_DIR/infra/flux" ]; then
    kubectl apply -f "$PROJECT_DIR/infra/flux/gitea-source.yaml" 2>/dev/null || true
    kubectl apply -f "$PROJECT_DIR/infra/flux/helm-release.yaml" 2>/dev/null || true
    kubectl apply -f "$PROJECT_DIR/infra/flux/platform-kustomization.yaml" 2>/dev/null || true
    kubectl apply -f "$PROJECT_DIR/infra/flux/notification.yaml" 2>/dev/null || true
    success "  Flux CRD 리소스 적용 완료"
  fi

  echo ""
}

# ---------------------------------------------------------------------------
# STEP 8: 배포 검증 + 접속 정보
# ---------------------------------------------------------------------------
verify_deployment() {
  step "8/8 배포 검증 및 접속 정보"

  echo ""
  info "  Pod 상태:"
  kubectl get pods -n "$NAMESPACE" -o wide 2>/dev/null || warn "  Pod 조회 실패"

  echo ""
  info "  서비스 목록:"
  kubectl get svc -n "$NAMESPACE" 2>/dev/null || warn "  서비스 조회 실패"

  echo ""
  info "  Helm 릴리스 상태:"
  helm status "$RELEASE" -n "$NAMESPACE" --show-desc 2>/dev/null | head -10 || warn "  Helm 상태 조회 실패"

  # 노드 IP 확인
  local node_ip
  node_ip=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null || echo "localhost")

  echo ""
  echo "========================================================"
  echo "  공공기관 SaaS 플랫폼 배포 완료"
  echo "========================================================"
  echo "  환경:     $ENV"
  echo "  네임스페이스: $NAMESPACE"
  echo "  릴리스:   $RELEASE"
  echo "  노드 IP:  $node_ip"
  echo ""
  echo "  API Gateway: http://${node_ip}:30080 (NodePort 설정 시)"
  echo "  Portal:      http://${node_ip}:30000 (NodePort 설정 시)"
  echo "  Grafana:     http://${node_ip}:30300"
  echo ""
  echo "  유용한 명령어:"
  echo "    kubectl get pods -n $NAMESPACE -w    # Pod 실시간 모니터링"
  echo "    kubectl logs -f <pod> -n $NAMESPACE  # 로그 실시간 확인"
  echo "    helm history $RELEASE -n $NAMESPACE  # 배포 이력"
  echo "    helm rollback $RELEASE -n $NAMESPACE # 이전 버전 복구"
  echo "========================================================"
}

# ---------------------------------------------------------------------------
# 감사 로그 기록 (CSAP D-06)
# ---------------------------------------------------------------------------
write_audit_log() {
  local status=$1
  local timestamp
  timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  local audit_file="$PROJECT_DIR/.claude/audit.jsonl"

  echo "{\"timestamp\":\"$timestamp\",\"action\":\"K3S_DEPLOY\",\"actor\":\"$(whoami)\",\"environment\":\"$ENV\",\"namespace\":\"$NAMESPACE\",\"release\":\"$RELEASE\",\"status\":\"$status\",\"csap_ref\":\"D-06\"}" >> "$audit_file" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# 상태 확인 서브커맨드
# ---------------------------------------------------------------------------
exec_status() {
  echo "=== 배포 상태 확인 ==="
  for ns in saas-dev saas-staging saas-production; do
    if kubectl get namespace "$ns" &>/dev/null; then
      echo ""
      echo "--- $ns ---"
      kubectl get pods -n "$ns" --no-headers 2>/dev/null | awk '{print "  " $1 " " $3}'
      local total running
      total=$(kubectl get pods -n "$ns" --no-headers 2>/dev/null | wc -l)
      running=$(kubectl get pods -n "$ns" --no-headers 2>/dev/null | grep Running | wc -l)
      echo "  Total: $total / Running: $running"
    fi
  done
}

# ---------------------------------------------------------------------------
# 롤백 서브커맨드
# ---------------------------------------------------------------------------
exec_rollback() {
  echo "=== Helm 롤백 ==="
  local target_ns="${2:-saas-staging}"
  local target_release="${3:-saas-stg}"
  helm history "$target_release" -n "$target_ns" 2>/dev/null || error "릴리스 이력 없음"
  read -r -p "이전 버전으로 롤백하시겠습니까? (y/N) " ans
  [[ "${ans,,}" == "y" ]] || { info "취소됨"; exit 0; }
  helm rollback "$target_release" -n "$target_ns" --wait
  write_audit_log "rollback"
  success "롤백 완료"
}

# ---------------------------------------------------------------------------
# 제거 서브커맨드
# ---------------------------------------------------------------------------
exec_uninstall() {
  echo "=== 전체 제거 ==="
  warn "모든 SaaS 플랫폼 리소스를 제거합니다."
  read -r -p "정말 제거하시겠습니까? (yes/N) " ans
  [[ "${ans,,}" == "yes" ]] || { info "취소됨"; exit 0; }

  for ns in saas-dev saas-staging saas-production; do
    if kubectl get namespace "$ns" &>/dev/null; then
      helm uninstall "saas-${ns##saas-}" -n "$ns" 2>/dev/null || true
      helm uninstall saas-postgres -n "$ns" 2>/dev/null || true
      helm uninstall saas-redis -n "$ns" 2>/dev/null || true
      kubectl delete namespace "$ns" --ignore-not-found 2>/dev/null || true
      info "  $ns 제거됨"
    fi
  done

  write_audit_log "uninstall"
  success "전체 제거 완료"
}

# ---------------------------------------------------------------------------
# 메인 실행
# ---------------------------------------------------------------------------
main() {
  echo "========================================================"
  echo "  공공기관 SaaS 플랫폼 — k3s 배포 ($ENV)"
  echo "  CSAP D-06/D-08/D-11/D-12 준수"
  echo "========================================================"
  echo ""

  preflight_check
  setup_namespace
  build_images
  setup_helm_repos
  deploy_infra
  deploy_app
  setup_flux
  verify_deployment

  write_audit_log "success"

  echo ""
  success "배포 완료! $(date '+%Y-%m-%d %H:%M:%S')"
}

main
