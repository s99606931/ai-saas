# MTU-N24: 마이크로서비스 통합 관측가능성(Observability) 플랫폼 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: Implementer Agent
> **Plan 참조**: `docs/01-plan/mtus/MTU-N24-observability-stack.plan.md`
> **복잡도**: HIGH | **상태**: Draft
> **CSAP 근거**: D-06(침해사고관리), D-08(접근통제), D-09(암호화), D-12(개발보안)

---

## 1. Executive Summary (4관점)

| 관점 | 설계 결정 사항 |
|------|--------------|
| 비즈니스 | LGTM 스택(Loki+Grafana+Tempo+Prometheus) + OpenTelemetry Operator를 WSL2 k3s `monitoring` 네임스페이스에 통합 배포. 장애 MTTR 80% 단축 목표 달성을 위한 로그·트레이스·메트릭 단일 플랫폼 구성 |
| 기술 | Helm Chart 단일 명령 배포 + GitOps 연동. OTel Operator를 통한 Zero-code 자동계측. PII 마스킹 파이프라인(Loki Pipeline Stages). Prometheus Remote Write 없이 로컬 저장 |
| 보안 | CSAP D-06: 로그 30일 append-only 보존. D-08: Grafana RBAC(admin/editor/viewer 3계층). D-09: 내부 서비스간 mTLS. D-12: LogQL 파이프라인 PII 자동 마스킹(이메일·전화번호·주민번호) |
| 운영 | `scripts/setup-observability.sh` 단일 스크립트로 전체 스택 설치. Grafana 대시보드 3종 사전 구성(SQL, 트래픽, 로그탐색기). AlertManager → Gitea Webhook 알림 자동화 |

---

## 2. Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | MTU-N21에서 Prometheus/Grafana 기본 스택 설치 완료. 그러나 로그 집계(Loki), 분산 추적(Tempo), SQL 쿼리 성능 모니터링, Redis 모니터링이 부재하여 마이크로서비스 장애 진단 시 수동 kubectl logs 의존 |
| WHO | 개발팀(로그 조회·트레이스 분석), DevOps 엔지니어(인프라 대시보드), DBA(SQL 슬로우쿼리 분석), 보안팀(PII 노출 감지·이상 탐지) |
| RISK | (R1) Loki 고메모리: WSL2 32GB 제한 환경에서 BoltDB-shipper 사용 시 메모리 급증 → SingleStore 모드 + 청크 캐시 512MB 제한으로 완화. (R2) OTel 계측 오버헤드 5-10%: 샘플링 10%로 제한. (R3) pg_stat_statements 미활성화: 배포 전 PostgreSQL 설정 확인 필수 |
| SUCCESS | (S1) Grafana에서 마이크로서비스 로그 LogQL 조회 가능. (S2) Tempo TraceQL로 서비스간 요청 추적 가능. (S3) SQL 슬로우쿼리 TOP 20 대시보드 정상 표시. (S4) Redis 메모리·히트율 대시보드 정상 표시. (S5) AlertManager 알림 Gitea Webhook 수신 확인 |
| SCOPE | WSL2 k3s 환경 전용. 외부 클라우드 연동 제외. `monitoring` 네임스페이스 내 완결. N2SF O등급 데이터만 처리(C/S등급 AI API 전송 금지) |

---

