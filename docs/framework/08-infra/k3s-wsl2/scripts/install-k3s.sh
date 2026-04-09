#!/usr/bin/env bash
# =============================================================================
# k3s WSL2 자동 설치 스크립트
# =============================================================================
# 문서 ID: INFRA-K3S-SCRIPT
# 버전: 1.1.0
# 최종 수정일: 2026-04-06
# FR 매핑: FR-5.1 (10분 이내 k3s 구성)
# 참조: cluster-setup-recipe.md
#
# Design Ref: MTU-I1-k3s-wsl2.design.md 2.2절 -- 스크립트 설계
# Plan SC: WSL2에서 10분 이내 k3s 설치 재현
#
# 변경 이력:
# 1.1.0 | 2026-04-06 | k3s v1.34.6+k3s1 검증, 네임스페이스 saas-platform 변경,
#        |            | Docker 이미지 임포트 단계 추가, FAQ 반영
# 1.0.1 | 2026-04-05 | H-01 품질 검토 수정 -- kubeconfig 권한 644→600 (CSAP-D08 위반 수정) | Implementer Agent
# 1.0.0 | 2026-04-05 | 최초 작성 | Claude Code
# =============================================================================

set -euo pipefail

# --- 색상 정의 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# --- 설정 변수 ---
# v1.34.6+k3s1: 2026-04-06 공공 SaaS 플랫폼 배포 검증 버전
K3S_VERSION="${K3S_VERSION:-v1.34.6+k3s1}"
CLUSTER_CIDR="${CLUSTER_CIDR:-10.42.0.0/16}"
SERVICE_CIDR="${SERVICE_CIDR:-10.43.0.0/16}"
MIN_MEMORY_MB=3072  # 최소 3GB (공공 SaaS 16서비스 권장 8GB)
MIN_DISK_GB=20      # Docker 이미지 포함 최소 20GB
SAAS_NAMESPACE="saas-platform"  # 공공 SaaS 플랫폼 네임스페이스

# --- 시작 시간 기록 ---
START_TIME=$(date +%s)

log_info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# =============================================================================
# Step 1: 사전 요건 확인
# =============================================================================
step1_prerequisites() {
    log_info "Step 1/6: 사전 요건 확인"

    # WSL2 확인
    if [ ! -f /proc/version ] || ! grep -qi "microsoft" /proc/version; then
        log_warn "WSL2 환경이 아닐 수 있습니다. 계속 진행합니다."
    else
        log_ok "WSL2 환경 확인"
    fi

    # 메모리 확인
    TOTAL_MEM_MB=$(free -m | awk '/^Mem:/{print $2}')
    if [ "$TOTAL_MEM_MB" -lt "$MIN_MEMORY_MB" ]; then
        log_error "메모리 부족: ${TOTAL_MEM_MB}MB < ${MIN_MEMORY_MB}MB"
        log_error ".wslconfig에서 memory=4GB 이상 설정 후 WSL 재시작하십시오."
        exit 1
    fi
    log_ok "메모리: ${TOTAL_MEM_MB}MB (최소 ${MIN_MEMORY_MB}MB)"

    # 디스크 확인
    AVAIL_DISK_GB=$(df -BG / | awk 'NR==2{print $4}' | tr -d 'G')
    if [ "$AVAIL_DISK_GB" -lt "$MIN_DISK_GB" ]; then
        log_error "디스크 부족: ${AVAIL_DISK_GB}GB < ${MIN_DISK_GB}GB"
        exit 1
    fi
    log_ok "디스크: ${AVAIL_DISK_GB}GB 여유 (최소 ${MIN_DISK_GB}GB, 16서비스 권장 40GB)"

    # Swap 확인
    SWAP_TOTAL=$(free -m | awk '/^Swap:/{print $2}')
    if [ "$SWAP_TOTAL" -gt 0 ]; then
        log_warn "Swap이 활성화되어 있습니다 (${SWAP_TOTAL}MB). 비활성화를 권장합니다."
        sudo swapoff -a 2>/dev/null || true
        log_ok "Swap 비활성화 완료"
    else
        log_ok "Swap 비활성화 확인"
    fi

    # curl 확인
    if ! command -v curl &>/dev/null; then
        log_info "curl 설치 중..."
        sudo apt-get update -qq && sudo apt-get install -y -qq curl
    fi
    log_ok "curl 설치 확인"
}

