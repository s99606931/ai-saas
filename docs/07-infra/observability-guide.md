# 마이크로서비스 관측가능성 플랫폼 운영 가이드

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: Implementer Agent
> **MTU**: MTU-N24 | **CSAP**: D-06 (감사로그), D-08 (접근통제), D-12 (개발보안)
> **배포 방식**: k3s + Helm Chart (Docker Compose 사용 안 함)

---

## 1. 개요

### 1.1 LGTM 스택이란

공공기관 SaaS 프레임워크의 관측가능성 플랫폼은 다음 4가지 오픈소스 컴포넌트로 구성됩니다.

| 약자 | 컴포넌트 | 역할 |
|------|----------|------|
| L | **Loki** | 로그 집계 및 조회 (LogQL) |
| G | **Grafana** | 시각화 대시보드 및 탐색 UI |
| T | **Tempo** | 분산 추적 (TraceQL, OTLP) |
| M | **Mimir / Prometheus** | 메트릭 수집 및 AlertManager |

여기에 **OpenTelemetry Operator**를 추가하여 마이크로서비스 자동 계측을 지원합니다.

### 1.2 아키텍처 다이어그램

```
                  ┌──────────────────────────────────────────────────┐
                  │           k3s 클러스터 (monitoring 네임스페이스)         │
                  │                                                  │
  마이크로서비스 파드  │   OTel Collector                                 │
  ┌──────────┐    │   ┌────────────┐  traces   ┌─────────┐          │
  │ Node.js  │──traces──►  4317/gRPC │──────────►│  Tempo  │          │
  │ Python   │    │   │  4318/HTTP │           │ :3100   │          │
  │ Java     │    │   └──────┬─────┘           └────┬────┘          │
  └────┬─────┘    │          │ metrics              │ TraceQL        │
       │ logs     │          ▼                      │                │
       │          │   ┌────────────┐  query   ┌────▼────────────┐   │
  Promtail DaemonSet──►│ Prometheus │◄─────────│    Grafana      │   │
  (로그 수집)     │   │  :9090     │          │  NodePort:30300 │   │
                  │   └──────┬─────┘          └────▲────────────┘   │
  파드 로그 →      │          │ alerts               │ LogQL          │
  /var/log/pods  │   ┌──────▼──────┐               │                │
                  │   │AlertManager │         ┌────┴────┐           │
                  │   │   :9093     │         │  Loki   │           │
                  │   └──────┬──────┘         │ gateway │◄──Promtail│
                  │          │ Webhook         │  :80    │          │
                  │          ▼                └─────────┘          │
                  │   Gitea Webhook / 이메일 알림                     │
                  └──────────────────────────────────────────────────┘

  외부 접근:
    Grafana    → http://<노드IP>:30300
    Prometheus → http://<노드IP>:30090  (내부 감사용)
    AlertManager → http://<노드IP>:30093  (내부 감사용)
```

---

## 2. k3s Helm 설치 방법

### 2.1 사전 조건

설치 전 다음 조건을 모두 충족해야 합니다.

```bash
# 1. k3s 클러스터 동작 확인
kubectl cluster-info

# 2. Helm 설치 확인 (3.12 이상 권장)
helm version --short

# 3. 가용 메모리 확인 (최소 6GB 권장, 4GB 미만 시 OOM 위험)
free -h
awk '/MemAvailable/ {printf "가용 메모리: %dGB\n", $2/1024/1024}' /proc/meminfo

# 4. cert-manager 설치 여부 확인 (OTel Operator 의존성)
kubectl get crd certificates.cert-manager.io 2>/dev/null && echo "cert-manager 있음" || echo "없음 (스크립트가 자동 설치)"
```

| 항목 | 최소 요건 | 권장 |
|------|----------|------|
| k3s 버전 | v1.27+ | v1.29+ |
| Helm | 3.10+ | 3.12+ |
| 가용 메모리 | 4GB | 6GB |
| 가용 디스크 | 20GB | 40GB |
| CPU | 2코어 | 4코어 |

### 2.2 전체 스택 설치

```bash
# 프로젝트 루트에서 실행
cd /data/ai-saas

# 전체 설치 (7단계 자동 실행)
./scripts/setup-observability.sh install

# 설치 후 상태 확인
./scripts/setup-observability.sh verify

# 파드 실시간 확인
kubectl get pods -n monitoring -w
```

