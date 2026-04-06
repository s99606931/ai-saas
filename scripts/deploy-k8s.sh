#!/bin/bash
# 공공기관 SaaS 프레임워크 — k8s (k3s) 배포 스크립트
# Design Ref: DESIGN-MTU-DEP2 | CSAP: D-11
#
# 사용법:
#   ./scripts/deploy-k8s.sh             # 전체 배포
#   ./scripts/deploy-k8s.sh --status    # 상태 확인
#   ./scripts/deploy-k8s.sh --delete    # 전체 삭제

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
K8S_DIR="${PROJECT_ROOT}/k8s"
NAMESPACE="saas-platform"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_prereqs() {
  if ! command -v kubectl &>/dev/null; then
    log_error "kubectl이 설치되지 않았습니다"
    exit 1
  fi
  if ! kubectl cluster-info &>/dev/null; then
    log_error "Kubernetes 클러스터에 연결할 수 없습니다"
    exit 1
  fi
  log_info "클러스터 연결 확인 완료"
}

show_status() {
  echo ""
  echo "==========================================="
  echo "  ${NAMESPACE} 네임스페이스 상태"
  echo "==========================================="
  echo ""
  log_info "Pods:"
  kubectl get pods -n "${NAMESPACE}" -o wide 2>/dev/null || echo "  (없음)"
  echo ""
  log_info "Services:"
  kubectl get svc -n "${NAMESPACE}" 2>/dev/null || echo "  (없음)"
  echo ""
  log_info "Deployments:"
  kubectl get deployments -n "${NAMESPACE}" 2>/dev/null || echo "  (없음)"
}

deploy_all() {
  check_prereqs

  echo ""
  echo "==========================================="
  echo "  공공기관 SaaS 프레임워크 k8s 배포"
  echo "==========================================="
  echo ""

  # 1. Namespace
  log_info "1단계: Namespace 생성"
  kubectl apply -f "${K8S_DIR}/config/namespace.yaml"

  # 2. Secrets
  if [ -f "${K8S_DIR}/config/secrets.yaml" ]; then
    log_info "2단계: Secrets 적용"
    kubectl apply -f "${K8S_DIR}/config/secrets.yaml"
  else
    log_warn "2단계: secrets.yaml 없음. secrets.example.yaml을 참조하여 생성하십시오."
    log_warn "  cp ${K8S_DIR}/config/secrets.example.yaml ${K8S_DIR}/config/secrets.yaml"
    log_warn "  (값을 base64 인코딩하여 교체)"
    exit 1
  fi

  # 3. ConfigMap
  log_info "3단계: ConfigMap 적용"
  kubectl apply -f "${K8S_DIR}/config/configmap.yaml"

  # 4. 인프라
  log_info "4단계: 인프라 배포 (PostgreSQL, Redis, MinIO)"
  kubectl apply -f "${K8S_DIR}/infra/"

  # 인프라 대기
  log_info "인프라 Pod Ready 대기 (최대 120초)..."
  kubectl wait --for=condition=Ready pods -l app=postgres -n "${NAMESPACE}" --timeout=120s 2>/dev/null || true
  kubectl wait --for=condition=Ready pods -l app=redis -n "${NAMESPACE}" --timeout=120s 2>/dev/null || true

  # 5. 마이크로서비스
  log_info "5단계: 마이크로서비스 15종 배포"
  kubectl apply -f "${K8S_DIR}/services/microservices.yaml"

  # 6. 포털
  log_info "6단계: 포털 배포"
  kubectl apply -f "${K8S_DIR}/portal/portal.yaml"

  echo ""
  log_info "배포 완료. Pod 상태 확인 중..."
  sleep 3
  show_status
}

delete_all() {
  log_warn "전체 삭제: ${NAMESPACE} 네임스페이스"
  read -p "정말 삭제하시겠습니까? (y/N): " confirm
  if [ "${confirm}" = "y" ] || [ "${confirm}" = "Y" ]; then
    kubectl delete namespace "${NAMESPACE}" --ignore-not-found=true
    log_info "삭제 완료"
  else
    log_info "삭제 취소"
  fi
}

case "${1:-}" in
  --status)
    show_status
    ;;
  --delete)
    delete_all
    ;;
  *)
    deploy_all
    ;;
esac