## 3. 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    WSL2 k3s — monitoring 네임스페이스                    │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     데이터 수집 계층                              │   │
│  │                                                                  │   │
│  │  [saas-platform 네임스페이스]                                    │   │
│  │   마이크로서비스 Pod                                             │   │
│  │    │ stdout/stderr 로그              │ HTTP 요청 계측             │   │
│  │    ▼                                ▼                           │   │
│  │  Promtail DaemonSet          OTel Operator                       │   │
│  │  (로그 수집·PII마스킹)        InstrumentationCR                   │   │
│  │    │                          (Node.js/Python 자동계측)           │   │
│  │    │                                │                           │   │
│  │  PostgreSQL Exporter          OTel Collector                     │   │
│  │  Redis Exporter                (Traces + Metrics)               │   │
│  │  kube-state-metrics                 │                           │   │
│  │  node-exporter                      │                           │   │
│  └──────────┬──────────────────────────┼──────────────────────────┘   │
│             │                          │                               │
│  ┌──────────▼──────────────────────────▼──────────────────────────┐   │
│  │                     저장·처리 계층                               │   │
│  │                                                                  │   │
│  │  Loki 3.x                    Tempo 2.x          Prometheus 3.x  │   │
│  │  (로그 저장)                  (트레이스 저장)     (메트릭 저장)   │   │
│  │  PVC: 20GB                   PVC: 10GB           PVC: 20GB      │   │
│  │  보존: 30일                   보존: 7일            보존: 30일     │   │
│  └──────────┬──────────────────────────┬────────────┬─────────────┘   │
│             │                          │            │                  │
│  ┌──────────▼──────────────────────────▼────────────▼─────────────┐   │
│  │                    시각화·알림 계층                              │   │
│  │                                                                  │   │
│  │         Grafana 11.x (NodePort: 32300)                          │   │
│  │          ├── 대시보드: SQL 모니터링                              │   │
│  │          ├── 대시보드: 서비스 트래픽                             │   │
│  │          ├── 대시보드: 로그 탐색기                               │   │
│  │          └── Explore: LogQL / TraceQL / PromQL                  │   │
│  │                                                                  │   │
│  │         AlertManager 0.27                                        │   │
│  │          └── Gitea Webhook (http://localhost:3001/hooks/...)     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.1 데이터 흐름 요약

```
[로그 파이프라인]
마이크로서비스 stdout
  → Promtail DaemonSet (PII 마스킹 파이프라인 적용)
    → Loki 3.x HTTP Push (http://loki:3100/loki/api/v1/push)
      → Grafana LogQL 탐색

[트레이스 파이프라인]
마이크로서비스 (OTel SDK 자동주입)
  → OTel Collector (OTLP gRPC :4317)
    → Tempo 2.x (http://tempo:4317)
      → Grafana TraceQL 탐색

[메트릭 파이프라인]
PostgreSQL → postgres-exporter → Prometheus Scrape
Redis      → redis-exporter    → Prometheus Scrape
k3s Pods   → kube-state-metrics → Prometheus Scrape
노드       → node-exporter     → Prometheus Scrape
  → AlertManager (임계값 초과 시)
    → Gitea Webhook 알림
```

---

## 4. 컴포넌트 상세 설계

### 4.1 Loki 3.x — 로그 집계 파이프라인 (FR-N24.1)

#### 4.1.1 배포 구성

```yaml
# Design Ref: §4.1 — 단일 바이너리 모드 (WSL2 리소스 절약)
# Plan SC: FR-N24.1
배포 모드: SingleBinary (all-in-one)
이유: WSL2 k3s 환경 리소스 제약. Distributed 모드는 4GB+ 필요.
스토리지: PVC (BoltDB-shipper + 파일시스템 청크)
인증: 비활성화 (내부 클러스터 전용)
```

#### 4.1.2 Helm Values 핵심 설계

```yaml
# infra/monitoring/loki/values.yaml 설계
loki:
  auth_enabled: false
  commonConfig:
    replication_factor: 1
  storage:
    type: filesystem
  limits_config:
    retention_period: 720h   # 30일 (CSAP D-06: 최소 1년 → 운영환경 조정 필요)
    ingestion_rate_mb: 16
    ingestion_burst_size_mb: 32
    max_query_series: 5000
  chunk_store_config:
    chunk_cache_config:
      embedded_cache:
        enabled: true
        max_size_mb: 512     # WSL2 메모리 절약

persistence:
  enabled: true
  size: 20Gi
  storageClassName: local-path

resources:
  limits:
    memory: 1Gi              # NFR-N24.4: 전체 스택 4GB 이내
  requests:
    memory: 512Mi
```

#### 4.1.3 Promtail PII 마스킹 파이프라인 (CSAP D-12)

```yaml
# Design Ref: §4.1.3 — N2SF O등급 데이터 처리 전 PII 제거
# Plan SC: FR-N24.1 (로그 보존: PII 자동 마스킹 필터)
config:
  snippets:
    pipelineStages:
      - cri: {}              # k3s CRI-O 로그 파싱

      # 개인정보 마스킹 (CSAP D-12, N2SF 요건)
      - replace:
          expression: '(\d{3}-\d{4}-\d{4})'          # 전화번호
          replace: '[PHONE-MASKED]'
      - replace:
          expression: '([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})'
          replace: '[EMAIL-MASKED]'
      - replace:
          expression: '(\d{6}-[1-4]\d{6})'            # 주민등록번호
          replace: '[SSN-MASKED]'
      - replace:
          expression: '("password"\s*:\s*")[^"]*(")'   # 비밀번호 필드
          replace: '${1}[PWD-MASKED]${2}'
      - replace:
          expression: '("token"\s*:\s*")[^"]*(")'      # 토큰 필드
          replace: '${1}[TOKEN-MASKED]${2}'

      # 서비스명·네임스페이스 레이블 추가
      - labels:
          app:
          namespace:
          pod:
```

#### 4.1.4 LogQL 예제 쿼리

```logql
-- 서비스별 에러 로그 조회 (최근 1시간)
{namespace="saas-platform", app="api-gateway"} |= "ERROR" | json
  | line_format "{{.timestamp}} [{{.level}}] {{.message}}"

-- 슬로우 쿼리 로그 필터링 (500ms 초과)
{namespace="saas-platform"} |= "slow query"
  | regexp "duration=(?P<duration>[0-9.]+)ms"
  | duration > 500ms

-- PII 마스킹 검증 (마스킹 태그 포함 여부 확인)
{namespace="saas-platform"} |= "[PHONE-MASKED]" or "[EMAIL-MASKED]"
  | count_over_time[5m]

-- API 에러율 집계
sum(rate({namespace="saas-platform"} |= "HTTP 5" [5m])) by (app)
  /
sum(rate({namespace="saas-platform"} [5m])) by (app)
```

---

### 4.2 Tempo 2.x — 분산 추적 (FR-N24.2)

#### 4.2.1 배포 구성

```yaml
# Design Ref: §4.2 — monolithic 모드 (WSL2 단일 노드)
# Plan SC: FR-N24.2
배포 모드: monolithic
수신 프로토콜: OTLP gRPC (4317), OTLP HTTP (4318), Jaeger Thrift (14268)
샘플링: 없음 (OTel Collector에서 샘플링 처리)
저장소: PVC 로컬 파일시스템
보존: 7일 (NFR-N24.5)
```

#### 4.2.2 Helm Values 핵심 설계

```yaml
# infra/monitoring/tempo/values.yaml 설계
tempo:
  storage:
    trace:
      backend: local
      local:
        path: /var/tempo/traces
  retention: 168h              # 7일

  server:
    http_listen_port: 3200

persistence:
  enabled: true
  size: 10Gi
  storageClassName: local-path

resources:
  limits:
    memory: 512Mi
  requests:
    memory: 256Mi

# Grafana 데이터소스 연동
serviceMonitor:
  enabled: true
```

#### 4.2.3 OTel Collector 설계

```yaml
# infra/monitoring/otel-collector.yaml
apiVersion: opentelemetry.io/v1alpha1
kind: OpenTelemetryCollector
metadata:
  name: otel-collector
  namespace: monitoring
spec:
  mode: Deployment
  config: |
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318

    processors:
      # 샘플링 전략: Head-based 10% + Tail-based(에러/슬로우) 100%
      # Plan SC: FR-N24.2
      probabilistic_sampler:
        sampling_percentage: 10

      tail_sampling:
        decision_wait: 10s
        policies:
          - name: error-policy
            type: status_code
            status_code: { status_codes: [ERROR] }
          - name: slow-policy
            type: latency
            latency: { threshold_ms: 500 }

      memory_limiter:
        check_interval: 1s
        limit_mib: 400
        spike_limit_mib: 100

      batch: {}

    exporters:
      otlp:
        endpoint: tempo:4317
        tls:
          insecure: true     # 내부 클러스터 통신

      prometheus:
        endpoint: 0.0.0.0:8889

    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [memory_limiter, tail_sampling, batch]
          exporters: [otlp]
        metrics:
          receivers: [otlp]
          processors: [memory_limiter, batch]
          exporters: [prometheus]
```

#### 4.2.4 TraceQL 예제 쿼리

```traceql
-- api-gateway → user-service 경로의 500ms 초과 트레이스
{ .service.name = "api-gateway" && duration > 500ms }

-- 에러 트레이스 전체 조회
{ status = error }

-- 특정 사용자 요청 추적 (O등급 데이터만)
{ .user.id = "U12345" && .http.method = "POST" }

-- 서비스간 의존성 분석
{ .span.kind = client } | select(.service.name, .http.url, duration)

-- 슬로우 데이터베이스 쿼리 추적
{ .db.system = "postgresql" && duration > 1s }
  | select(.db.statement, .service.name, duration)
```

---

### 4.3 OpenTelemetry Operator — 자동계측 (FR-N24.2)

#### 4.3.1 Operator 배포 설계

```yaml
# Design Ref: §4.3 — cert-manager 없이 경량 배포
# Plan SC: FR-N24.2 (k8s 자동계측 Zero-code instrumentation)
admissionWebhooks:
  certManager:
    enabled: false           # cert-manager 미설치 환경
  autoGenerateCert:
    enabled: true            # 자체 서명 인증서 자동 생성

manager:
  resources:
    limits:
      memory: 256Mi
```

#### 4.3.2 InstrumentationCR 설계 (Node.js / Python)

```yaml
# infra/monitoring/otel-operator/instrumentation.yaml
apiVersion: opentelemetry.io/v1alpha1
kind: Instrumentation
metadata:
  name: saas-instrumentation
  namespace: saas-platform
spec:
  # Design Ref: §4.3.2 — OTel Collector 경유 (직접 외부 API 금지)
  exporter:
    endpoint: http://otel-collector.monitoring:4317

  propagators:
    - tracecontext
    - baggage
    - b3

  sampler:
    type: ParentBasedTraceIdRatio
    argument: "0.1"          # 10% 샘플링 (NFR-N24.4 리소스 절약)

  # Node.js 자동계측 (Express, Fastify, pg, redis 자동 감지)
  nodejs:
    env:
      - name: OTEL_NODE_ENABLED_INSTRUMENTATIONS
        value: "http,express,pg,redis,dns"
      - name: OTEL_EXPORTER_OTLP_ENDPOINT
        value: http://otel-collector.monitoring:4317
      - name: NODE_OPTIONS
        value: "--require @opentelemetry/auto-instrumentations-node/register"

  # Python 자동계측 (Django, FastAPI, SQLAlchemy 자동 감지)
  python:
    env:
      - name: OTEL_PYTHON_LOGGING_AUTO_INSTRUMENTATION_ENABLED
        value: "true"
      - name: OTEL_EXPORTER_OTLP_ENDPOINT
        value: http://otel-collector.monitoring:4317
```

#### 4.3.3 Pod 자동계측 활성화 방법

```yaml
# 대상 Deployment에 어노테이션 추가 (코드 변경 불필요)
metadata:
  annotations:
    instrumentation.opentelemetry.io/inject-nodejs: "true"
    # 또는 Python의 경우:
    # instrumentation.opentelemetry.io/inject-python: "true"
```

---

### 4.4 PostgreSQL Exporter — SQL 쿼리 모니터링 (FR-N24.3)

#### 4.4.1 배포 설계

```yaml
# Design Ref: §4.4 — pg_stat_statements 기반 쿼리 성능 분석
# Plan SC: FR-N24.3
버전: prometheus-postgres-exporter 0.17
연결: postgresql://postgres-exporter:${PG_PASSWORD}@saas-postgres.saas-platform:5432/saas
사전 조건: pg_stat_statements extension 활성화 필수
```

#### 4.4.2 pg_stat_statements 활성화 확인

```sql
-- PostgreSQL 설정 확인 (배포 전 필수 검증)
SELECT name, setting FROM pg_settings
WHERE name IN ('shared_preload_libraries', 'pg_stat_statements.max');

-- pg_stat_statements 확장 활성화
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 활성화 확인
SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements';
```

#### 4.4.3 슬로우쿼리 감지 커스텀 쿼리 설계

```yaml
# infra/monitoring/postgres-exporter/values.yaml 내 커스텀 쿼리
config:
  userQueries: |
    pg_slow_queries:
      # Design Ref: §4.4.3 — 5초 초과 쿼리 감지 (FR-N24.6 알림 연동)
      # CSAP D-12: 쿼리 텍스트 민감정보 마스킹 처리 (query 컬럼 미노출)
      query: |
        SELECT
          calls,
          total_exec_time / calls AS avg_exec_time_ms,
          max_exec_time AS max_exec_time_ms,
          rows / calls AS avg_rows,
          shared_blks_hit / (shared_blks_hit + shared_blks_read + 0.001) AS cache_hit_ratio,
          -- CSAP D-12: queryid만 노출, 쿼리 원문 마스킹
          queryid::text AS query_fingerprint
        FROM pg_stat_statements
        WHERE calls > 10
          AND mean_exec_time > 1000
        ORDER BY mean_exec_time DESC
        LIMIT 20
      metrics:
        - calls:
            usage: GAUGE
            description: "쿼리 실행 횟수"
        - avg_exec_time_ms:
            usage: GAUGE
            description: "평균 실행 시간 (ms)"
        - max_exec_time_ms:
            usage: GAUGE
            description: "최대 실행 시간 (ms)"
        - cache_hit_ratio:
            usage: GAUGE
            description: "캐시 히트율"
        - query_fingerprint:
            usage: LABEL
            description: "쿼리 지문 ID (원문 미포함)"

    pg_connections:
      query: |
        SELECT
          state,
          count(*) AS count,
          max(EXTRACT(EPOCH FROM (now() - state_change))) AS max_duration_seconds
        FROM pg_stat_activity
        WHERE state IS NOT NULL
        GROUP BY state
      metrics:
        - state:
            usage: LABEL
        - count:
            usage: GAUGE
            description: "연결 상태별 수"
        - max_duration_seconds:
            usage: GAUGE
            description: "상태 최대 지속 시간(초)"

    pg_index_usage:
      # 인덱스 미사용 쿼리 감지 (FR-N24.3)
      query: |
        SELECT
          schemaname,
          tablename,
          seq_scan,
          seq_tup_read,
          idx_scan,
          CASE WHEN seq_scan + idx_scan > 0
            THEN idx_scan::float / (seq_scan + idx_scan)
            ELSE 1.0
          END AS index_usage_ratio
        FROM pg_stat_user_tables
        WHERE seq_scan > 100
        ORDER BY seq_scan DESC
        LIMIT 20
      metrics:
        - schemaname:
            usage: LABEL
        - tablename:
            usage: LABEL
        - seq_scan:
            usage: GAUGE
        - idx_scan:
            usage: GAUGE
        - index_usage_ratio:
            usage: GAUGE
            description: "인덱스 사용 비율 (낮을수록 Full Scan 다수)"
```

#### 4.4.4 AlertManager 연동 알림 규칙

```yaml
# alerting-rules.yaml 추가 섹션
- name: saas-sql-alerts
  rules:
    - alert: SlowQueryDetected
      # Plan SC: FR-N24.6
      expr: pg_slow_queries_max_exec_time_ms > 5000
      for: 0m
      labels:
        severity: warning
        team: dba
      annotations:
        summary: "PostgreSQL 슬로우 쿼리 감지"
        description: "쿼리 {{ $labels.query_fingerprint }} 최대 실행 시간 {{ $value | printf \"%.0f\" }}ms"
        csap_ref: "D-12-10"

    - alert: LowIndexUsage
      expr: pg_index_usage_index_usage_ratio < 0.3
      for: 10m
      labels:
        severity: info
        team: dba
      annotations:
        summary: "테이블 {{ $labels.tablename }} 인덱스 미사용 쿼리 다수"
        description: "인덱스 사용률 {{ $value | printf \"%.1f\" }}% — Full Scan 쿼리 최적화 검토 필요"
```

---

### 4.5 Redis Exporter — Redis 모니터링 (FR-N24.4)

#### 4.5.1 배포 설계

```yaml
# Design Ref: §4.5 — redis-exporter 1.66
# Plan SC: FR-N24.4
버전: prometheus-redis-exporter 1.66
연결: redis://saas-redis.saas-platform:6379
인증: REDIS_PASSWORD 환경 변수 (Secret 참조, 하드코딩 금지 - CSAP D-09)
```

#### 4.5.2 수집 메트릭 목록

| 메트릭 | 설명 | 알림 임계값 |
|--------|------|------------|
| `redis_memory_used_bytes` | 현재 메모리 사용량 | - |
| `redis_memory_max_bytes` | 최대 메모리 설정값 | - |
| `redis_memory_used_bytes / redis_memory_max_bytes` | 메모리 사용률 | >90% 알림 |
| `redis_keyspace_hits_total` | 키 조회 히트 수 | - |
| `redis_keyspace_misses_total` | 키 조회 미스 수 | - |
| `redis_keyspace_hits_total / (hits + misses)` | 히트율 | <80% 경보 |
| `redis_connected_clients` | 현재 연결 수 | >100 경보 |
| `redis_evicted_keys_total` | Eviction 발생 수 | >0 알림 |
| `redis_expired_keys_total` | 만료된 키 수 | - |
| `redis_db_keys` | DB별 키 개수 | - |
| `redis_db_keys_expiring` | TTL 있는 키 개수 | - |
| `redis_commands_total` | 명령어 처리 수 | - |
| `redis_commands_duration_seconds_total` | 명령어 처리 시간 | - |
| `redis_instantaneous_ops_per_sec` | 초당 처리 명령 수 | - |
| `redis_replication_lag` | 복제 지연 (ms) | >100ms 경보 |

#### 4.5.3 Redis 알림 규칙 설계

```yaml
- name: saas-redis-alerts
  rules:
    - alert: RedisHighMemoryUsage
      # Plan SC: FR-N24.6
      expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.9
      for: 2m
      labels:
        severity: critical
        team: devops
      annotations:
        summary: "Redis 메모리 사용률 90% 초과"
        description: "현재 사용률: {{ $value | printf \"%.1f\" }}%"
        csap_ref: "D-06-03"

    - alert: RedisEvictionOccurred
      expr: increase(redis_evicted_keys_total[5m]) > 0
      for: 0m
      labels:
        severity: warning
      annotations:
        summary: "Redis Eviction 발생"
        description: "5분 내 {{ $value }}개 키 강제 삭제. 메모리 증설 또는 TTL 정책 검토."

    - alert: RedisCacheHitRateLow
      expr: |
        rate(redis_keyspace_hits_total[5m])
        / (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m]) + 0.001)
        < 0.8
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Redis 캐시 히트율 80% 미만"
        description: "현재 히트율: {{ $value | printf \"%.1f\" }}%"
```

---

## 5. Helm 배포 순서 (의존성 그래프)

```
[배포 전제조건]
  k3s 클러스터 구동 중 (MTU-N21 완료)
  monitoring 네임스페이스 존재
  local-path StorageClass 사용 가능
  pg_stat_statements 활성화 확인

[배포 순서]
Step 1: cert-manager (선택) 또는 OTel Operator 자체 서명 인증서
  └─ 소요: 약 2분

Step 2: OpenTelemetry Operator (cert-manager 의존 또는 자체 인증서)
  └─ 의존: Step 1
  └─ 소요: 약 3분

Step 3: kube-prometheus-stack (Prometheus + Grafana + AlertManager + kube-state-metrics + node-exporter)
  └─ 의존: 없음 (Step 1/2과 병렬 가능)
  └─ 소요: 약 5분

Step 4: Loki 3.x + Promtail DaemonSet
  └─ 의존: Step 3 (Grafana 데이터소스 자동 등록)
  └─ 소요: 약 3분

Step 5: Tempo 2.x
  └─ 의존: Step 3 (Grafana 데이터소스 자동 등록)
  └─ 소요: 약 2분

Step 6: OTel Collector (OpenTelemetryCollector CR)
  └─ 의존: Step 2 (OTel Operator), Step 5 (Tempo)
  └─ 소요: 약 2분

Step 7: InstrumentationCR (saas-platform 네임스페이스)
  └─ 의존: Step 6 (OTel Collector)
  └─ 소요: 약 1분

Step 8: PostgreSQL Exporter
  └─ 의존: Step 3 (ServiceMonitor 등록)
  └─ 소요: 약 2분

Step 9: Redis Exporter
  └─ 의존: Step 3 (ServiceMonitor 등록)
  └─ 소요: 약 2분

Step 10: Grafana 대시보드 ConfigMap 적용 (SQL, 트래픽, 로그탐색기)
  └─ 의존: Step 3, 4, 5, 8, 9
  └─ 소요: 약 1분

Step 11: AlertManager 웹훅 설정 + 알림 규칙 적용
  └─ 의존: Step 3, 8, 9
  └─ 소요: 약 2분

[총 예상 시간: 약 25-30분]
```

### 5.1 병렬 배포 가능 그룹

```
그룹 A (동시 실행 가능):
  - kube-prometheus-stack (Step 3)
  - OTel Operator (Step 2)

그룹 B (그룹 A 완료 후 동시 실행 가능):
  - Loki + Promtail (Step 4)
  - Tempo (Step 5)
  - PostgreSQL Exporter (Step 8)
  - Redis Exporter (Step 9)

그룹 C (그룹 B 완료 후):
  - OTel Collector (Step 6)
  - 대시보드 적용 (Step 10)
  - AlertManager 설정 (Step 11)
```

---

## 6. Grafana 대시보드 설계

### 6.1 대시보드 ConfigMap 로딩 구조

```
# kube-prometheus-stack sidecar 패턴 활용 (MTU-N25 기존 패턴 재사용)
ConfigMap (label: grafana_dashboard: "1", namespace: monitoring)
  └── data: {dashboard}.json
        ↓ (grafana-sc-dashboard sidecar 감지)
  └── Grafana /var/lib/grafana/dashboards/
```

### 6.2 대시보드 1: SQL 모니터링 (sql-monitoring)

```
파일: infra/monitoring/dashboards/sql-monitoring.yaml
목적: FR-N24.3 — PostgreSQL 쿼리 성능 가시화

패널 레이아웃 (12컬럼 그리드):
┌────────────────────────────────────────────────────────────┐
│ [Stat] 활성 연결 수  [Stat] 캐시 히트율  [Stat] TPS        │
│  w:4                  w:4                 w:4              │
├────────────────────────────────────────────────────────────┤
│ [Timeseries] 연결 상태별 추이 (active/idle/waiting)        │
│  w:12, h:8                                                 │
├────────────────────────────────────────────────────────────┤
│ [Table] 슬로우쿼리 TOP 20                                   │
│  컬럼: query_fingerprint, avg_exec_ms, max_exec_ms, calls  │
│  정렬: avg_exec_ms DESC                                     │
│  w:12, h:10                                                │
├─────────────────────────────┬──────────────────────────────┤
│ [Timeseries] 슬로우쿼리 추이 │ [Gauge] 인덱스 사용률        │
│ (5초 초과 건수/분)           │ 테이블별 index_usage_ratio   │
│  w:6, h:8                   │  w:6, h:8                   │
├────────────────────────────────────────────────────────────┤
│ [Timeseries] 트랜잭션 TPS 추이 (commit/rollback)           │
│  w:12, h:8                                                 │
└────────────────────────────────────────────────────────────┘

변수(Variable):
- $interval: 자동 (1m/5m/15m)
- $database: 데이터베이스 선택
```

### 6.3 대시보드 2: 서비스 트래픽 (service-traffic)

```
파일: infra/monitoring/dashboards/service-traffic.yaml
목적: FR-N24.5 — R.E.D. 메트릭 + 서비스 토폴로지

패널 레이아웃:
┌────────────────────────────────────────────────────────────┐
│ [Stat] 요청률(RPS)  [Stat] 에러율(%)  [Stat] P95 레이턴시  │
│  w:4                 w:4              w:4                  │
├────────────────────────────────────────────────────────────┤
│ [Node Graph] 서비스 토폴로지                                 │
│  (서비스간 요청 흐름, 에러율 색상 표시)                      │
│  데이터소스: Tempo (서비스 그래프)                           │
│  w:12, h:12                                               │
├────────────────────────────────────────────────────────────┤
│ [Timeseries] 서비스별 요청률 추이    │ [Timeseries] 에러율   │
│  w:6, h:8                           │  w:6, h:8            │
├────────────────────────────────────────────────────────────┤
│ [Heatmap] API 레이턴시 분포                                  │
│  (버킷별 요청 밀도, 핫스팟 시각화)                           │
│  w:12, h:8                                                 │
├─────────────────────────────┬──────────────────────────────┤
│ [Timeseries] Pod CPU 사용률  │ [Timeseries] Pod 메모리      │
│  namespace=saas-platform     │  namespace=saas-platform    │
│  w:6, h:8                    │  w:6, h:8                  │
└────────────────────────────────────────────────────────────┘

변수(Variable):
- $namespace: monitoring / saas-platform
- $service: 서비스 선택 (All 포함)
- $interval: 자동
```

### 6.4 대시보드 3: 로그 탐색기 (log-explorer)

```
파일: infra/monitoring/dashboards/log-explorer.yaml
목적: FR-N24.1 — 로그 통합 조회 + 로그-트레이스 상관관계

패널 레이아웃:
┌────────────────────────────────────────────────────────────┐
│ [Stat] 총 로그 수  [Stat] ERROR 수  [Stat] WARN 수         │
│  w:4               w:4             w:4                    │
├────────────────────────────────────────────────────────────┤
│ [Timeseries] 로그 레벨별 수 추이 (INFO/WARN/ERROR/FATAL)   │
│  w:12, h:8                                                 │
├────────────────────────────────────────────────────────────┤
│ [Logs] 실시간 로그 스트림 (Loki)                            │
│  쿼리: {namespace="$namespace", app="$service"}            │
│       | logfmt | level =~ "$level"                        │
│  deduplicate: true, prettify: true                         │
│  w:12, h:16                                               │
├────────────────────────────────────────────────────────────┤
│ [Table] 에러 로그 + TraceID 연결                            │
│  LogQL: |= "ERROR" | json | traceID != ""                 │
│  클릭 시 Tempo 트레이스 상관관계 탐색                        │
│  w:12, h:10                                               │
├─────────────────────────────┬──────────────────────────────┤
│ [Bar Gauge] 서비스별 에러 수 │ [PieChart] 로그 레벨 분포    │
│  w:6, h:8                   │  w:6, h:8                   │
└────────────────────────────────────────────────────────────┘

변수(Variable):
- $namespace: 네임스페이스 선택
- $service: 서비스명 선택
- $level: DEBUG / INFO / WARN / ERROR / FATAL
- $interval: 자동

# 로그-트레이스 상관관계 설정 (Correlations)
Loki → Tempo 연결:
  field: traceID
  target: Tempo datasource
  query: ${__value.raw}
```

---

## 7. 네트워크 및 포트 설계

### 7.1 서비스 포트 목록

| 서비스 | 클러스터 내부 DNS | 내부 포트 | NodePort | 프로토콜 |
|--------|-----------------|-----------|----------|---------|
| Grafana | `grafana.monitoring.svc.cluster.local` | 3000 | 32300 | HTTP |
| Prometheus | `prometheus-kube-prometheus-prometheus.monitoring.svc` | 9090 | 32090 | HTTP |
| AlertManager | `prometheus-kube-prometheus-alertmanager.monitoring.svc` | 9093 | 32093 | HTTP |
| Loki | `loki.monitoring.svc.cluster.local` | 3100 | - (내부 전용) | HTTP/gRPC |
| Tempo | `tempo.monitoring.svc.cluster.local` | 3200 | - (내부 전용) | HTTP |
| Tempo OTLP gRPC | `tempo.monitoring.svc.cluster.local` | 4317 | - (내부 전용) | gRPC |
| OTel Collector gRPC | `otel-collector.monitoring.svc.cluster.local` | 4317 | - (내부 전용) | gRPC |
| OTel Collector HTTP | `otel-collector.monitoring.svc.cluster.local` | 4318 | - (내부 전용) | HTTP |
| PostgreSQL Exporter | `postgres-exporter.monitoring.svc.cluster.local` | 9187 | - (내부 전용) | HTTP |
| Redis Exporter | `redis-exporter.monitoring.svc.cluster.local` | 9121 | - (내부 전용) | HTTP |
| kube-state-metrics | `kube-state-metrics.monitoring.svc.cluster.local` | 8080 | - (내부 전용) | HTTP |
| node-exporter | DaemonSet (각 노드 hostNetwork) | 9100 | - (내부 전용) | HTTP |

### 7.2 포트 충돌 확인 (MTU-N21 기존 환경)

| 기존 서비스 | 포트 | 충돌 여부 | 조치 |
|------------|------|---------|------|
| Gitea HTTP | 3001 | 없음 | - |
| Harbor | 8080 | 있음 (kube-state-metrics 8080) | kube-state-metrics는 클러스터 내부 전용, NodePort 미사용으로 충돌 없음 |
| k3s API | 6443 | 없음 | - |
| 기존 Grafana | 32300 | 확인 필요 | MTU-N21에서 이미 32300 사용 시 변경 |

### 7.3 네트워크 정책 설계 (CSAP D-08)

```yaml
# monitoring 네임스페이스 → saas-platform 네임스페이스 스크레이핑 허용
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-monitoring-scrape
  namespace: saas-platform
spec:
  podSelector: {}
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: monitoring
      ports:
        - port: 9090   # Prometheus metrics
        - port: 8080   # actuator metrics
        - port: 3000   # app metrics
  policyTypes:
    - Ingress
```

---

## 8. CSAP 준수 설계

### 8.1 D-06 침해사고 관리 — 감사 로그

| 항목 | 설계 방법 | 구현 위치 |
|------|---------|---------|
| D-06-01: 보안 이벤트 로그 수집 | Loki로 모든 마이크로서비스 로그 중앙 수집 | Promtail DaemonSet |
| D-06-02: 로그 30일 이상 보존 | Loki retention_period: 720h (운영: 8760h=1년) | loki/values.yaml |
| D-06-03: 이상 탐지 알림 | AlertManager 규칙 (CPU/메모리/에러율/슬로우쿼리) | alerting-rules.yaml |
| D-06-04: 로그 무결성 | BoltDB-shipper append-only 구조, PVC 직접 수정 불가 | Loki 저장소 |
| D-06-05: 침해사고 대응 지원 | Grafana 로그 탐색기 + 트레이스 상관관계로 포렌식 지원 | 로그 탐색기 대시보드 |

### 8.2 D-08 접근 통제 — Grafana RBAC

| 역할 | 권한 | 대상 사용자 |
|------|------|-----------|
| Admin | 대시보드 생성·수정·삭제, 데이터소스 관리, 사용자 관리 | DevOps 엔지니어 (1-2명) |
| Editor | 대시보드 생성·수정, 알림 규칙 수정 | 개발팀 리드 |
| Viewer | 대시보드 조회 전용, 로그 조회 | 일반 개발자, DBA |

```yaml
# Grafana RBAC 설계 (kube-prometheus-stack values)
# Design Ref: §8.2 — CSAP D-08 접근통제 3계층
grafana:
  grafana.ini:
    auth:
      disable_login_form: false
    auth.anonymous:
      enabled: false           # 익명 접근 완전 차단
    security:
      secret_key: ${GRAFANA_SECRET_KEY}   # 환경 변수 참조 (하드코딩 금지)
      cookie_secure: true
      cookie_samesite: strict
    users:
      auto_assign_org_role: Viewer      # 신규 사용자 기본 역할: Viewer
      allow_sign_up: false              # 자가 등록 금지
```

### 8.3 D-09 암호화

| 항목 | 설계 방법 |
|------|---------|
| PostgreSQL Exporter 인증 | `postgresql-exporter-secret` Secret 참조 (평문 금지) |
| Redis Exporter 인증 | `redis-exporter-secret` Secret 참조 (평문 금지) |
| Grafana 관리자 비밀번호 | `grafana-admin-secret` Secret 참조 |
| OTel Collector → Tempo | 클러스터 내부 통신 (TLS 선택적, 개발환경 insecure 허용) |
| Promtail → Loki | 클러스터 내부 HTTP (운영환경 TLS 적용 권장) |

```yaml
# Secret 참조 패턴 (CSAP D-09 준수)
# Design Ref: §8.3 — 하드코딩 시크릿 절대 금지
env:
  - name: PG_PASSWORD
    valueFrom:
      secretKeyRef:
        name: postgresql-exporter-secret
        key: password
  - name: REDIS_PASSWORD
    valueFrom:
      secretKeyRef:
        name: redis-exporter-secret
        key: password
```

### 8.4 D-12 시스템 개발 보안

| 항목 | 설계 방법 | 구현 위치 |
|------|---------|---------|
| D-12-01: PII 마스킹 | Promtail 파이프라인 (이메일·전화·주민번호 정규식) | §4.1.3 |
| D-12-10: SQL 쿼리 로그 보안 | pg_stat_statements queryid만 노출, 원문 미수집 | §4.4.3 |
| D-12-11: 설정 파일 시크릿 | 환경 변수 + k8s Secret 참조 | §8.3 |
| D-12-12: 에러 메시지 보안 | Grafana 에러 상세 미노출 (generic error) | Grafana 설정 |

---

## 9. 추적성 매트릭스

| FR ID | 컴포넌트 | 테스트 방법 | CSAP 항목 | 성공 기준 |
|-------|---------|-----------|---------|---------|
| FR-N24.1 | Loki 3.x + Promtail | LogQL 쿼리 실행 → 로그 조회 확인 | D-06-01, D-12-01 | 마이크로서비스 로그 5초 내 조회 가능 (NFR-N24.2) |
| FR-N24.1 (PII) | Promtail 파이프라인 | 테스트 로그 투입 → 마스킹 확인 | D-12-01 | 이메일·전화·주민번호 [MASKED] 치환 확인 |
| FR-N24.2 | Tempo + OTel Operator | 요청 발생 → TraceQL 조회 | D-06-05 | 30초 내 Grafana 트레이스 노출 (NFR-N24.3) |
| FR-N24.2 (샘플링) | OTel Collector | 부하 테스트 → 에러 트레이스 100% 수집 확인 | - | Tail-based 샘플링 에러 트레이스 누락 없음 |
| FR-N24.3 | PostgreSQL Exporter | 슬로우쿼리 유발 → 대시보드 반영 확인 | D-12-10 | 5초 초과 쿼리 알림 수신 확인 (FR-N24.6) |
| FR-N24.4 | Redis Exporter | Redis 메모리 임계값 초과 테스트 | D-06-03 | 90% 초과 시 AlertManager 알림 발생 |
| FR-N24.5 | kube-state-metrics + Tempo | 서비스 토폴로지 대시보드 확인 | D-08-01 | Node Graph 패널 서비스간 연결 정상 표시 |
| FR-N24.6 | AlertManager | 알림 규칙 수동 트리거 | D-06-03 | Gitea Webhook 알림 수신 확인 |
| NFR-N24.4 | 전체 스택 | `kubectl top pods -n monitoring` | D-06-07 | 모니터링 스택 RAM 합계 ≤ 4GB |
| INFR-N24.2 | PVC | `kubectl get pvc -n monitoring` | - | Loki 20GB + Prometheus 20GB + Tempo 10GB PVC 바인딩 |

---

## 10. 아키텍처 결정 기록 (ADR)

### ADR-N24-001: Loki 모드 — SingleBinary vs Distributed

```
결정: SingleBinary 모드 채택
이유: WSL2 k3s 단일 노드 환경. Distributed 모드는 Ingester/Distributor/Querier
      각각 별도 배포 필요 → 메모리 2GB+ 추가 소요. NFR-N24.4(4GB 이내) 위반.
대안: Distributed 모드 (운영 환경 전환 시 검토)
```

### ADR-N24-002: 트레이스 샘플링 전략

```
결정: Head-based 10% + Tail-based(에러/슬로우500ms) 100%
이유: 전체 트레이스 수집 시 OTel 오버헤드 5-10% + Tempo 스토리지 과다 소모.
      에러 및 슬로우 요청은 100% 보존하여 디버깅 가치 유지.
구현: OTel Collector probabilistic_sampler + tail_sampling 정책 조합
```

### ADR-N24-003: PostgreSQL 쿼리 원문 비수집

```
결정: pg_stat_statements queryid만 수집, query 원문 미수집
이유: CSAP D-12: 쿼리 원문에 민감 데이터(이름, 주민번호 등) 포함 가능성.
      queryid로 성능 분석 가능하며 원문은 DBA가 직접 DB 접속하여 확인.
준수: N2SF C/S등급 데이터 AI API 전송 금지 원칙과 동일한 최소 수집 원칙 적용.
```

### ADR-N24-004: Promtail vs Vector

```
결정: Promtail 채택 (Vector 미사용)
이유: kube-prometheus-stack 및 Grafana Loki 공식 Helm Chart와 통합 지원.
      Vector는 성능 우수하나 추가 설정 복잡도 증가. WSL2 개발환경에서는 Promtail 충분.
대안: Vector (운영 환경 대용량 로그 처리 시 재검토)
```

---

## 11. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 — LGTM 스택 + OTel Operator + DB Exporter 통합 설계 | Implementer Agent |