# =============================================================================
# Step 2: k3s 설치
# =============================================================================
step2_install_k3s() {
    log_info "Step 2/6: k3s ${K3S_VERSION} 설치"

    # 기존 설치 확인
    if command -v k3s &>/dev/null; then
        log_warn "기존 k3s 설치가 감지되었습니다."
        read -p "기존 설치를 제거하고 재설치하시겠습니까? (y/N): " -r
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            /usr/local/bin/k3s-uninstall.sh 2>/dev/null || true
            log_ok "기존 k3s 제거 완료"
        else
            log_info "기존 설치를 유지합니다. Step 3으로 건너뜁니다."
            return 0
        fi
    fi

    export INSTALL_K3S_VERSION="${K3S_VERSION}"

    curl -sfL https://get.k3s.io | sh -s - \
        --flannel-backend=none \
        --disable=traefik \
        --disable-network-policy \
        --protect-kernel-defaults \
        --secrets-encryption \
        --write-kubeconfig-mode 600 \
        --cluster-cidr="${CLUSTER_CIDR}" \
        --service-cidr="${SERVICE_CIDR}"

    log_ok "k3s ${K3S_VERSION} 설치 완료"
}

# =============================================================================
# Step 3: CNI 설치 (kube-router)
# =============================================================================
step3_install_cni() {
    log_info "Step 3/6: kube-router CNI 설치"

    export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

    # k3s가 준비될 때까지 대기 (최대 60초)
    local timeout=60
    local elapsed=0
    while ! kubectl get nodes &>/dev/null; do
        if [ $elapsed -ge $timeout ]; then
            log_error "k3s API 서버 시작 시간 초과 (${timeout}초)"
            exit 1
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done

    kubectl apply -f https://raw.githubusercontent.com/cloudnativelabs/kube-router/master/daemonset/kubeadm-kuberouter.yaml

    # kube-router 준비 대기 (최대 120초)
    log_info "kube-router 시작 대기 중..."
    kubectl wait --for=condition=ready pod -l k8s-app=kube-router -n kube-system --timeout=120s || {
        log_warn "kube-router 준비 시간 초과. 수동 확인이 필요합니다."
    }

    log_ok "kube-router CNI 설치 완료"
}

# =============================================================================
# Step 4: CSAP-D11 보안 설정
# =============================================================================
step4_security_hardening() {
    log_info "Step 4/6: CSAP-D11 보안 강화"

    export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

    # 서비스 네임스페이스 생성 + PSS 적용
    kubectl create namespace "${SAAS_NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

    # Pod Security Standards (restricted) 적용
    kubectl label namespace "${SAAS_NAMESPACE}" \
        pod-security.kubernetes.io/enforce=restricted \
        pod-security.kubernetes.io/audit=restricted \
        pod-security.kubernetes.io/warn=restricted \
        --overwrite

    # default 네임스페이스에도 PSS 적용
    kubectl label namespace default \
        pod-security.kubernetes.io/enforce=restricted \
        pod-security.kubernetes.io/audit=restricted \
        pod-security.kubernetes.io/warn=restricted \
        --overwrite

    # 기본 NetworkPolicy (deny-all) 적용
    cat <<'POLICY' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
  namespace: saas-app
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
POLICY

    log_ok "CSAP-D11 보안 설정 완료 (PSS restricted + deny-all NetworkPolicy)"
}