설치 순서는 다음과 같습니다.

```
[1/7] kube-prometheus-stack  → Prometheus + Grafana + AlertManager
[2/7] Loki                   → 로그 집계 엔진
[3/7] Promtail               → 파드 로그 수집 DaemonSet
[4/7] Tempo                  → 분산 추적
[5/7] OpenTelemetry Operator → 자동 계측 CRD
[6/7] PostgreSQL Exporter    → SQL 슬로우쿼리 메트릭
[7/7] Redis Exporter         → Redis 메트릭
```

### 2.3 DB Secret 생성 (설치 전 또는 후 실행)

PostgreSQL Exporter와 Redis Exporter는 접속 정보 Secret이 없으면 자동으로 건너뜁니다. 아래 명령으로 Secret을 먼저 생성한 후 재설치하십시오.

**PostgreSQL Secret 생성:**

```bash
# DATA_SOURCE_NAME 형식: postgresql://사용자:비밀번호@호스트:포트/DB명?sslmode=disable
kubectl create secret generic postgres-exporter-secret \
  --namespace monitoring \
  --from-literal=DATA_SOURCE_NAME="postgresql://monitor_user:CHANGE_ME@postgres-svc:5432/saasdb?sslmode=disable"
```

**Redis Secret 생성:**

```bash
kubectl create secret generic redis-exporter-secret \
  --namespace monitoring \
  --from-literal=REDIS_ADDR="redis://redis-svc:6379" \
  --from-literal=REDIS_PASSWORD="CHANGE_ME"
```

Secret 생성 후 Exporter만 단독 재설치:

```bash
# PostgreSQL Exporter 단독 설치
helm upgrade --install postgres-exporter prometheus/prometheus-postgres-exporter \
  --namespace monitoring \
  --values infra/monitoring/postgres-exporter/values.yaml \
  --timeout 5m --wait

# Redis Exporter 단독 설치
helm upgrade --install redis-exporter prometheus/prometheus-redis-exporter \
  --namespace monitoring \
  --values infra/monitoring/redis-exporter/values.yaml \
  --timeout 5m --wait
```

### 2.4 pg_stat_statements 활성화

PostgreSQL 슬로우쿼리 모니터링을 위해 `pg_stat_statements` 확장을 활성화해야 합니다.

```bash
# PostgreSQL 파드 접속
kubectl exec -it deploy/postgres -n <앱-네임스페이스> -- psql -U postgres

# 확장 활성화
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

# 활성화 확인
SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements';
\q
```

postgresql.conf에 다음 설정이 필요합니다 (재시작 필요).

```ini
# /etc/postgresql/postgresql.conf 또는 ConfigMap
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
pg_stat_statements.max = 10000
```

ConfigMap으로 관리하는 경우:

```bash
kubectl edit configmap postgres-config -n <앱-네임스페이스>
# shared_preload_libraries 항목 추가 후 파드 재시작
kubectl rollout restart deployment/postgres -n <앱-네임스페이스>
```

---

## 3. Grafana 대시보드 접속 및 탐색

### 3.1 초기 접속

```
URL   : http://<노드IP>:30300
       (로컬: http://localhost:30300)
ID    : admin
PW    : 설치 시 출력된 초기 비밀번호
       (또는 kubectl get secret grafana-admin-secret -n monitoring
              -o jsonpath='{.data.admin-password}' | base64 -d)
```

초기 비밀번호는 반드시 변경하십시오.

```bash
# Grafana 초기 비밀번호 확인
kubectl get secret grafana-admin-secret -n monitoring \
  -o jsonpath='{.data.admin-password}' | base64 -d && echo
```

### 3.2 기본 대시보드 목록

Grafana 좌측 메뉴 "Dashboards"에서 다음 대시보드를 확인할 수 있습니다.

