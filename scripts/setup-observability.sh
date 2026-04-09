#!/bin/bash
# =============================================================================
# MTU-N24: 마이크로서비스 관측가능성(Observability) 플랫폼 설치 스크립트
# 배포 방식: k3s + Helm Chart (Docker Compose 사용 안 함)
# CSAP: D-06(감사로그), D-08(접근통제), D-12(PII 마스킹)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/../infra/monitoring"
NAMESPACE="monitoring"
KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"

# 색상 출력
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*"; exit 1; }

# =============================================================================
# 사전 확인
# =============================================================================
preflight_check() {
  info "사전 조건 확인 중..."

  # k3s 동작 확인 (Docker Compose 아님)
  kubectl cluster-info --kubeconfig="$KUBECONFIG" &>/dev/null || \
    error "k3s 클러스터에 접근할 수 없습니다. 'sudo k3s kubectl cluster-info' 확인 필요"

  # Helm 설치 확인
  helm version --short &>/dev/null || \
    error "Helm이 설치되어 있지 않습니다. 'curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash'"

  # 메모리 확인 (최소 6GB 권장)
  local mem_gb
  mem_gb=$(awk '/MemAvailable/ {printf "%d", $2/1024/1024}' /proc/meminfo)
  if [[ $mem_gb -lt 4 ]]; then
    warn "가용 메모리 ${mem_gb}GB — 최소 4GB 필요. 계속 진행하면 OOM 위험"
    read -r -p "계속하시겠습니까? (y/N) " ans
    [[ "${ans,,}" == "y" ]] || exit 0
  else
    success "가용 메모리 ${mem_gb}GB 확인"
  fi

  success "사전 조건 통과"
}

# =============================================================================
# Helm 저장소 등록
# =============================================================================
add_helm_repos() {
  info "Helm 저장소 등록..."
  helm repo add grafana    https://grafana.github.io/helm-charts              2>/dev/null || true
  helm repo add prometheus https://prometheus-community.github.io/helm-charts 2>/dev/null || true
  helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts 2>/dev/null || true
  helm repo update
  success "Helm 저장소 등록 완료"
}

# =============================================================================
# 네임스페이스 및 기본 리소스 생성
# =============================================================================
create_namespace() {
  info "네임스페이스 설정..."
  kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

  # Grafana 초기 관리자 비밀번호 (운영 전 반드시 변경)
  if ! kubectl get secret grafana-admin-secret -n "$NAMESPACE" &>/dev/null; then
    local grafana_pw
    grafana_pw=$(openssl rand -base64 16)
    kubectl create secret generic grafana-admin-secret \
      --namespace="$NAMESPACE" \
      --from-literal=admin-password="$grafana_pw"
    warn "Grafana 초기 관리자 비밀번호: $grafana_pw (반드시 저장 후 변경)"
  fi

  success "네임스페이스 '$NAMESPACE' 준비 완료"
}

