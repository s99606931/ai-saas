#!/bin/bash
# =============================================================================
# Falco 런타임 보안 설치 스크립트
# Design Ref: MTU-N45 Design §Session Guide
# Plan SC: FR-N45.1, FR-N45.2, FR-N45.3, FR-N45.4, FR-N45.5, FR-N45.6
#
# 사전 요구사항: k3s 클러스터, Helm 3, kube-prometheus-stack
# 사용법: bash scripts/setup-falco.sh [install|uninstall|status]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
NAMESPACE="falco-system"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =========================================================================
# Phase 1: 사전 점검
# =========================================================================
check_prerequisites() {
    log_info "사전 요구사항 점검 중..."

    # kubectl 확인
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl이 설치되지 않았습니다."
        exit 1
    fi

    # Helm 확인
    if ! command -v helm &> /dev/null; then
        log_error "Helm이 설치되지 않았습니다."
        exit 1
    fi

    # k3s 클러스터 접근 확인
    if ! kubectl cluster-info &> /dev/null; then
        log_error "k3s 클러스터에 접근할 수 없습니다."
        exit 1
    fi

    # Prometheus 확인
    if kubectl get svc -n monitoring kube-prometheus-stack-prometheus &> /dev/null 2>&1; then
        log_ok "kube-prometheus-stack 감지됨"
    else
        log_warn "kube-prometheus-stack이 감지되지 않았습니다. ServiceMonitor가 작동하지 않을 수 있습니다."
    fi

    log_ok "사전 점검 완료"
}

# =========================================================================
# Phase 2: Falco 설치
# =========================================================================
install_falco() {
    log_info "Falco 런타임 보안 설치 시작..."

    # 네임스페이스 생성
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    log_ok "네임스페이스 $NAMESPACE 생성/확인"

    # Helm 저장소 추가
    helm repo add falcosecurity https://falcosecurity.github.io/charts 2>/dev/null || true
    helm repo update
    log_ok "Falco Helm 저장소 추가"

    # Falco 설치
    log_info "Falco DaemonSet 설치 중..."
    helm upgrade --install falco falcosecurity/falco \
        -n "$NAMESPACE" \
        -f "$PROJECT_DIR/infra/falco/values.yaml" \
        --wait \
        --timeout 5m
    log_ok "Falco 설치 완료"

    # Falcosidekick 설치
    log_info "Falcosidekick 설치 중..."
    helm upgrade --install falcosidekick falcosecurity/falcosidekick \
        -n "$NAMESPACE" \
        -f "$PROJECT_DIR/infra/falco/falcosidekick-values.yaml" \
        --wait \
        --timeout 3m
    log_ok "Falcosidekick 설치 완료"

    # 커스텀 규칙 적용
    log_info "커스텀 규칙 적용 중..."
    kubectl apply -f "$PROJECT_DIR/infra/falco/custom-rules.yaml"
    log_ok "커스텀 규칙 적용 완료 (10개 규칙)"

    # 알림 규칙 적용
    log_info "Prometheus 알림 규칙 적용 중..."
    kubectl apply -f "$PROJECT_DIR/infra/falco/alerting-rules.yaml"
    log_ok "알림 규칙 적용 완료"

    # Grafana 대시보드 ConfigMap
    log_info "Grafana 대시보드 배포 중..."
    kubectl create configmap falco-dashboard \
        --from-file="$PROJECT_DIR/infra/monitoring/dashboards/falco-runtime-security.json" \
        -n monitoring \
        --dry-run=client -o yaml | \
        kubectl label --local -f - grafana_dashboard=1 -o yaml | \
        kubectl apply -f -
    log_ok "Grafana 대시보드 배포 완료"

    log_info ""
    log_ok "========================================="
    log_ok " Falco 런타임 보안 설치 완료"
    log_ok "========================================="
    log_info "Falco UI: kubectl port-forward svc/falcosidekick-ui -n $NAMESPACE 2802:2802"
    log_info "상태 확인: bash $0 status"
}

# =========================================================================
# Phase 3: 상태 확인
# =========================================================================
check_status() {
    log_info "Falco 런타임 보안 상태 확인..."

    echo ""
    echo "=== Falco DaemonSet ==="
    kubectl get ds -n "$NAMESPACE" -l app.kubernetes.io/name=falco 2>/dev/null || echo "  설치되지 않음"

    echo ""
    echo "=== Falcosidekick ==="
    kubectl get deploy -n "$NAMESPACE" -l app.kubernetes.io/name=falcosidekick 2>/dev/null || echo "  설치되지 않음"

    echo ""
    echo "=== Falcosidekick UI ==="
    kubectl get deploy -n "$NAMESPACE" -l app.kubernetes.io/name=falcosidekick-ui 2>/dev/null || echo "  설치되지 않음"

    echo ""
    echo "=== Pods ==="
    kubectl get pods -n "$NAMESPACE" 2>/dev/null || echo "  네임스페이스 없음"

    echo ""
    echo "=== 커스텀 규칙 ==="
    kubectl get configmap falco-custom-rules -n "$NAMESPACE" 2>/dev/null || echo "  적용되지 않음"

    echo ""
    echo "=== 알림 규칙 ==="
    kubectl get prometheusrule falco-runtime-alerts -n "$NAMESPACE" 2>/dev/null || echo "  적용되지 않음"

    echo ""
    echo "=== ServiceMonitor ==="
    kubectl get servicemonitor -n "$NAMESPACE" 2>/dev/null || echo "  없음"
}

# =========================================================================
# Phase 4: 삭제
# =========================================================================
uninstall_falco() {
    log_warn "Falco 런타임 보안 삭제 시작..."

    helm uninstall falcosidekick -n "$NAMESPACE" 2>/dev/null || true
    helm uninstall falco -n "$NAMESPACE" 2>/dev/null || true
    kubectl delete -f "$PROJECT_DIR/infra/falco/custom-rules.yaml" 2>/dev/null || true
    kubectl delete -f "$PROJECT_DIR/infra/falco/alerting-rules.yaml" 2>/dev/null || true
    kubectl delete configmap falco-dashboard -n monitoring 2>/dev/null || true

    log_ok "Falco 삭제 완료"
}

# =========================================================================
# 메인
# =========================================================================
case "${1:-install}" in
    install)
        check_prerequisites
        install_falco
        ;;
    uninstall)
        uninstall_falco
        ;;
    status)
        check_status
        ;;
    *)
        echo "사용법: $0 [install|uninstall|status]"
        exit 1
        ;;
esac