| 대시보드 이름 | 폴더 | 주요 패널 |
|------------|------|---------|
| SQL 모니터링 (PostgreSQL + Redis) | Public SaaS | 슬로우쿼리 TOP 20, 캐시 히트율, 활성 연결수 |
| 서비스 트래픽 | Public SaaS | 요청 수, 레이턴시 p99, 에러율 |
| 로그 탐색기 | Public SaaS | LogQL 실시간 로그, 서비스별 에러 집계 |
| 클러스터 개요 | Public SaaS | 노드 CPU/메모리, Pod 재시작 현황 |
| GitOps 현황 | Public SaaS | Flux 동기화 상태, 배포 이력 |
| Kubernetes Nodes | Default | 노드 리소스 상세 |
| Kubernetes Pods | Default | 네임스페이스별 Pod 상태 |

대시보드를 찾을 수 없으면 ConfigMap이 누락된 것입니다.

```bash
# 대시보드 ConfigMap 재적용
kubectl apply -f infra/monitoring/dashboards/ -n monitoring

# Grafana 재시작 (ConfigMap 반영)
kubectl rollout restart deployment/kube-prometheus-stack-grafana -n monitoring
```

### 3.3 RBAC 설정 — CSAP D-08 준수

공공기관 CSAP D-08 요건에 따라 관리자와 일반 조회자 권한을 분리합니다.

**Grafana 서비스 계정 생성 (API 방식):**

```bash
# Grafana 관리자 API로 편집자(Editor) 계정 생성
curl -s -X POST http://admin:${GRAFANA_PW}@localhost:30300/api/admin/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "운영자",
    "email": "ops@agency.go.kr",
    "login": "ops-user",
    "password": "CHANGE_ME_STRONG",
    "OrgId": 1,
    "role": "Editor"
  }'

# 조회 전용(Viewer) 계정 생성 — 감사관용
curl -s -X POST http://admin:${GRAFANA_PW}@localhost:30300/api/admin/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "감사관",
    "email": "audit@agency.go.kr",
    "login": "auditor",
    "password": "CHANGE_ME_STRONG",
    "OrgId": 1,
    "role": "Viewer"
  }'
```

**Grafana 역할 정책 (CSAP D-08):**

| 역할 | 권한 | 대상 |
|------|------|------|
| Admin | 대시보드 생성·수정·삭제, 사용자 관리 | 운영 담당자 |
| Editor | 대시보드 수정, 알림 규칙 설정 | 개발팀 리드 |
| Viewer | 조회만 가능 | 일반 개발자, 감사관 |

---

## 4. 알림 설정 (AlertManager → Gitea Webhook)

### 4.1 AlertManager 설정 파일 위치

```bash
# AlertManager 현재 설정 확인
kubectl get secret alertmanager-kube-prometheus-stack-alertmanager \
  -n monitoring -o jsonpath='{.data.alertmanager\.yaml}' | base64 -d
```

### 4.2 Gitea Webhook 알림 설정

`infra/monitoring/alerting-rules.yaml`에서 receivers 섹션에 Gitea Webhook URL을 설정합니다.

```yaml
# AlertManager ConfigMap 예시
apiVersion: v1
kind: ConfigMap
metadata:
  name: alertmanager-config
  namespace: monitoring
data:
  alertmanager.yaml: |
    global:
      resolve_timeout: 5m

    route:
      group_by: ['alertname', 'namespace']
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 4h
      receiver: 'gitea-webhook'
      routes:
        - match:
            severity: critical
          receiver: 'gitea-webhook'
          repeat_interval: 1h

    receivers:
      - name: 'gitea-webhook'
        webhook_configs:
          - url: 'http://gitea.infra.svc:3000/api/v1/repos/<조직>/<저장소>/hooks/webhook'
            send_resolved: true
            http_config:
              bearer_token: '<GITEA_API_TOKEN>'
```

AlertManager 설정 반영:

```bash
# ConfigMap 적용
kubectl apply -f infra/monitoring/alerting-rules.yaml -n monitoring

# AlertManager 재시작
kubectl rollout restart deployment/kube-prometheus-stack-alertmanager -n monitoring

# 알림 테스트
curl -s -X POST http://localhost:30093/api/v2/alerts \
  -H "Content-Type: application/json" \
  -d '[{"labels":{"alertname":"TestAlert","severity":"info"}}]'
```

### 4.3 주요 알림 규칙