# =============================================================================
# STEP 1: kube-prometheus-stack (Prometheus + Grafana + AlertManager)
# =============================================================================
install_kube_prometheus() {
  info "[1/7] kube-prometheus-stack 설치 중 (Prometheus + Grafana + AlertManager)..."

  # 기존 alerting-rules ConfigMap 적용
  kubectl apply -f "$INFRA_DIR/alerting-rules.yaml" -n "$NAMESPACE" 2>/dev/null || true

  helm upgrade --install kube-prometheus-stack prometheus/kube-prometheus-stack \
    --namespace "$NAMESPACE" \
    --create-namespace \
    --set grafana.adminPassword="$(kubectl get secret grafana-admin-secret -n $NAMESPACE -o jsonpath='{.data.admin-password}' | base64 -d)" \
    --set grafana.service.type=NodePort \
    --set grafana.service.nodePort=30300 \
    --set prometheus.service.type=NodePort \
    --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
    --set prometheus.prometheusSpec.retention=30d \
    --set prometheus.prometheusSpec.resources.limits.memory=2Gi \
    --set alertmanager.alertmanagerSpec.resources.limits.memory=256Mi \
    --timeout 10m \
    --wait

  # 기존 커스텀 대시보드 ConfigMap 적용
  for dashboard_file in "$INFRA_DIR"/dashboards/*.yaml; do
    kubectl apply -f "$dashboard_file" -n "$NAMESPACE" 2>/dev/null || true
  done

  success "[1/7] kube-prometheus-stack 설치 완료 — Grafana: http://localhost:30300"
}

# =============================================================================
# STEP 2: Loki (로그 집계)
# =============================================================================
install_loki() {
  info "[2/7] Loki 설치 중 (로그 집계 + PII 마스킹)..."

  helm upgrade --install loki grafana/loki \
    --namespace "$NAMESPACE" \
    --values "$INFRA_DIR/loki/values.yaml" \
    --timeout 8m \
    --wait

  success "[2/7] Loki 설치 완료 — 엔드포인트: loki-gateway.monitoring.svc:80"
}

# =============================================================================
# STEP 3: Promtail (로그 수집 에이전트)
# =============================================================================
install_promtail() {
  info "[3/7] Promtail 설치 중 (k3s 파드 로그 수집)..."

  # Promtail values.yaml이 없으면 기본값으로 설치
  if [[ -f "$INFRA_DIR/promtail/values.yaml" ]]; then
    helm upgrade --install promtail grafana/promtail \
      --namespace "$NAMESPACE" \
      --values "$INFRA_DIR/promtail/values.yaml" \
      --timeout 5m --wait
  else
    helm upgrade --install promtail grafana/promtail \
      --namespace "$NAMESPACE" \
      --set config.clients[0].url=http://loki-gateway.monitoring.svc.cluster.local/loki/api/v1/push \
      --timeout 5m --wait
  fi

  success "[3/7] Promtail 설치 완료 — k3s 파드 로그 자동 수집 시작"
}

# =============================================================================
# STEP 4: Tempo (분산 추적)
# =============================================================================
install_tempo() {
  info "[4/7] Tempo 설치 중 (분산 추적 + TraceQL)..."

  helm upgrade --install tempo grafana/tempo \
    --namespace "$NAMESPACE" \
    --values "$INFRA_DIR/tempo/values.yaml" \
    --timeout 5m \
    --wait

  success "[4/7] Tempo 설치 완료 — OTLP gRPC: tempo.monitoring.svc:4317"
}

# =============================================================================
# STEP 5: OpenTelemetry Operator + Collector
# =============================================================================
install_otel() {
  info "[5/7] OpenTelemetry Operator 설치 중..."

  # cert-manager 의존성 확인 (OTel Operator 필요)
  if ! kubectl get crd certificates.cert-manager.io &>/dev/null; then
    info "  cert-manager 설치 중..."
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
    kubectl wait --for=condition=ready pod -l app=cert-manager -n cert-manager --timeout=120s
  fi

  helm upgrade --install opentelemetry-operator open-telemetry/opentelemetry-operator \
    --namespace "$NAMESPACE" \
    --values "$INFRA_DIR/otel-operator/values.yaml" \
    --set "manager.collectorImage.repository=otel/opentelemetry-collector-contrib" \
    --timeout 8m \
    --wait

  # OTel Collector 및 Auto-instrumentation CR 적용
  kubectl apply -f "$INFRA_DIR/otel-collector.yaml" -n "$NAMESPACE"
  kubectl apply -f "$INFRA_DIR/instrumentation.yaml" -n "$NAMESPACE"

  success "[5/7] OpenTelemetry Operator 설치 완료 — 마이크로서비스 자동 계측 활성화"
}

# =============================================================================
# STEP 6: PostgreSQL Exporter (SQL 모니터링)
# =============================================================================
install_postgres_exporter() {
  info "[6/7] PostgreSQL Exporter 설치 중 (슬로우쿼리 모니터링)..."

  # DB 접속 정보 Secret 확인
  if ! kubectl get secret postgres-exporter-secret -n "$NAMESPACE" &>/dev/null; then
    warn "postgres-exporter-secret이 없습니다. 아래 명령으로 생성 후 재실행:"
    echo ""
    echo "  kubectl create secret generic postgres-exporter-secret \\"
    echo "    --namespace $NAMESPACE \\"
    echo '    --from-literal=DATA_SOURCE_NAME="postgresql://user:pass@postgres-host:5432/dbname?sslmode=disable"'
    echo ""
    warn "PostgreSQL Exporter 설치 건너뜀 (Secret 생성 후 수동 실행 필요)"
    return 0
  fi

  helm upgrade --install postgres-exporter prometheus/prometheus-postgres-exporter \
    --namespace "$NAMESPACE" \
    --values "$INFRA_DIR/postgres-exporter/values.yaml" \
    --timeout 5m \
    --wait

  success "[6/7] PostgreSQL Exporter 설치 완료"
}

# =============================================================================
# STEP 7: Redis Exporter
# =============================================================================
install_redis_exporter() {
  info "[7/7] Redis Exporter 설치 중..."

  if ! kubectl get secret redis-exporter-secret -n "$NAMESPACE" &>/dev/null; then
    warn "redis-exporter-secret이 없습니다. 아래 명령으로 생성 후 재실행:"
    echo ""
    echo "  kubectl create secret generic redis-exporter-secret \\"
    echo "    --namespace $NAMESPACE \\"
    echo '    --from-literal=REDIS_ADDR="redis://redis-host:6379"'
    echo '    --from-literal=REDIS_PASSWORD="your-redis-password"'
    echo ""
    warn "Redis Exporter 설치 건너뜀 (Secret 생성 후 수동 실행 필요)"
    return 0
  fi

  helm upgrade --install redis-exporter prometheus/prometheus-redis-exporter \
    --namespace "$NAMESPACE" \
    --values "$INFRA_DIR/redis-exporter/values.yaml" \
    --timeout 5m \
    --wait

  success "[7/7] Redis Exporter 설치 완료"
}

# =============================================================================
# Grafana Datasource 자동 등록
# =============================================================================
register_grafana_datasources() {
  info "Grafana Datasource 등록 중 (Loki, Tempo)..."

  # Grafana Datasource ConfigMap 생성
  kubectl apply -f - -n "$NAMESPACE" <<'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-datasources-extra
  labels:
    grafana_datasource: "1"
data:
  datasources.yaml: |
    apiVersion: 1
    datasources:
      - name: Loki
        type: loki
        url: http://loki-gateway.monitoring.svc.cluster.local
        access: proxy
        isDefault: false
        jsonData:
          derivedFields:
            - datasourceUid: tempo
              matcherRegex: '"traceId":"([^"]+)"'
              name: TraceID
              url: '$${__value.raw}'
      - name: Tempo
        type: tempo
        uid: tempo
        url: http://tempo.monitoring.svc.cluster.local:3100
        access: proxy
        jsonData:
          serviceMap:
            datasourceUid: prometheus
          lokiSearch:
            datasourceUid: loki
EOF

  success "Grafana Datasource 등록 완료 (Prometheus + Loki + Tempo)"
}

# =============================================================================
# 설치 상태 확인
# =============================================================================
verify_installation() {
  info "설치 상태 확인 중..."
  echo ""

  local all_ok=true

  check_pod() {
    local label=$1 name=$2
    local ready
    ready=$(kubectl get pods -n "$NAMESPACE" -l "$label" \
      -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
    if [[ "$ready" == "True" ]]; then
      success "  $name: Running"
    else
      warn "  $name: 아직 준비 중 (kubectl get pods -n $NAMESPACE 로 확인)"
      all_ok=false
    fi
  }

  check_pod "app.kubernetes.io/name=grafana"          "Grafana"
  check_pod "app.kubernetes.io/name=prometheus"       "Prometheus"
  check_pod "app.kubernetes.io/name=alertmanager"     "AlertManager"
  check_pod "app.kubernetes.io/name=loki"             "Loki"
  check_pod "app.kubernetes.io/name=promtail"         "Promtail"
  check_pod "app.kubernetes.io/name=tempo"            "Tempo"
  check_pod "app.kubernetes.io/name=opentelemetry-operator" "OTel Operator"

  echo ""
  if $all_ok; then
    success "모든 컴포넌트 정상 동작 중"
  else
    warn "일부 컴포넌트가 아직 시작 중입니다. 1~2분 후 다시 확인하세요:"
    echo "  kubectl get pods -n $NAMESPACE -w"
  fi
}

# =============================================================================
# 접속 정보 출력
# =============================================================================
print_access_info() {
  local node_ip
  node_ip=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null || echo "localhost")

  echo ""
  echo "========================================================"
  echo "  관측가능성 플랫폼 접속 정보 (k3s NodePort)"
  echo "========================================================"
  echo "  Grafana 대시보드  : http://${node_ip}:30300"
  echo "                      (ID: admin / PW: grafana-admin-secret 확인)"
  echo ""
  echo "  Prometheus        : http://${node_ip}:30090  (내부 접근)"
  echo "  AlertManager      : http://${node_ip}:30093  (내부 접근)"
  echo "  Loki              : http://loki-gateway.monitoring.svc:80 (클러스터 내)"
  echo "  Tempo (OTLP gRPC) : tempo.monitoring.svc:4317 (클러스터 내)"
  echo "  Tempo (OTLP HTTP) : tempo.monitoring.svc:4318 (클러스터 내)"
  echo ""
  echo "  pg_stat_statements 활성화 명령:"
  echo "    psql -c \"CREATE EXTENSION IF NOT EXISTS pg_stat_statements;\""
  echo "    # postgresql.conf: shared_preload_libraries = 'pg_stat_statements'"
  echo ""
  echo "  마이크로서비스 자동 계측 활성화 (파드 annotation):"
  echo "    kubectl annotate pod <pod-name> instrumentation.opentelemetry.io/inject-nodejs=true"
  echo "========================================================"
}

# =============================================================================
# 제거 명령
# =============================================================================
uninstall_all() {
  warn "모든 관측가능성 컴포넌트를 제거합니다..."
  read -r -p "정말 제거하시겠습니까? (yes/N) " ans
  [[ "${ans,,}" == "yes" ]] || { info "취소됨"; exit 0; }

  helm uninstall redis-exporter       -n "$NAMESPACE" 2>/dev/null || true
  helm uninstall postgres-exporter    -n "$NAMESPACE" 2>/dev/null || true
  helm uninstall opentelemetry-operator -n "$NAMESPACE" 2>/dev/null || true
  helm uninstall tempo                -n "$NAMESPACE" 2>/dev/null || true
  helm uninstall promtail             -n "$NAMESPACE" 2>/dev/null || true
  helm uninstall loki                 -n "$NAMESPACE" 2>/dev/null || true
  helm uninstall kube-prometheus-stack -n "$NAMESPACE" 2>/dev/null || true

  kubectl delete namespace "$NAMESPACE" --ignore-not-found
  success "제거 완료"
}

# =============================================================================
# 메인
# =============================================================================
usage() {
  echo "사용법: $0 [install|uninstall|status|verify]"
  echo ""
  echo "  install   — 전체 관측가능성 스택 설치 (k3s Helm)"
  echo "  uninstall — 전체 제거"
  echo "  status    — 파드 상태 확인"
  echo "  verify    — 설치 검증"
}

case "${1:-install}" in
  install)
    echo "========================================================"
    echo "  MTU-N24: 관측가능성 플랫폼 설치 (k3s + Helm)"
    echo "  LGTM 스택 + OTel + PostgreSQL/Redis Exporter"
    echo "========================================================"
    preflight_check
    add_helm_repos
    create_namespace
    install_kube_prometheus
    install_loki
    install_promtail
    install_tempo
    install_otel
    install_postgres_exporter
    install_redis_exporter
    register_grafana_datasources
    verify_installation
    print_access_info
    ;;
  uninstall)
    uninstall_all
    ;;
  status)
    kubectl get pods -n "$NAMESPACE" -o wide
    ;;
  verify)
    verify_installation
    print_access_info
    ;;
  *)
    usage
    exit 1
    ;;
esac
