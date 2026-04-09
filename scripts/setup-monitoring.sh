#!/bin/bash
# =============================================================================
# MTU-N36: 공공기관 SaaS 통합 모니터링 시스템 — 원클릭 설치 스크립트
# Design Ref: MTU-N36 §2
# Plan SC: FR-N36.7
# CSAP: D-06(감사 로그), D-08(접근 통제), D-12(PII 마스킹)
#
# LGTM+B 스택: Prometheus + Grafana + Loki + Tempo + OTel + Blackbox
#
# 사용법:
#   ./scripts/setup-monitoring.sh                # 전체 설치
#   ./scripts/setup-monitoring.sh --status        # 상태 확인
#   ./scripts/setup-monitoring.sh --dashboards    # 대시보드만 업데이트
#   ./scripts/setup-monitoring.sh --uninstall     # 전체 제거
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INFRA_DIR="$PROJECT_DIR/infra/monitoring"
NAMESPACE="monitoring"
KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"

# ---------------------------------------------------------------------------
# 색상 출력
# ---------------------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERR]${NC}   $*"; exit 1; }
step()    { echo -e "${CYAN}[STEP]${NC}  $*"; }
header()  { echo -e "\n${BOLD}$*${NC}"; }

# ---------------------------------------------------------------------------
# STEP 1: 사전 조건 확인
# ---------------------------------------------------------------------------
preflight_check() {
  header "=========================================="
  header "  STEP 1/9: 사전 조건 확인"
  header "=========================================="

  # k3s 클러스터
  kubectl cluster-info --kubeconfig="$KUBECONFIG" &>/dev/null || \
    error "k3s 클러스터에 접근할 수 없습니다."
  success "k3s 클러스터 접근 가능"

  # Helm
  helm version --short &>/dev/null || \
    error "Helm이 설치되어 있지 않습니다."
  success "Helm $(helm version --short)"

  # 메모리 확인 (최소 6GB)
  local mem_gb
  mem_gb=$(awk '/MemAvailable/ {printf "%d", $2/1024/1024}' /proc/meminfo 2>/dev/null || echo "0")
  if [[ $mem_gb -lt 6 ]]; then
    warn "가용 메모리 ${mem_gb}GB — 모니터링 스택 최소 6GB 필요"
    warn "메모리 부족 시 일부 컴포넌트가 OOM으로 종료될 수 있습니다"
  else
    success "가용 메모리 ${mem_gb}GB"
  fi

  # 디스크 확인 (최소 50GB)
  local disk_gb
  disk_gb=$(df -BG / | tail -1 | awk '{print int($4)}')
  if [[ $disk_gb -lt 30 ]]; then
    warn "디스크 여유 공간 ${disk_gb}GB — 최소 30GB 권장"
  else
    success "디스크 여유 공간 ${disk_gb}GB"
  fi

  success "사전 조건 확인 완료"
}

# ---------------------------------------------------------------------------
# STEP 2: Helm 저장소 등록
# ---------------------------------------------------------------------------
add_helm_repos() {
  header "=========================================="
  header "  STEP 2/9: Helm 저장소 등록"
  header "=========================================="

  helm repo add grafana     https://grafana.github.io/helm-charts              2>/dev/null || true
  helm repo add prometheus  https://prometheus-community.github.io/helm-charts 2>/dev/null || true
  helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts 2>/dev/null || true
  helm repo update
  success "Helm 저장소 등록 및 업데이트 완료"
}

# ---------------------------------------------------------------------------
# STEP 3: 네임스페이스 + 시크릿
# ---------------------------------------------------------------------------
create_namespace() {
  header "=========================================="
  header "  STEP 3/9: 네임스페이스 및 시크릿 설정"
  header "=========================================="

  kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

  # Grafana 관리자 시크릿
  if ! kubectl get secret grafana-admin-secret -n "$NAMESPACE" &>/dev/null; then
    local grafana_pw
    grafana_pw=$(openssl rand -base64 16)
    kubectl create secret generic grafana-admin-secret \
      --namespace="$NAMESPACE" \
      --from-literal=admin-user=admin \
      --from-literal=admin-password="$grafana_pw"
    echo ""
    warn "============================================="
    warn "  Grafana 초기 관리자 비밀번호 (반드시 저장!)"
    warn "  ID: admin"
    warn "  PW: $grafana_pw"
    warn "============================================="
    echo ""
  else
    success "Grafana 관리자 시크릿 이미 존재"
  fi

  success "네임스페이스 '$NAMESPACE' 준비 완료"
}

