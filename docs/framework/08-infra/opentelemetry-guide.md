# OpenTelemetry 관측 가능성 구현 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | INFRA-OTEL-001 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| 대상 독자 | DevOps 엔지니어, 보안 담당자, CSAP 심사 대응 팀 |
| FR 매핑 | NFR-4 (통합 모니터링), FR-5.4 (네트워크 보안) |
| MTU 매핑 | MTU-I4 |
| 관련 문서 | [NetworkPolicy 가이드](network-policy-guide.md), [CSAP D06 침해사고](../02-csap/standard-grade/implementation-guide/D06-incident.md) |

<!-- Design Ref: MTU-I4 Plan -- OpenTelemetry Collector -->
<!-- Plan SC: OTel 메트릭 수집, CSAP-D06 침해사고 탐지 연동 -->

---

## 1. 개요

OpenTelemetry(OTel) Collector를 k3s 클러스터에 DaemonSet으로 배포하여, 메트릭·로그·트레이스를 통합 수집합니다. CSAP-D06 침해사고 탐지 요건과 연동하여 보안 이벤트를 실시간 감사합니다.

### OTel 아키텍처 패턴

```
[애플리케이션 Pod]
     │  OTLP (gRPC :4317 / HTTP :4318)
     ▼
[OTel Collector DaemonSet]          ◀── 각 노드에 1개
     │
     ├── 메트릭 ──▶ Prometheus (:8889)
     ├── 로그   ──▶ Loki (monitoring NS)
     ├── 트레이스 ──▶ Jaeger (monitoring NS)
     └── 보안 이벤트 ──▶ audit.jsonl (CSAP-D06)
```

---

## 2. 전제 조건

| 항목 | 요구사항 | 확인 방법 |
|------|---------|---------|
| k3s 클러스터 | v1.28+ (MTU-I1) | `kubectl get nodes` |
| NetworkPolicy | 적용 완료 (MTU-I4 netpol) | `kubectl get netpol -A` |
| Helm | v3.12+ | `helm version` |
| 스토리지 | audit.jsonl 보존용 PV | `kubectl get pv` |

---

## 3. OTel Collector 설치

### 3.1 Helm 설치

```bash
# OTel Helm 차트 추가
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo update

# DaemonSet 모드로 설치
helm install otel-collector open-telemetry/opentelemetry-collector \
  --namespace monitoring \
  --values otel-collector-values.yaml \
  --wait
```

### 3.2 otel-collector-values.yaml

```yaml
mode: daemonset

config:
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: 0.0.0.0:4317
        http:
          endpoint: 0.0.0.0:4318

    prometheus:
      config:
        scrape_configs:
          - job_name: k3s-nodes
            kubernetes_sd_configs:
              - role: node
            relabel_configs:
              - source_labels: [__address__]
                regex: '(.+):(\d+)'
                target_label: __address__
                replacement: '${1}:10250'

    k8sobjects:
      objects:
        - name: events
          mode: watch
          namespaces: [grade-c, grade-s, grade-o, production]

    filelog:
      include:
        - /var/log/pods/grade-*/**/*.log
      operators:
        - type: regex_parser
          regex: '^(?P<time>[^\s]+)\s(?P<stream>\w+)\s(?P<log>.*)$'
          timestamp:
            parse_from: attributes.time
            layout: '%Y-%m-%dT%H:%M:%S.%LZ'

  processors:
    batch:
      timeout: 5s
      send_batch_size: 1000

    filter/security:
      logs:
        exclude:
          match_type: regexp
          bodies:
            - '.*\b\d{6}-\d{7}\b.*'         # 주민등록번호 패턴
            - '.*\b\d{4}-\d{4}-\d{4}-\d{4}\b.*'  # 카드번호 패턴
            - '.*password\s*[:=]\s*\S+.*'    # 비밀번호 패턴

    resourcedetection:
      detectors: [env, system]
      system:
        hostname_sources: [os]

    k8sattributes:
      extract:
        metadata:
          - k8s.namespace.name
          - k8s.pod.name
          - k8s.deployment.name
        labels:
          - tag_name: n2sf_grade
            key: n2sf.grade
            from: namespace

    transform/security_events:
      log_statements:
        - context: log
          conditions:
            - 'IsMatch(body, "(?i)(unauthorized|forbidden|denied|blocked|violation)")'
          statements:
            - set(severity_text, "WARN")
            - set(attributes["security.event"], "true")

  exporters:
    prometheus:
      endpoint: 0.0.0.0:8889
      resource_to_telemetry_conversion:
        enabled: true

    loki:
      endpoint: http://loki.monitoring.svc.cluster.local:3100/loki/api/v1/push
      labels:
        attributes:
          k8s.namespace.name: "namespace"
          n2sf_grade: "grade"
          security.event: "security"

    otlp/jaeger:
      endpoint: jaeger.monitoring.svc.cluster.local:4317
      tls:
        insecure: true                     # 클러스터 내부 통신

    file/audit:
      path: /var/log/audit/audit.jsonl
      rotation:
        max_megabytes: 100
        max_days: 365                      # CSAP-D06 최소 1년 보존
        max_backups: 10

  service:
    pipelines:
      metrics:
        receivers: [otlp, prometheus]
        processors: [batch, resourcedetection, k8sattributes]
        exporters: [prometheus]

      logs:
        receivers: [otlp, k8sobjects, filelog]
        processors: [batch, filter/security, resourcedetection, k8sattributes, transform/security_events]
        exporters: [loki, file/audit]

      traces:
        receivers: [otlp]
        processors: [batch, resourcedetection, k8sattributes]
        exporters: [otlp/jaeger]

# DaemonSet 리소스 제한
resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi

# audit.jsonl 저장용 볼륨
extraVolumes:
  - name: audit-log
    hostPath:
      path: /var/log/audit
      type: DirectoryOrCreate

extraVolumeMounts:
  - name: audit-log
    mountPath: /var/log/audit
```