| 알림 이름 | 조건 | 심각도 | CSAP 연관 |
|----------|------|--------|----------|
| PodCrashLooping | 재시작 5회/10분 | critical | D-06 |
| HighMemoryUsage | 메모리 > 90% | warning | - |
| SlowQueryDetected | 쿼리 실행 > 5초 | warning | D-12 |
| RedisEviction | Eviction > 0 | warning | - |
| LokiIngestionLag | 수집 지연 > 60초 | critical | D-06 |
| CertificateExpiring | TLS 인증서 만료 7일 전 | critical | D-09 |

---

## 5. 마이크로서비스 자동 계측 활성화

OpenTelemetry Operator가 설치되면 파드에 annotation을 추가하는 것만으로 자동 계측이 활성화됩니다.

### 5.1 Pod annotation 방법

```bash
# 실행 중인 파드에 annotation 추가
kubectl annotate pod <파드명> -n <네임스페이스> \
  instrumentation.opentelemetry.io/inject-nodejs=true

# Deployment에 annotation 추가 (영구 적용 권장)
kubectl patch deployment <배포명> -n <네임스페이스> \
  --type='json' \
  -p='[{"op":"add","path":"/spec/template/metadata/annotations/instrumentation.opentelemetry.io~1inject-nodejs","value":"true"}]'
```

Deployment manifest에 직접 추가하는 방법:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: app
spec:
  template:
    metadata:
      annotations:
        # Node.js 서비스에 OTel 자동 계측 주입
        instrumentation.opentelemetry.io/inject-nodejs: "true"
```

### 5.2 런타임별 annotation 및 환경변수

**Node.js 서비스:**

```yaml
annotations:
  instrumentation.opentelemetry.io/inject-nodejs: "true"
env:
  - name: OTEL_SERVICE_NAME
    value: "api-server"
  - name: OTEL_RESOURCE_ATTRIBUTES
    value: "deployment.environment=production,service.version=1.0.0"
  - name: NODE_OPTIONS
    value: "--require @opentelemetry/auto-instrumentations-node/register"
```

**Python 서비스:**

```yaml
annotations:
  instrumentation.opentelemetry.io/inject-python: "true"
env:
  - name: OTEL_SERVICE_NAME
    value: "data-processor"
  - name: OTEL_PYTHON_LOG_CORRELATION
    value: "true"
  - name: PYTHONPATH
    value: "/otel-auto-instrumentation-python/opentelemetry/instrumentation/auto_instrumentation"
```

**Java 서비스:**

```yaml
annotations:
  instrumentation.opentelemetry.io/inject-java: "true"
env:
  - name: OTEL_SERVICE_NAME
    value: "legacy-service"
  - name: JAVA_TOOL_OPTIONS
    value: "-javaagent:/otel-auto-instrumentation-java/javaagent.jar"
  - name: OTEL_EXPORTER_OTLP_ENDPOINT
    value: "http://otel-collector.monitoring.svc:4317"
```

자동 계측 상태 확인:

```bash
# OTel Instrumentation CR 확인
kubectl get instrumentation -n monitoring

# 계측 주입 여부 확인 (파드 내 /otel-auto-instrumentation 마운트 확인)
kubectl describe pod <파드명> -n <네임스페이스> | grep -A5 "otel-auto-instrumentation"
```

---

## 6. 운영 명령 모음

### 6.1 상태 확인

```bash
# 전체 파드 상태 확인
kubectl get pods -n monitoring

# 파드 상세 (재시작 횟수, 이벤트 포함)
kubectl get pods -n monitoring -o wide

# 특정 컴포넌트 로그 확인
kubectl logs -n monitoring -l app.kubernetes.io/name=grafana --tail=100
kubectl logs -n monitoring -l app.kubernetes.io/name=loki --tail=100
kubectl logs -n monitoring -l app.kubernetes.io/name=tempo --tail=100

# 이벤트 확인 (오류 탐지)
kubectl get events -n monitoring --sort-by='.lastTimestamp' | tail -20

# Helm 릴리즈 목록 확인
helm list -n monitoring
```

### 6.2 재시작 및 롤백

```bash
# Grafana 재시작
kubectl rollout restart deployment/kube-prometheus-stack-grafana -n monitoring

# Loki 재시작
kubectl rollout restart statefulset/loki -n monitoring