# =============================================================================
# Step 5: kubectl 설정
# =============================================================================
step5_configure_kubectl() {
    log_info "Step 5/6: kubectl 설정"

    mkdir -p ~/.kube
    sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
    sudo chown "$(id -u):$(id -g)" ~/.kube/config

    # .bashrc에 KUBECONFIG 설정 (중복 방지)
    if ! grep -q 'KUBECONFIG=~/.kube/config' ~/.bashrc 2>/dev/null; then
        echo 'export KUBECONFIG=~/.kube/config' >> ~/.bashrc
    fi

    export KUBECONFIG=~/.kube/config

    log_ok "kubectl 설정 완료"
}

# =============================================================================
# Step 6: 설치 확인 및 보고
# =============================================================================
step6_verify() {
    log_info "Step 6/6: 설치 확인"

    export KUBECONFIG=~/.kube/config

    echo ""
    echo "=========================================="
    echo "  k3s WSL2 클러스터 설치 결과"
    echo "=========================================="
    echo ""

    # 노드 상태
    log_info "노드 상태:"
    kubectl get nodes -o wide
    echo ""

    # 시스템 Pod 상태
    log_info "시스템 Pod 상태:"
    kubectl get pods -n kube-system
    echo ""

    # 네임스페이스 PSS 확인
    log_info "네임스페이스 보안 레이블:"
    kubectl get namespace "${SAAS_NAMESPACE}" --show-labels | grep pod-security 2>/dev/null || log_warn "PSS 레이블 미적용"
    echo ""

    # NetworkPolicy 확인
    log_info "NetworkPolicy 목록:"
    kubectl get networkpolicy -n "${SAAS_NAMESPACE}" 2>/dev/null || log_warn "NetworkPolicy 없음"
    echo ""

    # 시크릿 암호화 확인
    if [ -f /var/lib/rancher/k3s/server/cred/encryption-config.json ]; then
        log_ok "etcd 시크릿 암호화 활성화"
    else
        log_warn "시크릿 암호화 설정 파일 미발견"
    fi

    # 설치 시간 계산
    END_TIME=$(date +%s)
    ELAPSED=$((END_TIME - START_TIME))
    MINUTES=$((ELAPSED / 60))
    SECONDS=$((ELAPSED % 60))

    echo ""
    echo "=========================================="
    echo "  설치 완료!"
    echo "  소요 시간: ${MINUTES}분 ${SECONDS}초"
    if [ $ELAPSED -le 600 ]; then
        echo "  [PASS] 10분 이내 설치 (FR-5.1 충족)"
    else
        echo "  [WARN] 10분 초과 (FR-5.1 미충족)"
    fi
    echo "=========================================="
    echo ""
    echo "다음 단계 (공공 SaaS 플랫폼 배포):"
    echo "  1. Docker 이미지 빌드: docker build -t saas/{svc}:dev ..."
    echo "  2. k3s 이미지 임포트: docker save saas/{svc}:dev | sudo k3s ctr images import -"
    echo "  3. 시크릿 생성: kubectl create secret generic saas-secrets ..."
    echo "  4. 매니페스트 배포: kubectl apply -f k8s/"
    echo "  5. DB 초기화: prisma db push (port-forward 필요)"
    echo "  6. 접근: kubectl port-forward svc/portal-svc 14000:4000 -n ${SAAS_NAMESPACE}"
    echo ""
    echo "  ⚠️  WSL2 주의: NodePort 직접 접근 불가 → kubectl port-forward 사용"
    echo "  📖  상세: cluster-setup-recipe.md 5절 (WSL2 네트워크 접근)"
}

# =============================================================================
# 메인 실행
# =============================================================================
main() {
    echo ""
    echo "=========================================="
    echo "  k3s WSL2 클러스터 설치 스크립트"
    echo "  버전: 1.1.0 | k3s: ${K3S_VERSION}"
    echo "  검증: v1.34.6+k3s1 (2026-04-06)"
    echo "=========================================="
    echo ""

    # root 권한 확인
    if [ "$(id -u)" -ne 0 ]; then
        log_error "root 권한이 필요합니다. 'sudo $0' 으로 실행하십시오."
        exit 1
    fi

    step1_prerequisites
    step2_install_k3s
    step3_install_cni
    step4_security_hardening
    step5_configure_kubectl
    step6_verify
}

main "$@"