### 3.3 폐쇄망 설치

```bash
# 외부망에서 OTel Collector 이미지 다운로드
docker pull otel/opentelemetry-collector-contrib:0.96.0
docker save otel/opentelemetry-collector-contrib:0.96.0 -o otel-collector.tar

# 내부망 k3s에 이미지 import
sudo k3s ctr images import otel-collector.tar

# Helm 차트 오프라인 설치
helm pull open-telemetry/opentelemetry-collector --version 0.82.0 --untar
helm install otel-collector ./opentelemetry-collector \
  --namespace monitoring \
  --values otel-collector-values.yaml
```

---

## 4. CSAP-D06 침해사고 탐지 연동

### 4.1 탐지 규칙

| 규칙 ID | 탐지 조건 | 트리거 | 대응 액션 |
|--------|---------|--------|---------|
| D06-01 | C등급 네임스페이스 외부 접속 시도 | NetworkPolicy deny 이벤트 | audit.jsonl 기록 + 즉시 알림 |
| D06-02 | S/C등급 → 외부 IP 연결 시도 | Egress deny 이벤트 | 즉시 차단 + 보안 담당자 알림 |
| D06-03 | Pod 내 권한 상승 시도 | `sudo`, `su`, `nsenter` 실행 | OTel 이벤트 수집 + 즉시 알림 |
| D06-04 | 미서명 이미지 실행 시도 | Harbor/Kyverno 정책 거부 | 배포 차단 + audit.jsonl 기록 |
| D06-05 | 비정상 로그인 시도 (5회 실패) | 인증 실패 로그 집계 | 계정 잠금 + audit.jsonl 기록 |

### 4.2 보안 이벤트 audit.jsonl 스키마

```json
{
  "timestamp": "2026-04-05T12:00:00.000Z",
  "severity": "WARN",
  "ruleId": "D06-01",
  "action": "NETWORK_DENY",
  "source": {
    "namespace": "grade-c",
    "pod": "app-xyz-123",
    "ip": "10.42.0.15"
  },
  "destination": {
    "ip": "8.8.8.8",
    "port": 443
  },
  "n2sfGrade": "C",
  "description": "C등급 네임스페이스에서 외부 IP 접속 시도 차단",
  "csapControl": "D06-01",
  "metadata": {
    "collector": "otel-collector-node01",
    "pipeline": "logs"
  }
}
```

### 4.3 알림 구성

```yaml
# Prometheus AlertManager 규칙 (보안 이벤트)
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: security-alerts
  namespace: monitoring
spec:
  groups:
    - name: n2sf-security
      rules:
        - alert: GradeCExternalAccess
          expr: |
            count_over_time({namespace="grade-c", security="true"}[5m]) > 0
          for: 0m
          labels:
            severity: critical
            csap_control: D06-01
          annotations:
            summary: "C등급 네임스페이스에서 외부 접속 시도 탐지"
            description: "N2SF N03 격리 위반 가능성"

        - alert: UnauthorizedLoginAttempts
          expr: |
            count_over_time({security="true"} |= "authentication failed" [5m]) > 5
          for: 1m
          labels:
            severity: warning
            csap_control: D06-05
          annotations:
            summary: "비정상 로그인 시도 5회 초과"
```