# Prometheus 재시작
kubectl rollout restart statefulset/prometheus-kube-prometheus-stack-prometheus -n monitoring

# Helm 릴리즈 롤백 (버전 번호 확인 후)
helm history kube-prometheus-stack -n monitoring
helm rollback kube-prometheus-stack 1 -n monitoring
```

### 6.3 리소스 사용량 확인

```bash
# 네임스페이스 전체 리소스 사용량
kubectl top pods -n monitoring

# 노드 리소스 사용량
kubectl top nodes

# PVC 사용량 (Loki, Prometheus 영구 저장소)
kubectl get pvc -n monitoring
```

### 6.4 설치 스크립트 명령

```bash
# 전체 설치
./scripts/setup-observability.sh install

# 설치 검증
./scripts/setup-observability.sh verify

# 파드 상태 확인
./scripts/setup-observability.sh status

# 전체 제거 (주의: 데이터 삭제됨)
./scripts/setup-observability.sh uninstall
```

---

## 7. 문제 해결

### 7.1 Loki OOM (메모리 부족)

**증상**: Loki 파드가 `OOMKilled` 상태로 재시작 반복

```bash
# OOM 확인
kubectl describe pod -l app.kubernetes.io/name=loki -n monitoring | grep -A5 "OOMKilled"
```

**해결책:**

```bash
# Loki 메모리 제한 증가
helm upgrade loki grafana/loki \
  --namespace monitoring \
  --reuse-values \
  --set loki.resources.limits.memory=2Gi \
  --set loki.resources.requests.memory=512Mi

# 대안: 로그 보존 기간 단축 (기본 30일 → 7일)
helm upgrade loki grafana/loki \
  --namespace monitoring \
  --reuse-values \
  --set loki.limits_config.retention_period=168h
```

### 7.2 Tempo 연결 실패

**증상**: Grafana Explore에서 "connection refused" 또는 트레이스 데이터 없음

```bash
# Tempo 서비스 확인
kubectl get svc tempo -n monitoring

# OTLP 포트 접근 테스트 (클러스터 내부에서)
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -n monitoring -- \
  curl -s http://tempo.monitoring.svc.cluster.local:3100/ready
```

**해결책:**

```bash
# Tempo 파드 로그 확인
kubectl logs -l app.kubernetes.io/name=tempo -n monitoring --tail=50

# Tempo 재시작
kubectl rollout restart deployment/tempo -n monitoring

# OTel Collector → Tempo 연결 확인
kubectl logs -l app.kubernetes.io/name=opentelemetry-collector -n monitoring --tail=50 | grep -i "tempo\|error"
```

### 7.3 Grafana 대시보드가 나타나지 않음

```bash
# ConfigMap에 'grafana_datasource: "1"' 레이블 확인
kubectl get configmap -n monitoring -l grafana_datasource=1

# 대시보드 ConfigMap 레이블 확인
kubectl get configmap -n monitoring -l grafana_dashboard=1

# Grafana 파드 재시작
kubectl rollout restart deployment/kube-prometheus-stack-grafana -n monitoring

# Grafana 로그에서 ConfigMap 로드 확인
kubectl logs -l app.kubernetes.io/name=grafana -n monitoring | grep -i "dashboard\|datasource"
```

### 7.4 Prometheus 메트릭 수집 안 됨

```bash
# ServiceMonitor 목록 확인
kubectl get servicemonitor -n monitoring

# Prometheus 타겟 상태 확인
kubectl port-forward svc/kube-prometheus-stack-prometheus 9090 -n monitoring &
curl -s http://localhost:9090/api/v1/targets | python3 -m json.tool | grep -E '"health"|"job"'

# 특정 타겟 스크랩 설정 확인
kubectl get prometheusrule -n monitoring
```

### 7.5 Promtail 로그 수집 안 됨

```bash
# Promtail DaemonSet 상태 확인
kubectl get daemonset promtail -n monitoring

# 특정 노드의 Promtail 로그 확인
kubectl logs daemonset/promtail -n monitoring --tail=30

# Loki 수집 상태 확인
kubectl port-forward svc/loki-gateway 3100:80 -n monitoring &
curl -s http://localhost:3100/loki/api/v1/labels
```

---

## 8. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 (MTU-N24 기반) | Implementer Agent |