# ---------------------------------------------------------------------------
# STEP 4: kube-prometheus-stack (Prometheus + Grafana + AlertManager)
# ---------------------------------------------------------------------------
install_kube_prometheus() {
  header "=========================================="
  header "  STEP 4/9: kube-prometheus-stack 설치"
  header "  (Prometheus + Grafana + AlertManager + Node Exporter)"
  header "=========================================="

  # 커스텀 알림 규칙 먼저 적용
  if [ -f "$INFRA_DIR/alerting-rules.yaml" ]; then
    kubectl apply -f "$INFRA_DIR/alerting-rules.yaml" -n "$NAMESPACE" 2>/dev/null || true
    info "  커스텀 알림 규칙 적용 완료"
  fi

  local values_file="$INFRA_DIR/kube-prometheus-stack/values.yaml"
  local helm_args=(
    --namespace "$NAMESPACE"
    --create-namespace
    --timeout 10m
    --wait
  )

  if [ -f "$values_file" ]; then
    helm_args+=(--values "$values_file")
    info "  Values 파일 사용: $values_file"
  else
    warn "  Values 파일 없음 — 기본값으로 설치"
    helm_args+=(
      --set grafana.service.type=NodePort
      --set grafana.service.nodePort=30300
      --set prometheus.service.type=NodePort
      --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false
      --set prometheus.prometheusSpec.retention=30d
      --set prometheus.prometheusSpec.resources.limits.memory=2Gi
    )
  fi

  helm upgrade --install kube-prometheus-stack prometheus/kube-prometheus-stack "${helm_args[@]}"

  # 커스텀 대시보드 ConfigMap 적용
  if [ -d "$INFRA_DIR/dashboards" ]; then
    local count=0
    for f in "$INFRA_DIR"/dashboards/*.yaml; do
      kubectl apply -f "$f" -n "$NAMESPACE" 2>/dev/null && ((count++)) || true
    done
    info "  커스텀 대시보드 $count개 적용"
  fi

  success "kube-prometheus-stack 설치 완료"
  info "  Grafana:      http://localhost:30300"
  info "  Prometheus:    http://localhost:30090"
  info "  AlertManager:  http://localhost:30093"
}

# ---------------------------------------------------------------------------
# STEP 5: Loki (로그 수집)
# ---------------------------------------------------------------------------
install_loki() {
  header "=========================================="
  header "  STEP 5/9: Loki 설치 (로그 집계)"
  header "=========================================="

  helm upgrade --install loki grafana/loki \
    --namespace "$NAMESPACE" \
    --values "$INFRA_DIR/loki/values.yaml" \
    --timeout 8m \
    --wait

  success "Loki 설치 완료"
  info "  엔드포인트: loki-gateway.monitoring.svc:80"
}

# ---------------------------------------------------------------------------
# STEP 6: Promtail (로그 수집 에이전트)
# ---------------------------------------------------------------------------
install_promtail() {
  header "=========================================="
  header "  STEP 6/9: Promtail 설치 (로그 수집 에이전트)"
  header "=========================================="

  local helm_args=(
    --namespace "$NAMESPACE"
    --timeout 5m
    --wait
  )

  if [ -f "$INFRA_DIR/promtail/values.yaml" ]; then
    helm_args+=(--values "$INFRA_DIR/promtail/values.yaml")
  else
    helm_args+=(
      --set "config.clients[0].url=http://loki-gateway.monitoring.svc.cluster.local/loki/api/v1/push"
    )
  fi

  helm upgrade --install promtail grafana/promtail "${helm_args[@]}"

  success "Promtail 설치 완료 — 모든 Pod 로그 자동 수집 시작"
}

# ---------------------------------------------------------------------------
# STEP 7: Tempo (분산 추적)
# ---------------------------------------------------------------------------
install_tempo() {
  header "=========================================="
  header "  STEP 7/9: Tempo 설치 (분산 추적)"
  header "=========================================="

  helm upgrade --install tempo grafana/tempo \
    --namespace "$NAMESPACE" \
    --values "$INFRA_DIR/tempo/values.yaml" \
    --timeout 5m \
    --wait

  success "Tempo 설치 완료"
  info "  OTLP gRPC: tempo.monitoring.svc:4317"
  info "  OTLP HTTP: tempo.monitoring.svc:4318"
}

# ---------------------------------------------------------------------------
# STEP 8: OpenTelemetry Operator + Collector
# ---------------------------------------------------------------------------
install_otel() {
  header "=========================================="
  header "  STEP 8/9: OpenTelemetry Operator + Collector"
  header "=========================================="

  # cert-manager 의존성
  if ! kubectl get crd certificates.cert-manager.io &>/dev/null; then
    info "  cert-manager 설치 중 (OTel Operator 의존성)..."
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
    info "  cert-manager 파드 준비 대기 중..."
    kubectl wait --for=condition=ready pod -l app=cert-manager -n cert-manager --timeout=120s 2>/dev/null || \
      warn "  cert-manager 준비 시간 초과 — 계속 진행"
  fi

  # OTel Operator 설치
  local otel_args=(
    --namespace "$NAMESPACE"
    --set "manager.collectorImage.repository=otel/opentelemetry-collector-contrib"
    --timeout 8m
    --wait
  )

  if [ -f "$INFRA_DIR/otel-operator/values.yaml" ]; then
    otel_args+=(--values "$INFRA_DIR/otel-operator/values.yaml")
  fi

  helm upgrade --install opentelemetry-operator open-telemetry/opentelemetry-operator "${otel_args[@]}"

  # OTel Collector CRD 적용
  if [ -f "$INFRA_DIR/otel-collector.yaml" ]; then
    kubectl apply -f "$INFRA_DIR/otel-collector.yaml" -n "$NAMESPACE"
    info "  OTel Collector CRD 적용 완료"
  fi

  # Auto-instrumentation 설정
  if [ -f "$INFRA_DIR/instrumentation.yaml" ]; then
    kubectl apply -f "$INFRA_DIR/instrumentation.yaml" -n "$NAMESPACE"
    info "  자동 계측 (Instrumentation) 설정 완료"
  fi

  success "OpenTelemetry Operator + Collector 설치 완료"
  info "  마이크로서비스 자동 계측 활성화 방법:"
  info "    kubectl annotate pod <pod> instrumentation.opentelemetry.io/inject-nodejs=true"
}

# ---------------------------------------------------------------------------
# STEP 9: Blackbox Exporter + PostgreSQL/Redis Exporter
# ---------------------------------------------------------------------------
install_exporters() {
  header "=========================================="
  header "  STEP 9/9: Exporters 설치"
  header "  (Blackbox + PostgreSQL + Redis)"
  header "=========================================="

  # Blackbox Exporter (외부 서비스 모니터링)
  info "  Blackbox Exporter 설치 중..."
  if [ -f "$INFRA_DIR/blackbox-exporter/values.yaml" ]; then
    helm upgrade --install blackbox-exporter prometheus/prometheus-blackbox-exporter \
      --namespace "$NAMESPACE" \
      --values "$INFRA_DIR/blackbox-exporter/values.yaml" \
      --timeout 5m --wait 2>/dev/null && \
    success "  Blackbox Exporter 설치 완료" || \
    warn "  Blackbox Exporter 설치 실패 (건너뜀)"
  fi

  # PostgreSQL Exporter
  info "  PostgreSQL Exporter 설치 중..."
  if ! kubectl get secret postgres-exporter-secret -n "$NAMESPACE" &>/dev/null; then
    warn "  postgres-exporter-secret 미존재 — 아래 명령으로 생성 후 재실행:"
    echo "    kubectl create secret generic postgres-exporter-secret \\"
    echo "      --namespace $NAMESPACE \\"
    echo "      --from-literal=DATA_SOURCE_NAME=\"postgresql://user:pass@host:5432/db?sslmode=disable\""
  else
    if [ -f "$INFRA_DIR/postgres-exporter/values.yaml" ]; then
      helm upgrade --install postgres-exporter prometheus/prometheus-postgres-exporter \
        --namespace "$NAMESPACE" \
        --values "$INFRA_DIR/postgres-exporter/values.yaml" \
        --timeout 5m --wait 2>/dev/null && \
      success "  PostgreSQL Exporter 설치 완료" || \
      warn "  PostgreSQL Exporter 설치 실패"
    fi
  fi

  # Redis Exporter
  info "  Redis Exporter 설치 중..."
  if ! kubectl get secret redis-exporter-secret -n "$NAMESPACE" &>/dev/null; then
    warn "  redis-exporter-secret 미존재 — 아래 명령으로 생성 후 재실행:"
    echo "    kubectl create secret generic redis-exporter-secret \\"
    echo "      --namespace $NAMESPACE \\"
    echo "      --from-literal=REDIS_ADDR=\"redis://host:6379\""
  else
    if [ -f "$INFRA_DIR/redis-exporter/values.yaml" ]; then
      helm upgrade --install redis-exporter prometheus/prometheus-redis-exporter \
        --namespace "$NAMESPACE" \
        --values "$INFRA_DIR/redis-exporter/values.yaml" \
        --timeout 5m --wait 2>/dev/null && \
      success "  Redis Exporter 설치 완료" || \
      warn "  Redis Exporter 설치 실패"
    fi
  fi

  # Grafana Datasource 등록
  register_datasources

  success "모든 Exporter 설치 단계 완료"
}

# ---------------------------------------------------------------------------
# Grafana Datasource 자동 등록
# ---------------------------------------------------------------------------
register_datasources() {
  info "  Grafana Datasource 등록 중..."
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
          nodeGraph:
            enabled: true
EOF
  info "  Grafana Datasource 등록 완료 (Prometheus + Loki + Tempo)"
}

# ---------------------------------------------------------------------------
# 설치 검증
# ---------------------------------------------------------------------------
verify_installation() {
  header "=========================================="
  header "  설치 검증"
  header "=========================================="

  local all_ok=true

  check_component() {
    local label=$1 name=$2
    local ready
    ready=$(kubectl get pods -n "$NAMESPACE" -l "$label" \
      -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
    if [[ "$ready" == "True" ]]; then
      success "  $name: Running"
    else
      warn "  $name: 준비 중 (1~2분 소요)"
      all_ok=false
    fi
  }

  check_component "app.kubernetes.io/name=grafana"                  "Grafana"
  check_component "app.kubernetes.io/name=prometheus"               "Prometheus"
  check_component "app.kubernetes.io/name=alertmanager"             "AlertManager"
  check_component "app.kubernetes.io/name=prometheus-node-exporter" "Node Exporter"
  check_component "app.kubernetes.io/name=kube-state-metrics"       "kube-state-metrics"
  check_component "app.kubernetes.io/name=loki"                     "Loki"
  check_component "app.kubernetes.io/name=promtail"                 "Promtail"
  check_component "app.kubernetes.io/name=tempo"                    "Tempo"
  check_component "app.kubernetes.io/name=opentelemetry-operator"   "OTel Operator"

  echo ""
  if $all_ok; then
    success "모든 컴포넌트 정상 동작"
  else
    warn "일부 컴포넌트 시작 중 — 1~2분 후 재확인:"
    echo "  kubectl get pods -n $NAMESPACE -w"
  fi
}

# ---------------------------------------------------------------------------
# 접속 정보 출력
# ---------------------------------------------------------------------------
print_access_info() {
  local node_ip
  node_ip=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null || echo "localhost")

  echo ""
  echo "========================================================"
  echo "  통합 모니터링 시스템 접속 정보"
  echo "========================================================"
  echo ""
  echo "  [메트릭 & 시각화]"
  echo "    Grafana:        http://${node_ip}:30300"
  echo "    Prometheus:     http://${node_ip}:30090"
  echo "    AlertManager:   http://${node_ip}:30093"
  echo ""
  echo "  [로그]"
  echo "    Loki:           Grafana → Explore → Loki"
  echo "    Promtail:       자동 수집 (모든 Pod)"
  echo ""
  echo "  [분산 추적]"
  echo "    Tempo:          Grafana → Explore → Tempo"
  echo "    서비스 맵:      Grafana → Explore → Tempo → Service Graph"
  echo ""
  echo "  [대시보드]"
  echo "    클러스터 개요:  Grafana → Dashboards → Public SaaS → 클러스터 개요"
  echo "    서비스 RED:     Grafana → Dashboards → Public SaaS → 서비스 RED 메트릭"
  echo "    노드 상세:      Grafana → Dashboards → Public SaaS → 노드 상세 모니터링"
  echo "    SQL 모니터링:   Grafana → Dashboards → Public SaaS → SQL 모니터링"
  echo "    서비스 트래픽:  Grafana → Dashboards → Public SaaS → 서비스 트래픽"
  echo ""
  echo "  [마이크로서비스 자동 계측 방법]"
  echo "    kubectl annotate pod <pod-name> \\"
  echo "      instrumentation.opentelemetry.io/inject-nodejs=true"
  echo ""
  echo "  [pg_stat_statements 활성화]"
  echo "    psql -c \"CREATE EXTENSION IF NOT EXISTS pg_stat_statements;\""
  echo ""
  echo "========================================================"
}

# ---------------------------------------------------------------------------
# 서브커맨드: 상태 확인
# ---------------------------------------------------------------------------
cmd_status() {
  echo "=== 모니터링 시스템 상태 ==="
  echo ""
  kubectl get pods -n "$NAMESPACE" -o wide
  echo ""
  echo "=== Helm 릴리스 ==="
  helm list -n "$NAMESPACE"
  echo ""
  echo "=== 디스크 사용량 ==="
  kubectl exec -n "$NAMESPACE" \
    $(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=prometheus -o jsonpath='{.items[0].metadata.name}' 2>/dev/null) \
    -- df -h /prometheus 2>/dev/null || echo "  Prometheus PVC 확인 불가"
}

# ---------------------------------------------------------------------------
# 서브커맨드: 대시보드만 업데이트
# ---------------------------------------------------------------------------
cmd_dashboards() {
  echo "=== 대시보드 업데이트 ==="
  if [ -d "$INFRA_DIR/dashboards" ]; then
    local count=0
    for f in "$INFRA_DIR"/dashboards/*.yaml; do
      kubectl apply -f "$f" -n "$NAMESPACE" 2>/dev/null && ((count++)) || warn "  실패: $f"
    done
    success "$count개 대시보드 업데이트 완료"
    info "Grafana에서 새로고침하면 적용됩니다"
  else
    error "대시보드 디렉토리 없음: $INFRA_DIR/dashboards"
  fi
}

# ---------------------------------------------------------------------------
# 서브커맨드: 전체 제거
# ---------------------------------------------------------------------------
cmd_uninstall() {
  warn "모든 모니터링 컴포넌트를 제거합니다."
  read -r -p "정말 제거하시겠습니까? (yes/N) " ans
  [[ "${ans,,}" == "yes" ]] || { info "취소됨"; exit 0; }

  helm uninstall blackbox-exporter        -n "$NAMESPACE" 2>/dev/null || true
  helm uninstall redis-exporter           -n "$NAMESPACE" 2>/dev/null || true
  helm uninstall postgres-exporter        -n "$NAMESPACE" 2>/dev/null || true
  helm uninstall opentelemetry-operator   -n "$NAMESPACE" 2>/dev/null || true
  helm uninstall tempo                    -n "$NAMESPACE" 2>/dev/null || true
  helm uninstall promtail                 -n "$NAMESPACE" 2>/dev/null || true
  helm uninstall loki                     -n "$NAMESPACE" 2>/dev/null || true
  helm uninstall kube-prometheus-stack    -n "$NAMESPACE" 2>/dev/null || true

  # CRD 정리
  kubectl delete -f "$INFRA_DIR/otel-collector.yaml" -n "$NAMESPACE" 2>/dev/null || true
  kubectl delete -f "$INFRA_DIR/instrumentation.yaml" -n "$NAMESPACE" 2>/dev/null || true

  kubectl delete namespace "$NAMESPACE" --ignore-not-found

  success "모니터링 시스템 제거 완료"
}

# ---------------------------------------------------------------------------
# 메인
# ---------------------------------------------------------------------------
case "${1:-install}" in
  install)
    echo "========================================================"
    echo "  공공기관 SaaS 통합 모니터링 시스템 설치"
    echo "  LGTM+B: Prometheus + Grafana + Loki + Tempo + OTel"
    echo "  CSAP D-06/D-08/D-12 준수"
    echo "========================================================"

    preflight_check
    add_helm_repos
    create_namespace
    install_kube_prometheus
    install_loki
    install_promtail
    install_tempo
    install_otel
    install_exporters
    verify_installation
    print_access_info

    echo ""
    success "통합 모니터링 시스템 설치 완료! $(date '+%Y-%m-%d %H:%M:%S')"
    ;;
  --status|status)
    cmd_status
    ;;
  --dashboards|dashboards)
    cmd_dashboards
    ;;
  --uninstall|uninstall)
    cmd_uninstall
    ;;
  *)
    echo "사용법: $0 [install|--status|--dashboards|--uninstall]"
    echo ""
    echo "  install       전체 모니터링 스택 설치 (9단계)"
    echo "  --status      현재 상태 확인"
    echo "  --dashboards  Grafana 대시보드만 업데이트"
    echo "  --uninstall   전체 제거"
    exit 1
    ;;
esac