---

## 5. 모니터링 스택 구성

### 5.1 Prometheus (메트릭)

```bash
# Prometheus 설치 (Helm)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set prometheus.prometheusSpec.serviceMonitorSelector.matchLabels.release=prometheus
```

### 5.2 Loki (로그)

```bash
# Loki 설치 (단일 바이너리 모드 — k3s 경량 환경)
helm repo add grafana https://grafana.github.io/helm-charts
helm install loki grafana/loki \
  --namespace monitoring \
  --set loki.commonConfig.replication_factor=1 \
  --set singleBinary.replicas=1
```

### 5.3 Jaeger (트레이스)

```bash
# Jaeger 설치 (all-in-one 모드 — 개발/소규모)
helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
helm install jaeger jaegertracing/jaeger \
  --namespace monitoring \
  --set allInOne.enabled=true \
  --set collector.enabled=false \
  --set query.enabled=false
```

---

## 6. 애플리케이션 계측 (Instrumentation)

### 6.1 Node.js/TypeScript 애플리케이션

```typescript
// src/instrumentation.ts
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'grpc://otel-collector.monitoring.svc.cluster.local:4317',
  }),
  metricReader: new OTLPMetricExporter({
    url: 'grpc://otel-collector.monitoring.svc.cluster.local:4317',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
  serviceName: 'saas-app',
  serviceVersion: '1.0.0',
})

sdk.start()
```

### 6.2 보안 이벤트 직접 기록

```typescript
// src/lib/audit.ts
import { trace, SpanStatusCode } from '@opentelemetry/api'

const tracer = trace.getTracer('security-audit')

export async function auditLog(event: AuditEvent): Promise<void> {
  const span = tracer.startSpan('audit.log', {
    attributes: {
      'audit.action': event.action,
      'audit.actor': event.actor,
      'audit.target': event.target,
      'audit.n2sf_grade': event.grade,
      'security.event': 'true',
    },
  })

  // OTel Collector → audit.jsonl 자동 기록
  span.setStatus({ code: SpanStatusCode.OK })
  span.end()
}
```

---

## 7. 운영 명령어 레퍼런스

```bash
# OTel Collector 상태 확인
kubectl -n monitoring get pods -l app.kubernetes.io/name=opentelemetry-collector

# OTel 메트릭 엔드포인트 확인
curl http://otel-collector.monitoring.svc.cluster.local:8889/metrics

# audit.jsonl 최근 이벤트 확인
kubectl -n monitoring exec -it $(kubectl -n monitoring get pod -l app.kubernetes.io/name=opentelemetry-collector -o name | head -1) \
  -- tail -20 /var/log/audit/audit.jsonl

# Prometheus 타겟 상태
kubectl -n monitoring port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090
# 브라우저: http://localhost:9090/targets

# Loki 로그 조회
kubectl -n monitoring port-forward svc/loki 3100:3100
curl -G http://localhost:3100/loki/api/v1/query_range \
  --data-urlencode 'query={namespace="grade-c", security="true"}'
```

---

## 8. NetworkPolicy (모니터링 네임스페이스)

```yaml
# network-policies/monitoring-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: monitoring-ingress
  namespace: monitoring
spec:
  podSelector: {}
  policyTypes:
    - Ingress
  ingress:
    # 모든 네임스페이스에서 OTel 포트 접근 허용
    - ports:
        - protocol: TCP
          port: 4317                       # OTel gRPC
        - protocol: TCP
          port: 4318                       # OTel HTTP
    # Prometheus scrape 허용
    - ports:
        - protocol: TCP
          port: 8889                       # Prometheus metrics
```

---

## 9. CSAP·N2SF 준수 매핑

| 규제 항목 | 요건 | 구현 방법 | 검증 방법 |
|---------|------|---------|---------|
| CSAP-D06-01 | 침해사고 탐지 | OTel 보안 이벤트 수집 + 알림 | 알림 동작 확인 |
| CSAP-D06-02 | 감사 로그 보존 | audit.jsonl 365일 보존 | 파일 크기/일자 확인 |
| CSAP-D06-03 | 로그 무결성 | append-only 파일 + 해시 검증 | 해시 불일치 탐지 확인 |
| N2SF-N03 | 격리 영역 감사 | NetworkPolicy deny 이벤트 수집 | audit.jsonl deny 이벤트 확인 |
| NFR-4 | 통합 모니터링 | OTel → Prometheus/Loki/Jaeger | 대시보드 확인 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — OTel Collector + CSAP-D06 탐지 + 모니터링 스택 | Claude Code |
