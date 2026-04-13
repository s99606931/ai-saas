# 모니터링 고급 FAQ — Prometheus/Grafana/Loki/Tempo/Pyroscope 심화 운영 25개 Q&A

> 대상 독자: 운영 경험 1년 이상 개발자 및 SRE 엔지니어  
> 선행 학습: 05-monitoring/ 디렉토리 전체, 11-faq/05-operations-faq.md  
> 최종 수정: 2026-04-13

---

## 목차

- [Prometheus 심화 (Q1~Q8)](#prometheus-심화)
- [Grafana/Loki 심화 (Q9~Q17)](#grafanaloki-심화)
- [Tempo/Pyroscope 심화 (Q18~Q25)](#tempopyroscope-심화)

---

## 관측가능성 스택 전체 구조

### MELT 4종 상호 연결 및 드릴다운 경로

```mermaid
flowchart TD
    subgraph SOURCES["데이터 소스 계층"]
        SVC["마이크로서비스\n(ai-service, compliance-service 등)"]
        INFRA["인프라\n(k3s 노드, Pod, DB)"]
        USERS["사용자 요청\n(API Gateway)"]
    end

    subgraph COLLECT["수집 계층"]
        OTEL["OTel Collector\n(통합 수집기)"]
        PROM_SCRAPE["Prometheus Scraper\n(Pull 방식)"]
        PROMTAIL["Promtail\n(로그 테일)"]
    end

    subgraph STORE["저장 계층"]
        PROMETHEUS["Prometheus\nMetrics DB\n(15일 보존)"]
        LOKI["Grafana Loki\nLog DB\n(1년 보존)"]
        TEMPO["Grafana Tempo\nTrace DB\n(7일 보존)"]
        PYROSCOPE["Grafana Pyroscope\nProfile DB\n(3일 보존)"]
    end

    subgraph QUERY["쿼리 계층"]
        PROMQL["PromQL\n(메트릭 쿼리)"]
        LOGQL["LogQL\n(로그 쿼리)"]
        TRACEQL["TraceQL\n(트레이스 쿼리)"]
        FLAMEQL["Pyroscope API\n(프로파일 쿼리)"]
    end

    subgraph VIZ["시각화 계층"]
        GRAFANA["Grafana\n(통합 대시보드)"]
        ALERTMGR["AlertManager\n(알림 관리)"]
    end

    subgraph DRILLDOWN["드릴다운 경로 (CSAP D-06 연동)"]
        M2T["메트릭 → 트레이스\n(Exemplar 클릭)"]
        T2L["트레이스 → 로그\n(Trace ID 검색)"]
        L2P["로그 → 프로파일\n(시간대 선택)"]
        P2M["프로파일 → 메트릭\n(함수명 → CPU 메트릭)"]
    end

    SVC --> OTEL
    SVC --> PROM_SCRAPE
    SVC --> PROMTAIL
    INFRA --> PROM_SCRAPE
    USERS --> OTEL

    OTEL --> TEMPO
    OTEL --> PROMETHEUS
    PROM_SCRAPE --> PROMETHEUS
    PROMTAIL --> LOKI
    OTEL --> PYROSCOPE

    PROMETHEUS --> PROMQL
    LOKI --> LOGQL
    TEMPO --> TRACEQL
    PYROSCOPE --> FLAMEQL

    PROMQL --> GRAFANA
    LOGQL --> GRAFANA
    TRACEQL --> GRAFANA
    FLAMEQL --> GRAFANA
    PROMQL --> ALERTMGR

    GRAFANA --> M2T
    M2T --> T2L
    T2L --> L2P
    L2P --> P2M
    P2M --> GRAFANA

    style DIRECT fill:#ff6b6b,color:#fff
    style M2T fill:#e74c3c,color:#fff
    style T2L fill:#e67e22,color:#fff
    style L2P fill:#f1c40f,color:#333
    style P2M fill:#2ecc71,color:#fff
```

---

## Prometheus 심화

### Q1. Prometheus가 타겟 스크레이프에 실패합니다. 원인 분석 방법은?

**증상:** Prometheus UI에서 타겟 상태가 `DOWN`으로 표시되거나 `up` 메트릭이 0으로 기록됩니다.

**원인 분석 순서도:**

```mermaid
flowchart TD
    START["스크레이프 실패 감지\nup{job='my-service'} == 0"] --> CHECK1

    CHECK1["1. Prometheus UI 타겟 페이지 확인\n/targets → Error 메시지 확인"]
    CHECK1 --> ERR1{"오류 유형?"}

    ERR1 -->|"connection refused"| FIX1["서비스/Pod 다운\n→ kubectl get pods -n public-saas"]
    ERR1 -->|"no route to host"| FIX2["NetworkPolicy 차단\n→ kubectl describe netpol"]
    ERR1 -->|"context deadline exceeded"| FIX3["메트릭 엔드포인트 응답 지연\n→ timeout 설정 확인"]
    ERR1 -->|"certificate error"| FIX4["TLS 인증서 문제\n→ cert 만료 확인"]
    ERR1 -->|"401 unauthorized"| FIX5["인증 토큰 만료\n→ scrape_configs credentials 확인"]

    FIX1 --> POD_CHECK["kubectl describe pod\n→ 재시작 원인 확인"]
    FIX2 --> NP_FIX["NetworkPolicy에\nPrometheus → 서비스 9090 허용 추가"]
    FIX3 --> TIMEOUT_FIX["scrape_timeout: 30s 설정\n또는 메트릭 엔드포인트 최적화"]

    POD_CHECK --> RESOLVED["해결"]
    NP_FIX --> RESOLVED
    TIMEOUT_FIX --> RESOLVED
    FIX4 --> CERT_FIX["cert-manager 인증서 갱신"]
    FIX5 --> AUTH_FIX["Secret 갱신 후 Prometheus 재로드"]
    CERT_FIX --> RESOLVED
    AUTH_FIX --> RESOLVED

    style START fill:#e74c3c,color:#fff
    style RESOLVED fill:#2ecc71,color:#fff
```

**진단 명령어 모음:**

```bash
# 1. Prometheus 타겟 상태 API 확인
curl -s http://prometheus:9090/api/v1/targets | \
  jq '.data.activeTargets[] | select(.health != "up") | {job: .labels.job, error: .lastError}'

# 2. 특정 서비스 메트릭 직접 확인 (스크레이프 시뮬레이션)
kubectl exec -n public-saas prometheus-0 -- \
  curl -sv http://ai-service.public-saas.svc.cluster.local:3000/metrics

# 3. Prometheus 설정 파일 문법 검증
promtool check config /etc/prometheus/prometheus.yml

# 4. ServiceMonitor 정상 적용 여부 확인 (Prometheus Operator 사용 시)
kubectl get servicemonitor -n public-saas
kubectl describe servicemonitor ai-service-monitor -n public-saas

# 5. Prometheus 설정 실시간 리로드 (재시작 없이)
curl -X POST http://prometheus:9090/-/reload

# 6. 타겟 레이블 최종 결과 확인
curl -s 'http://prometheus:9090/api/v1/targets/metadata' | jq '.data[:3]'
```

**PromQL 모니터링:**

```promql
# 스크레이프 실패율 알림 (D-06 운영 모니터링)
up == 0

# 스크레이프 지속 시간 (타임아웃 임박 여부)
scrape_duration_seconds{job="ai-service"} > 25  # 30초 타임아웃의 83%

# 최근 스크레이프 성공 여부
time() - scrape_timestamp_seconds{job="ai-service"} > 120  # 2분 이상 미갱신
```

---

### Q2. 고카디널리티 레이블로 인한 Prometheus 메모리 급증 해결 방법은?

**문제 원인:** 레이블 값의 조합(카디널리티)이 너무 많으면 Prometheus TSDB가 수억 개의 시계열을 생성하여 메모리를 소진합니다. 예: `user_id`, `session_id`, `request_id` 같은 고유값 레이블.

**위험한 패턴 예시:**

```typescript
// ❌ 절대 금지 — 고카디널리티 레이블
const requestCounter = new Counter({
  name: 'api_requests_total',
  help: 'API 요청 수',
  labelNames: ['user_id', 'session_id', 'request_id'], // 무한 카디널리티!
});

// ✅ 올바른 패턴 — 제한된 카디널리티
const requestCounter = new Counter({
  name: 'api_requests_total',
  help: 'API 요청 수',
  labelNames: ['service', 'method', 'status_code', 'tenant_tier'],
  // tenant_tier: 'standard' | 'premium' | 'enterprise' (3가지 값만)
});
```

**현재 카디널리티 진단:**

```bash
# 1. TSDB 통계 확인 (카디널리티 분석)
curl -s http://prometheus:9090/api/v1/status/tsdb | jq '.data.seriesCountByMetricName[:10]'

# 2. 가장 많은 시계열을 생성하는 레이블 찾기
curl -s http://prometheus:9090/api/v1/status/tsdb | \
  jq '.data.labelValueCountByLabelName | to_entries | sort_by(.value) | reverse | .[0:10]'

# 3. 메모리 사용량 확인
curl -s http://prometheus:9090/api/v1/query?query=process_resident_memory_bytes | \
  jq '.data.result[0].value[1]' | awk '{print $1/1024/1024 " MB"}'
```

**PromQL 카디널리티 분석:**

```promql
# 시계열 수가 10000을 초과하는 메트릭 찾기
topk(10, count by (__name__)({__name__=~".+"}))

# 특정 메트릭의 레이블 조합 수 확인
count(api_requests_total) by (user_id)  # user_id 레이블의 유니크 값 수

# 카디널리티 과다로 메모리 급증 알림
prometheus_tsdb_head_series > 5000000  # 500만 시계열 임계값
```

**해결 방법:**

```yaml
# prometheus.yml — 고카디널리티 레이블 드롭
scrape_configs:
  - job_name: 'ai-service'
    metric_relabel_configs:
      # user_id 레이블 완전 제거
      - source_labels: [__name__]
        regex: 'api_requests_total'
        action: drop
        # 또는 레이블만 제거 (메트릭은 유지)
      - action: labeldrop
        regex: 'user_id|session_id|request_id'

      # 레이블 값을 그룹화하여 카디널리티 축소
      - source_labels: [tenant_id]
        regex: '.+'
        replacement: 'has_tenant'
        target_label: tenant_status
```

---

### Q3. Recording Rule을 사용해서 복잡한 PromQL을 최적화하는 방법은?

**Recording Rule이 필요한 경우:**

- 대시보드에서 동일한 복잡한 쿼리를 매 15초마다 실행
- 쿼리 응답 시간이 10초 이상 걸리는 경우
- 많은 사용자가 동시에 동일한 쿼리를 조회하는 경우

**Recording Rule 정의 및 적용:**

```yaml
# k8s/monitoring/recording-rules.yaml
# CSAP D-10: 성능 최적화로 운영 안정성 향상
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: public-saas-recording-rules
  namespace: public-saas
  labels:
    release: prometheus  # Prometheus Operator 선택자
spec:
  groups:
    - name: saas.api.recording
      interval: 30s  # 30초마다 미리 계산
      rules:
        # 서비스별 요청율 (5분 평균)
        - record: job:api_request_rate:5m
          expr: |
            sum by (job, method, status_code) (
              rate(api_requests_total[5m])
            )

        # P99 레이턴시 (5분 윈도우)
        - record: job:api_request_duration_p99:5m
          expr: |
            histogram_quantile(0.99,
              sum by (job, le) (
                rate(api_request_duration_seconds_bucket[5m])
              )
            )

        # 테넌트별 에러율 (멀티테넌트 SLO 모니터링)
        - record: tenant:api_error_rate:5m
          expr: |
            sum by (tenant_id) (
              rate(api_requests_total{status_code=~"5.."}[5m])
            )
            /
            sum by (tenant_id) (
              rate(api_requests_total[5m])
            )

        # AI 서비스 토큰 처리량
        - record: job:ai_tokens_per_second:1m
          expr: |
            sum by (job, model) (
              rate(ai_tokens_used_total[1m])
            )
```

**대시보드에서 Recording Rule 사용:**

```promql
# 느린 원본 쿼리 (매번 계산, 10초 이상)
histogram_quantile(0.99,
  sum by (job, le) (
    rate(api_request_duration_seconds_bucket[5m])
  )
)

# 빠른 Recording Rule 사용 (미리 계산, 밀리초)
job:api_request_duration_p99:5m
```

**성능 개선 검증:**

```bash
# 쿼리 실행 시간 측정
time curl -s 'http://prometheus:9090/api/v1/query?query=job:api_request_duration_p99:5m'

# Recording Rule 평가 지연 모니터링
prometheus_rule_evaluation_duration_seconds{rule_group="saas.api.recording"}
```

---

### Q4. Prometheus 데이터 보존 정책을 설정하고 오래된 데이터를 정리하는 방법은?

**CSAP D-10.2 요건:** 감사 로그는 1년 보존이 필수입니다. 메트릭 데이터는 별도 기준을 적용할 수 있습니다.

**데이터 보존 계층 설계:**

```
Prometheus (Hot Storage):   15일 — 빠른 쿼리, 높은 비용
Thanos/Victoria Metrics:   90일 — 중간 쿼리, 중간 비용
Object Storage (S3/Minio): 1년+  — 느린 쿼리, 낮은 비용
```

**Prometheus 보존 설정:**

```yaml
# helm/prometheus/values.yaml
prometheus:
  prometheusSpec:
    # 데이터 보존 기간 (메트릭)
    retention: 15d

    # 데이터 보존 크기 (디스크 보호)
    retentionSize: 50GB

    # TSDB 압축 설정
    tsdb:
      # 오래된 블록 압축 (자동)
      outOfOrderTimeWindow: 30m  # 30분 이내 지연 데이터 허용
```

**수동 데이터 정리:**

```bash
# 1. Prometheus Admin API로 특정 메트릭 완전 삭제 (주의!)
# Admin API 활성화 필요: --web.enable-admin-api
curl -X POST 'http://prometheus:9090/api/v1/admin/tsdb/delete_series' \
  --data-urlencode 'match[]=test_metric_to_delete{env="dev"}'

# 2. 삭제된 데이터 즉시 정리 (tombstone 제거)
curl -X POST 'http://prometheus:9090/api/v1/admin/tsdb/clean_tombstones'

# 3. TSDB 스냅샷 생성 (데이터 마이그레이션)
curl -X POST 'http://prometheus:9090/api/v1/admin/tsdb/snapshot'
# /prometheus/snapshots/ 에 스냅샷 생성됨

# 4. 현재 TSDB 상태 확인
curl -s http://prometheus:9090/api/v1/status/tsdb | jq '.data | {
  headChunks: .headChunks,
  chunkCount: .chunkCount,
  oldestTimestamp: (.minTime / 1000 | todate),
  newestTimestamp: (.maxTime / 1000 | todate)
}'
```

**장기 보존 — Thanos 연동 (권장):**

```yaml
# Thanos Sidecar 설정 (Prometheus와 함께 실행)
# CSAP D-10.2: 메트릭 장기 보존
thanos:
  objectStorageConfig:
    type: S3  # 또는 GCS, MinIO
    config:
      bucket: prometheus-long-term
      endpoint: minio.public-saas.svc.cluster.local:9000
      access_key: $(MINIO_ACCESS_KEY)
      secret_key: $(MINIO_SECRET_KEY)
  retention:
    resolution0: 90d   # Raw 데이터 90일
    resolution5m: 180d # 5분 다운샘플 180일
    resolution1h: 1y   # 1시간 다운샘플 1년
```

---

### Q5. Federation을 사용해서 여러 Prometheus 인스턴스 데이터를 집계하는 방법은?

**사용 시나리오:** 테넌트별 독립 Prometheus + 중앙 글로벌 Prometheus 구성.

```yaml
# 글로벌 Prometheus 설정 — 테넌트 Prometheus에서 집계 메트릭 수집
scrape_configs:
  - job_name: 'federate-tenant-a'
    scrape_interval: 60s  # Federation은 느린 주기 권장
    honor_labels: true    # 원본 레이블 보존
    metrics_path: '/federate'
    params:
      match[]:
        # 집계가 필요한 핵심 메트릭만 Federation (전체 복사 금지!)
        - 'job:api_request_rate:5m'     # Recording Rule 결과
        - 'job:api_error_rate:5m'       # SLO 메트릭
        - 'tenant:revenue_events_total' # 비즈니스 메트릭
    static_configs:
      - targets: ['prometheus-tenant-a:9090']
        labels:
          tenant: 'tenant-a'
          region: 'kr-central'

  - job_name: 'federate-tenant-b'
    # ... 동일한 패턴
```

**Federation vs. Remote Write 선택 기준:**

| 특성 | Federation | Remote Write |
|------|-----------|--------------|
| 사용 목적 | 집계 뷰 | 데이터 복제 |
| 전송 방식 | Pull (요청) | Push (전송) |
| 데이터 양 | 선택적 (권장) | 전체 |
| 지연 | 스크레이프 주기 | 실시간 |
| 적합한 경우 | 여러 클러스터 집계 | 장기 저장소 연동 |

---

### Q6. Remote Write로 장기 데이터를 외부 저장소에 저장하는 방법은?

```yaml
# prometheus.yml — Remote Write 설정
# CSAP D-10.2: 1년 장기 보존을 위한 외부 저장소 연동
remote_write:
  - url: "http://thanos-receive.monitoring.svc.cluster.local:19291/api/v1/receive"
    # 또는 Victoria Metrics
    # url: "http://victoria-metrics:8428/api/v1/write"

    # 메트릭 필터링 (비용 절감)
    write_relabel_configs:
      # 개발용 메트릭 제외
      - source_labels: [env]
        regex: 'dev|test'
        action: drop
      # 고카디널리티 메트릭 제외
      - source_labels: [__name__]
        regex: 'go_memstats.*|process_.*'
        action: drop

    # 배치 및 재시도 설정
    queue_config:
      capacity: 10000
      max_shards: 10
      min_shards: 1
      max_samples_per_send: 5000
      batch_send_deadline: 5s
      min_backoff: 30ms
      max_backoff: 100ms

    # TLS 설정 (D-09: 전송 암호화)
    tls_config:
      cert_file: /etc/prometheus/tls/client.crt
      key_file: /etc/prometheus/tls/client.key
      ca_file: /etc/prometheus/tls/ca.crt
```

**Remote Write 큐 상태 모니터링:**

```promql
# Remote Write 큐가 꽉 차는지 확인
prometheus_remote_storage_queue_capacity - prometheus_remote_storage_shards_capacity > 0

# 전송 실패율
rate(prometheus_remote_storage_failed_samples_total[5m]) > 0

# 전송 지연
prometheus_remote_storage_highest_timestamp_in_seconds -
  prometheus_remote_storage_queue_highest_sent_timestamp_seconds > 120
```

---

### Q7. 멀티테넌트 환경에서 테넌트별 메트릭 접근을 제한하는 방법은?

**공공기관 SaaS 핵심 요건:** 테넌트 A는 테넌트 B의 메트릭을 절대 볼 수 없어야 합니다.

**방법 1: Grafana 조직(Org) 기반 분리**

```bash
# 테넌트별 Grafana 조직 생성
curl -X POST http://admin:admin@grafana:3000/api/orgs \
  -H 'Content-Type: application/json' \
  -d '{"name": "테넌트A 조직"}'

# 테넌트별 데이터소스 설정 (테넌트 레이블 필터 적용)
# 각 조직의 Prometheus 데이터소스에 HTTP 커스텀 헤더 추가
# X-Scope-OrgID: tenant-a (Thanos/Cortex 멀티테넌시 활성화 시)
```

**방법 2: Thanos Querier 멀티테넌시**

```yaml
# Thanos Querier 멀티테넌시 활성화
thanos-querier:
  args:
    - --store=thanos-store-tenant-a:10901
    - --store=thanos-store-tenant-b:10901
    # 테넌트별 Querier 독립 실행
    - --query.replica-label=tenant_id

  # Grafana에서 테넌트별 다른 Thanos Querier URL 사용
  # 테넌트A 대시보드: http://thanos-querier-tenant-a:9090
  # 테넌트B 대시보드: http://thanos-querier-tenant-b:9090
```

**방법 3: PromQL 레이블 강제 필터 (Grafana 변수)**

```promql
# 대시보드 변수 정의
# Variable: tenant_id = 로그인한 사용자의 tenant_id (서버에서 주입)

# 모든 패널에 테넌트 필터 강제
api_requests_total{tenant_id="$tenant_id", job=~"$job"}

# 레이블 없는 메트릭에서 테넌트 필터
# (테넌트 레이블이 없는 메트릭은 테넌트에게 보이면 안 됨)
```

**방법 4: Grafana LBAC (Label-Based Access Control)**

```yaml
# Grafana Enterprise 기능 — 레이블 기반 접근 제어
# grafana.ini
[feature_toggles]
accessControlOnCall = true

# 데이터소스 권한 설정
# 특정 팀은 tenant_id="tenant-a" 레이블을 가진 메트릭만 접근 가능
```

---

### Q8. Prometheus Operator의 PrometheusRule이 적용되지 않을 때 디버깅 방법은?

```bash
# 1. PrometheusRule 리소스 상태 확인
kubectl get prometheusrule -n public-saas
kubectl describe prometheusrule public-saas-recording-rules -n public-saas

# 2. Prometheus Operator 로그 확인 (Rule 로드 오류)
kubectl logs -n monitoring \
  -l app.kubernetes.io/name=prometheus-operator \
  --tail=100 | grep -i "rule\|error"

# 3. Prometheus가 Rule을 로드했는지 확인
kubectl exec -n monitoring prometheus-kube-prometheus-prometheus-0 -- \
  curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].name'

# 4. Prometheus 설정에 ruleSelector 확인 (레이블 매칭)
kubectl get prometheus -n monitoring -o yaml | grep -A 10 ruleSelector

# 5. PrometheusRule 레이블이 ruleSelector와 일치하는지 확인
kubectl get prometheusrule public-saas-recording-rules -n public-saas -o yaml | grep labels

# 6. Prometheus 설정 리로드 강제 실행
kubectl exec -n monitoring prometheus-kube-prometheus-prometheus-0 -- \
  curl -X POST http://localhost:9090/-/reload

# 7. Rule 네임스페이스 매칭 확인
kubectl get prometheus -n monitoring -o yaml | grep -A 5 ruleNamespaceSelector
```

**일반적인 원인과 해결책:**

| 원인 | 증상 | 해결책 |
|------|------|--------|
| 레이블 불일치 | Rule 로드됨, UI에 없음 | ruleSelector와 레이블 매칭 |
| 네임스페이스 제한 | Rule 무시됨 | ruleNamespaceSelector 확인 |
| PromQL 문법 오류 | Rule 로드 실패 | `promtool check rules rule.yml` |
| RBAC 권한 부족 | Operator가 Rule 못 읽음 | ClusterRole 확인 |

---

## Grafana/Loki 심화

### Q9. Grafana 대시보드가 "No Data"를 표시합니다. 원인 분석 방법은?

**체계적인 디버깅 순서:**

```bash
# 1단계: 데이터소스 연결 확인
# Grafana UI → Configuration → Data Sources → Test

# 2단계: 쿼리 직접 실행 (Explore 탭 사용)
# Metrics Browser에서 메트릭 존재 여부 확인

# 3단계: 시간 범위 확인
# 대시보드 우측 상단 시간 범위가 데이터 존재 구간과 일치하는지

# 4단계: Grafana 로그 확인
kubectl logs -n monitoring \
  -l app.kubernetes.io/name=grafana \
  --tail=100 | grep -i "error\|datasource"
```

**PromQL "No Data" 원인별 해결:**

```promql
# 문제 1: 메트릭 이름 오타
up  # 정상
up_wrong  # No Data

# 확인 방법: Prometheus UI에서 메트릭 목록 검색
# http://prometheus:9090/api/v1/label/__name__/values

# 문제 2: 레이블 값 불일치
api_requests_total{job="ai-service"}    # 정상
api_requests_total{job="ai_service"}    # 언더바 vs 하이픈 불일치

# 확인 방법: 레이블 값 목록 조회
curl 'http://prometheus:9090/api/v1/label/job/values'

# 문제 3: 시간 범위 밖 데이터
# [5m] 윈도우인데 데이터가 10분 전에 중단된 경우
# 해결: 대시보드 새로고침 또는 시간 범위 확대

# 문제 4: Recording Rule 미처리
# Rule 평가 주기(30초) 기다린 후 재확인
```

**LogQL "No Data" 원인별 해결:**

```logql
# 문제 1: 스트림 선택자 불일치
{namespace="public-saas", app="ai-service"}  # 정상
{namespace="public_saas", app="ai-service"}  # 언더바 vs 하이픈 불일치

# 확인 방법: Loki 레이블 조회
curl 'http://loki:3100/loki/api/v1/labels'
curl 'http://loki:3100/loki/api/v1/label/namespace/values'

# 문제 2: 시간 범위에 로그 없음
# 최근 1시간으로 범위 변경 후 확인

# 문제 3: Loki 쿼리 제한 초과
# Grafana Explorer에서 직접 실행하여 오류 메시지 확인
```

---

### Q10. LogQL에서 JSON 로그 파싱이 느립니다. 최적화 방법은?

**LogQL 최적화 원칙:** 스트림 선택자를 최대한 좁혀서 파싱 대상 로그 양을 줄입니다.

```logql
# ❌ 느린 패턴 — 넓은 선택자, JSON 전체 파싱
{namespace="public-saas"}
| json
| level="error"

# ✅ 빠른 패턴 — 좁은 선택자, 필요한 필드만 파싱
{namespace="public-saas", app="ai-service", level="error"}
| json action, tenantId, duration
| duration > 1000

# 추가 최적화: line_format으로 필드 선택
{namespace="public-saas", app="ai-service"}
| json
| line_format "{{.action}} {{.tenantId}} {{.duration}}ms"
```

**인덱스 활용 최적화:**

```logql
# Loki 인덱스: 스트림 레이블만 인덱싱됨
# namespace, app, level, job, pod 등 Promtail 레이블

# ❌ 인덱스 미사용 (전체 스캔)
{namespace="public-saas"} |= "ERROR" | json | tenantId="tenant-a"

# ✅ 인덱스 사용 (스트림 선택자에서 필터)
{namespace="public-saas", app="ai-service", level="error"} | json | tenantId="tenant-a"
```

**LogQL 집계 최적화:**

```logql
# ❌ 느린 집계 — 전체 로그 파싱 후 집계
sum by (tenantId) (
  rate({namespace="public-saas"} | json | action="RAG_QUERY" [5m])
)

# ✅ 빠른 집계 — 스트림 선택자로 사전 필터
sum by (tenantId) (
  rate(
    {namespace="public-saas", app="ai-service"}
    | json action, tenantId
    | action="RAG_QUERY"
    [5m]
  )
)
```

**Loki 쿼리 성능 프로파일링:**

```bash
# 쿼리 실행 시간 측정
time curl -G 'http://loki:3100/loki/api/v1/query_range' \
  --data-urlencode 'query={namespace="public-saas"} | json | level="error"' \
  --data-urlencode 'start=1709913600000000000' \
  --data-urlencode 'end=1709917200000000000'

# 쿼리 통계 확인 (X-Query-Stats 헤더)
curl -v -G 'http://loki:3100/loki/api/v1/query_range' \
  --data-urlencode 'query={app="ai-service"} | json' 2>&1 | grep -i stats
```

---

### Q11. Loki에서 특정 기간 로그가 유실되었습니다. 원인과 복구 방법은?

**원인 분석:**

```bash
# 1. Promtail 상태 확인 (수집 에이전트)
kubectl get pods -n monitoring -l app=promtail
kubectl logs -n monitoring -l app=promtail --tail=200 | grep -i "error\|warn\|drop"

# 2. Promtail 위치 파일 확인 (어디까지 읽었는지)
kubectl exec -n monitoring $(kubectl get pod -n monitoring -l app=promtail -o name | head -1) \
  -- cat /var/log/positions.yaml

# 3. Loki 수집 메트릭 확인
# loki_ingester_streams_created_total
# loki_distributor_lines_received_total
curl -s 'http://prometheus:9090/api/v1/query?query=rate(loki_distributor_lines_received_total[5m])'

# 4. Loki 청크 저장 상태 확인
kubectl logs -n monitoring loki-0 --tail=200 | grep -i "error\|flush"

# 5. 디스크/메모리 부족 확인 (가장 흔한 원인)
kubectl top pod -n monitoring -l app=loki
kubectl exec -n monitoring loki-0 -- df -h /var/loki
```

**유실 데이터 복구 시도:**

```bash
# 방법 1: Loki Canary로 로그 유실 감지 설정 (사전 예방)
# loki-canary는 테스트 로그를 주입하고 수신 여부를 확인함
helm upgrade loki-canary grafana/loki-canary \
  --set lokiAddress=loki:3100

# 방법 2: 파드 로그 파일 직접 확인 (유실 구간 원본 확인)
kubectl logs -n public-saas ai-service-xxx --since-time="2026-04-10T10:00:00Z"

# 방법 3: 파드 로그를 Loki에 수동 푸시 (Promtail pipeline 우회)
# 로그 파일을 직접 Loki Push API로 전송
curl -X POST http://loki:3100/loki/api/v1/push \
  -H 'Content-Type: application/json' \
  -d '{
    "streams": [{
      "stream": {"app": "ai-service", "namespace": "public-saas"},
      "values": [["1709913600000000000", "{\"level\":\"info\",\"action\":\"RECOVERED\"}"]]
    }]
  }'
```

---

### Q12. Grafana 알림(Unified Alerting)을 AlertManager와 연동하는 방법은?

```yaml
# Grafana Unified Alerting → AlertManager 연동 설정
# grafana.ini
[unified_alerting]
enabled = true
# AlertManager URL
alertmanager_config_poll_interval = 60s

# Contact Points 설정 (Grafana UI 또는 API)
# POST http://grafana:3000/api/v1/provisioning/contact-points
```

```json
// AlertManager Contact Point 설정 (슬랙 예시)
{
  "name": "slack-ops",
  "type": "slack",
  "settings": {
    "url": "${SLACK_WEBHOOK_URL}",
    "channel": "#ops-alerts",
    "title": "{{ template \"slack.default.title\" . }}",
    "text": "{{ range .Alerts }}*Alert:* {{ .Annotations.summary }}\\n*Severity:* {{ .Labels.severity }}\\n{{ end }}"
  }
}
```

**AlertManager 라우팅 설정:**

```yaml
# alertmanager.yml — CSAP D-06: 침해사고 알림 체계
route:
  group_by: ['namespace', 'alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'default'
  routes:
    # CRITICAL 알림 — 즉시 호출 (CSAP D-06.3: 72시간 내 보고)
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
      continue: true  # 다음 라우팅도 처리

    # 보안 이벤트 — 보안팀 전용 채널
    - match:
        alertname: SecurityIncident
      receiver: 'security-team-slack'

    # 테넌트 SLO 위반 — 해당 테넌트 담당자
    - match_re:
        tenant_id: '.+'
      receiver: 'tenant-ops'
      group_by: ['tenant_id', 'alertname']

receivers:
  - name: 'default'
    slack_configs:
      - api_url: '${SLACK_OPS_WEBHOOK}'
        channel: '#monitoring'

  - name: 'pagerduty-critical'
    pagerduty_configs:
      - service_key: '${PAGERDUTY_KEY}'
        severity: critical

  - name: 'security-team-slack'
    slack_configs:
      - api_url: '${SLACK_SECURITY_WEBHOOK}'
        channel: '#security-alerts'
```

---

### Q13. 여러 서비스의 로그를 하나의 패널에서 통합하는 방법은?

```logql
# 방법 1: 정규표현식 스트림 선택자
{namespace="public-saas", app=~"ai-service|compliance-service|security-service"}
| json
| level="error"
| line_format "[{{.app}}] {{.action}}: {{.message}}"

# 방법 2: 테넌트별 로그 통합 (멀티테넌시)
{namespace="public-saas"}
| json tenantId, level, action, message
| tenantId="tenant-123"
| line_format "{{.level}} [{{.app}}] {{.message}}"

# 방법 3: 트레이스 ID 기반 통합 (분산 추적 연동)
{namespace="public-saas"}
| json traceId, spanId, level, message
| traceId="4bf92f3577b34da6a3ce929d0e0e4736"
```

**Grafana Logs 패널 설정:**

```json
{
  "type": "logs",
  "title": "전체 서비스 에러 로그",
  "datasource": "Loki",
  "targets": [{
    "expr": "{namespace=\"public-saas\", level=\"error\"} | json | line_format \"[{{.app}}] {{.message}}\"",
    "legendFormat": "",
    "maxLines": 1000
  }],
  "options": {
    "dedupStrategy": "none",
    "enableLogDetails": true,
    "sortOrder": "Descending",
    "wrapLogMessage": true
  }
}
```

---

### Q14. Grafana 대시보드를 Git으로 관리하고 자동 배포하는 방법은?

**GitOps 기반 대시보드 관리 (Flux + ConfigMap):**

```yaml
# k8s/monitoring/dashboards/ai-service-dashboard.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ai-service-dashboard
  namespace: monitoring
  labels:
    grafana_dashboard: "1"  # Grafana Sidecar가 자동 감지
data:
  ai-service-dashboard.json: |
    {
      "title": "AI 서비스 대시보드",
      "uid": "ai-service-main",
      "panels": [...]
    }
```

```bash
# 대시보드 JSON 내보내기 (Grafana API)
curl -s http://admin:admin@grafana:3000/api/dashboards/uid/ai-service-main \
  | jq '.dashboard' > dashboards/ai-service-dashboard.json

# ConfigMap으로 변환 (k8s 배포용)
kubectl create configmap ai-service-dashboard \
  --from-file=ai-service-dashboard.json \
  --dry-run=client -o yaml > k8s/monitoring/dashboards/ai-service-dashboard.yaml
```

**Grafana Provisioning 설정:**

```yaml
# helm/grafana/values.yaml
grafana:
  dashboardProviders:
    dashboardproviders.yaml:
      apiVersion: 1
      providers:
        - name: 'public-saas'
          orgId: 1
          folder: '공공 SaaS'
          type: file
          disableDeletion: true   # Git 관리 대시보드 삭제 방지
          editable: false          # 직접 편집 금지
          options:
            path: /var/lib/grafana/dashboards/public-saas

  dashboardsConfigMaps:
    public-saas: "grafana-dashboards"
```

---

### Q15. LogQL로 PII가 포함된 로그를 실시간 마스킹하는 방법은?

**CSAP D-09 + N2SF 준수 — 로그에서 PII 제거:**

```logql
# 방법 1: replace 함수로 실시간 마스킹
{namespace="public-saas", app="ai-service"}
| json
| line_format "{{.message}}"
# 주민등록번호 마스킹 (999999-9999999 → ****)
| replace `\d{6}-\d{7}` "******-*******"
# 전화번호 마스킹
| replace `\d{3}-\d{4}-\d{4}` "***-****-****"
# 이메일 마스킹
| replace `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}` "****@****.***"

# 방법 2: Promtail에서 수집 시 마스킹 (권장)
# promtail-config.yaml
```

```yaml
# Promtail PII 마스킹 파이프라인 (수집 단계에서 마스킹)
# CSAP D-09, N2SF N-05 준수
pipeline_stages:
  - json:
      expressions:
        message: message
        level: level
        action: action

  - replace:
      expression: '(\d{6}-\d{7})'
      replace: '######-#######'  # 주민등록번호 마스킹

  - replace:
      expression: '([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4})'
      replace: '****@****.***'   # 이메일 마스킹

  - replace:
      expression: '(01[016789]-\d{3,4}-\d{4})'
      replace: '***-****-****'   # 휴대폰 마스킹

  - output:
      source: message
```

---

### Q16. Loki 비용 절감을 위한 로그 압축·보존 정책은?

```yaml
# Loki 최적화 설정 (비용 절감 + CSAP D-10.2 보존 준수)
# helm/loki/values.yaml
loki:
  config:
    # 청크 압축 (저장 비용 절감)
    chunk_store_config:
      chunk_cache_config:
        enable_fifocache: true
        fifocache:
          max_size_bytes: 500MB

    # 압축 알고리즘 (snappy: 빠름, zstd: 높은 압축률)
    ingester:
      chunk_encoding: snappy  # 또는 zstd (압축률 2배, CPU 10% 더 사용)
      chunk_idle_period: 30m
      chunk_retain_period: 30s
      max_chunk_age: 1h

    # 보존 정책 계층화
    table_manager:
      retention_deletes_enabled: true
      retention_period: 8760h  # 1년 (CSAP D-10.2 최소 요건)

    # 쿼리 제한 (비용 폭증 방지)
    limits_config:
      max_query_series: 5000
      max_query_lookback: 8760h  # 1년까지 쿼리 허용
      ingestion_rate_mb: 16      # 테넌트별 수집 속도 제한
      per_stream_rate_limit: 3MB # 스트림별 속도 제한
```

**로그 수준별 보존 전략:**

```yaml
# DEBUG 로그는 7일만 보존 (비용 절감)
# INFO 로그는 90일 보존
# WARN/ERROR 로그는 1년 보존 (CSAP D-10.2)
# AUDIT 로그는 1년 보존 (CSAP D-06.4)

# Promtail 레이블로 보존 정책 구분
scrape_configs:
  - job_name: kubernetes-pods
    pipeline_stages:
      - json:
          expressions:
            level: level
      # 로그 레벨에 따른 보존 클래스 레이블 추가
      - template:
          source: level
          template: |
            {{ if eq .Value "debug" }}short-term
            {{ else if eq .Value "info" }}medium-term
            {{ else }}long-term{{ end }}
      - labels:
          retention_class: ""  # 위 template 결과 적용
```

---

### Q17. Grafana Tempo에서 TraceQL로 특정 조건의 트레이스를 찾는 방법은?

```promql
# TraceQL 기본 문법 — 조건 검색

# 1. 특정 서비스의 에러 트레이스 찾기
{resource.service.name="ai-service"} | status=error

# 2. 느린 요청 찾기 (P99 이상)
{resource.service.name="ai-service"} | duration > 2s

# 3. 특정 속성을 가진 트레이스
{resource.service.name="ai-service" && span.tenant.id="tenant-123"} | duration > 1s

# 4. 특정 오류 코드를 가진 트레이스
{span.http.status_code=500} | status=error

# 5. 특정 엔드포인트의 트레이스
{span.http.route="/api/v1/ai/rag/query"} | duration > 500ms

# 6. 여러 조건 복합
{
  resource.service.name="ai-service" &&
  span.http.method="POST"
} | duration > 1s | status=error

# 7. 특정 시간대의 느린 트레이스
{resource.service.name="ai-service"} | duration > 3s

# 8. 집계 함수 사용
count_over_time({resource.service.name="ai-service"} | status=error [5m])

# 레이턴시 P99 계산
histogram_over_time({resource.service.name=~".*"} [5m]) | quantile_over_time(0.99, duration, 1m)
```

---

## Tempo/Pyroscope 심화

### Q18. 분산 추적에서 Span이 끊어지는 원인과 해결 방법은?

**Span 끊어짐 유형:**

| 유형 | 원인 | 해결책 |
|------|------|--------|
| 루트 Span 없음 | 진입 서비스가 추적 미시작 | OTel 자동 계측 추가 |
| 자식 Span 끊김 | 컨텍스트 전파 누락 | W3C TraceContext 헤더 전달 |
| 서비스 간 끊김 | 비동기 호출에서 컨텍스트 손실 | BullMQ/Kafka 헤더 전달 |
| 샘플링 불일치 | 업스트림 샘플링 != 다운스트림 | 헤드 기반 샘플링 통일 |

**컨텍스트 전파 구현:**

```typescript
// ✅ HTTP 클라이언트 — OTel 컨텍스트 자동 전파
import { context, propagation } from '@opentelemetry/api';

async function callDownstreamService(url: string, body: object): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // W3C TraceContext 헤더 자동 주입 (traceparent, tracestate)
  propagation.inject(context.active(), headers);

  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// ✅ BullMQ — 비동기 큐에서 컨텍스트 전파
import { Queue } from 'bullmq';
import { context, propagation } from '@opentelemetry/api';

async function enqueueJob(queue: Queue, data: object): Promise<void> {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier); // 현재 컨텍스트를 carrier에 주입

  await queue.add('process-rag', {
    ...data,
    _otelContext: carrier,  // 큐 메시지에 컨텍스트 포함
  });
}

// Worker에서 컨텍스트 복원
async function processJob(job: Job): Promise<void> {
  const parentContext = propagation.extract(
    context.active(),
    job.data._otelContext ?? {}  // 큐 메시지에서 컨텍스트 복원
  );

  await context.with(parentContext, async () => {
    // 이 블록 내 모든 Span은 올바른 부모 Span과 연결됨
    await processRAGRequest(job.data);
  });
}
```

**Span 끊김 진단:**

```bash
# 특정 TraceID의 전체 Span 트리 확인
curl 'http://tempo:3100/api/traces/{TRACE_ID}' | jq '.resourceSpans[].scopeSpans[].spans[] | {name: .name, parentSpanId: .parentSpanId, traceId: .traceId}'

# 부모 없는 고아 Span 찾기 (TraceQL)
# {span.parentSpanId=""} | status=ok  -- 루트 Span만 조회
```

---

### Q19. Tempo에서 특정 서비스의 P99 레이턴시가 갑자기 증가했습니다. 분석 방법은?

**단계별 분석 절차:**

```bash
# 1단계: Prometheus에서 P99 급증 시점 특정
# PromQL
histogram_quantile(0.99,
  sum by (le) (
    rate(http_request_duration_seconds_bucket{job="ai-service"}[1m])
  )
)

# 2단계: 급증 시점 직전/이후 트레이스 비교
# Tempo TraceQL — 느린 트레이스 목록
{resource.service.name="ai-service"} | duration > 2s

# 3단계: 느린 트레이스에서 가장 오래 걸린 Span 찾기
# Grafana Tempo 서비스 그래프에서 서비스 간 레이턴시 확인
```

**TraceQL 상세 분석:**

```promql
# 서비스 내부 Span 중 느린 것 찾기
{resource.service.name="ai-service" && name=~".*"} | duration > 500ms

# DB 쿼리가 원인인지 확인 (Prisma OTel 계측)
{span.db.system="postgresql"} | duration > 200ms

# 외부 AI API 호출이 원인인지 확인
{span.http.url=~".*ollama.*|.*openai.*"} | duration > 1s

# 특정 테넌트에서만 느린지 확인
{resource.service.name="ai-service" && span.tenant.id="tenant-abc"} | duration > 1s
```

**Pyroscope 연동 — 느린 함수 찾기:**

```bash
# P99 급증 시점의 CPU 프로파일 조회
# Pyroscope API
curl 'http://pyroscope:4040/render?query=process_cpu:cpu:nanoseconds:cpu:nanoseconds{service_name="ai-service"}&from=now-1h&until=now&format=json'

# Grafana Pyroscope 패널에서 시간 범위를 P99 급증 시점으로 설정
# → Flame Graph에서 가장 많은 CPU를 사용하는 함수 확인
```

---

### Q20. OTel Collector를 사용해서 여러 서비스의 트레이스를 중앙화하는 방법은?

```yaml
# OTel Collector 설정 — 트레이스 중앙화
# k8s/monitoring/otel-collector-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: otel-collector-config
  namespace: monitoring
data:
  config.yaml: |
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317  # gRPC 수신
          http:
            endpoint: 0.0.0.0:4318  # HTTP 수신

    processors:
      batch:
        timeout: 1s
        send_batch_size: 1024

      # 테넌트 레이블 추가 (멀티테넌시)
      resource:
        attributes:
          - key: cluster
            value: "public-saas-prod"
            action: upsert

      # PII 마스킹 (CSAP D-09, N2SF)
      transform:
        trace_statements:
          - context: span
            statements:
              # 사용자 ID를 해시로 대체
              - set(attributes["user.id"], SHA256(attributes["user.id"]))
              # 이메일 마스킹
              - replace_pattern(attributes["user.email"], "[a-zA-Z0-9._%+-]+@", "****@")

      # 샘플링 (비용 절감)
      tail_sampling:
        decision_wait: 10s
        num_traces: 100
        expected_new_traces_per_sec: 10
        policies:
          - name: errors-policy
            type: status_code
            status_code: {status_codes: [ERROR]}  # 에러는 100% 샘플링
          - name: slow-traces-policy
            type: latency
            latency: {threshold_ms: 1000}  # 1초 이상 100% 샘플링
          - name: probabilistic-policy
            type: probabilistic
            probabilistic: {sampling_percentage: 10}  # 나머지 10% 샘플링

    exporters:
      otlp/tempo:
        endpoint: tempo.monitoring.svc.cluster.local:4317
        tls:
          insecure: false  # TLS 사용 (D-09)

      prometheus:
        endpoint: 0.0.0.0:8889  # OTel 메트릭 노출

    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [batch, resource, transform, tail_sampling]
          exporters: [otlp/tempo]
        metrics:
          receivers: [otlp]
          processors: [batch, resource]
          exporters: [prometheus]
```

---

### Q21. Pyroscope Flame Graph에서 핫 함수를 찾고 최적화하는 방법은?

**Flame Graph 읽는 방법:**

```
각 박스 = 함수 호출 스택
박스 너비 = CPU 시간 비율 (넓을수록 오래 실행)
박스 높이 = 호출 깊이 (위가 호출자, 아래가 피호출자)
색상 = 언어/라이브러리 구분 (빨간색 = 자주 호출)

핫 함수 찾기: 가장 넓은 박스 = 가장 많은 CPU 사용
```

**Pyroscope API로 핫 함수 추출:**

```bash
# 서비스별 CPU 프로파일 조회
curl -G 'http://pyroscope:4040/render' \
  --data-urlencode 'query=process_cpu:cpu:nanoseconds:cpu:nanoseconds{service_name="ai-service"}' \
  --data-urlencode 'from=now-30m' \
  --data-urlencode 'until=now' \
  --data-urlencode 'format=json' \
  | jq '.flamebearer.names[:10]'  # 상위 10개 함수

# 특정 함수의 CPU 점유율 시계열 조회
curl -G 'http://pyroscope:4040/render' \
  --data-urlencode 'query=process_cpu:cpu:nanoseconds:cpu:nanoseconds{service_name="ai-service",function_name="cosineSimilarity"}' \
  --data-urlencode 'from=now-1h' \
  --data-urlencode 'until=now' \
  --data-urlencode 'format=json'
```

**Node.js 프로파일링 코드 계측:**

```typescript
// Pyroscope Node.js SDK 연동
import Pyroscope from '@pyroscope/nodejs';

// 서비스 시작 시 프로파일러 활성화
Pyroscope.init({
  serverAddress: 'http://pyroscope.monitoring.svc.cluster.local:4040',
  appName: 'ai-service',
  tags: {
    version: process.env.APP_VERSION ?? '1.0.0',
    env: process.env.NODE_ENV ?? 'production',
    tenant: 'system',  // 테넌트별 프로파일 분리
  },
  // CPU + 힙 메모리 동시 프로파일링
  profileTypes: ['cpu', 'heap', 'wall'],
});

Pyroscope.start();
```

**최적화 사례 — cosineSimilarity 함수:**

`platform/services/ai-service/src/lib/vector-store.ts`의 `cosineSimilarity` 함수는 모든 청크에 대해 반복 호출됩니다.

```typescript
// 최적화 전 — 순수 TypeScript (Pyroscope에서 핫 함수로 식별)
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dotProduct += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 최적화 후 — 조기 종료 및 TypedArray 활용
function cosineSimilarityOptimized(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0, normA = 0, normB = 0;
  const len = a.length;
  // SIMD 친화적 루프 언롤링
  for (let i = 0; i < len; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}
```

---

### Q22. CPU 프로파일과 메모리 프로파일의 차이와 각각 언제 사용하나요?

| 구분 | CPU 프로파일 | 메모리 프로파일 |
|------|-------------|----------------|
| 측정 대상 | 함수 실행 시간 | 힙 메모리 할당량 |
| 사용 시나리오 | 레이턴시 높음, CPU 100% | 메모리 누수, OOM |
| 샘플링 방식 | 주기적 스택 스냅샷 | 할당 이벤트 기록 |
| 오버헤드 | 낮음 (2~5%) | 중간 (5~10%) |
| Pyroscope 타입 | `process_cpu:cpu` | `process_memory:alloc_objects` |

**CPU 프로파일 수집:**

```bash
# Node.js CPU 프로파일 30초 수집
curl -X POST 'http://pyroscope:4040/ingest' \
  --data-urlencode 'name=ai-service.cpu' \
  --data-urlencode 'from=now' \
  --data-urlencode 'until=now+30s' \
  --data-urlencode 'sampleRate=100'  # 100 Hz 샘플링

# Grafana Pyroscope에서 CPU 타입 선택
# Query: process_cpu:cpu:nanoseconds:cpu:nanoseconds{service_name="ai-service"}
```

**메모리 프로파일 수집:**

```bash
# Node.js 힙 스냅샷 (메모리 누수 분석)
# 정상 상태 스냅샷
kill -USR1 $(pgrep -f ai-service)  # V8 힙 스냅샷 트리거

# Pyroscope 메모리 프로파일 쿼리
# Query: process_memory:alloc_objects:count:space:bytes{service_name="ai-service"}

# 메모리 누수 진단 — 두 시점 비교 (Diff 프로파일)
# Pyroscope UI: Comparison 모드 → Before vs After 시점 선택
```

---

### Q23. Tempo와 Loki를 연결해서 트레이스에서 로그로 드릴다운하는 방법은?

**설정 방법:**

```yaml
# Grafana 데이터소스 연동 설정 (provisioning)
# grafana/provisioning/datasources/loki.yaml
apiVersion: 1
datasources:
  - name: Loki
    type: loki
    url: http://loki:3100
    jsonData:
      # Tempo 트레이스에서 Loki 로그로 연결 (드릴다운)
      derivedFields:
        - datasourceName: Tempo
          datasourceUid: tempo-uid
          matcherRegex: '"traceId":"([a-f0-9]+)"'  # 로그에서 TraceID 추출
          name: TraceID
          url: '$${__value.raw}'  # Tempo 트레이스 링크

  - name: Tempo
    type: tempo
    url: http://tempo:3100
    jsonData:
      # Loki 로그에서 Tempo 트레이스로 연결
      tracesToLogsV2:
        datasourceUid: loki-uid
        spanStartTimeShift: '-1m'
        spanEndTimeShift: '1m'
        filterByTraceID: true
        filterBySpanID: false
        customQuery: true
        query: '{namespace="${__tags.namespace}", app="${__tags.service.name}"} | json | traceId="${__trace.traceId}"'
```

**서비스 코드에서 TraceID 로그 포함:**

```typescript
// OTel TraceID를 로그에 자동 포함
import { trace, context } from '@opentelemetry/api';
import { FastifyInstance } from 'fastify';

export function setupTraceIdLogging(app: FastifyInstance): void {
  app.addHook('onRequest', (request, reply, done) => {
    const span = trace.getActiveSpan();
    const spanContext = span?.spanContext();

    if (spanContext) {
      // 모든 로그에 traceId, spanId 자동 포함
      request.log = request.log.child({
        traceId: spanContext.traceId,    // Tempo 연동 키
        spanId: spanContext.spanId,
      });
    }
    done();
  });
}

// 로그 출력 예시 (이 형식이어야 Loki에서 TraceID로 파싱 가능)
// {"level":"info","traceId":"4bf92f3577b34da6a3ce929d0e0e4736","spanId":"a3ce929d","action":"RAG_QUERY"}
```

---

### Q24. Exemplar를 활성화해서 메트릭과 트레이스를 연결하는 방법은?

**Exemplar란?** 메트릭 데이터 포인트에 트레이스 ID를 첨부하여, Grafana에서 메트릭 급등 시점의 실제 트레이스로 바로 이동할 수 있는 기능입니다.

**서비스 코드에서 Exemplar 추가:**

```typescript
// Prometheus 메트릭에 Exemplar 추가 (OTel 자동 계측)
import { Histogram } from 'prom-client';
import { trace } from '@opentelemetry/api';

const requestDuration = new Histogram({
  name: 'api_request_duration_seconds',
  help: 'API 요청 처리 시간',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

// 요청 처리 완료 시 Exemplar 포함
function recordRequestDuration(
  method: string,
  route: string,
  statusCode: number,
  duration: number,
): void {
  const span = trace.getActiveSpan();
  const spanContext = span?.spanContext();

  requestDuration.observe(
    { method, route, status_code: String(statusCode) },
    duration,
    // Exemplar — 이 데이터 포인트와 연결된 트레이스 ID
    spanContext ? {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
    } : undefined,
  );
}
```

**Prometheus Exemplar 활성화:**

```yaml
# prometheus.yml
global:
  # Exemplar 저장 활성화
  feature_flags:
    - exemplar-storage

storage:
  exemplars:
    max_exemplars: 100000  # 최대 10만개 Exemplar 저장
```

**Grafana에서 Exemplar 사용:**

```
1. 메트릭 패널에서 P99 레이턴시 그래프 표시
2. 그래프에서 급등 지점에 다이아몬드 아이콘(♦) 표시 = Exemplar
3. 다이아몬드 클릭 → "View in Tempo" 링크로 트레이스 바로 이동
4. 느린 요청의 정확한 Span 트리 분석
```

---

### Q25. 관측가능성 비용을 줄이는 5가지 핵심 전략은?

#### 전략 1: 스마트 샘플링 (트레이스 비용 80% 절감)

```yaml
# OTel Collector Tail-based 샘플링
tail_sampling:
  policies:
    - name: errors-100pct
      type: status_code
      status_code: {status_codes: [ERROR]}  # 에러 100%
    - name: slow-100pct
      type: latency
      latency: {threshold_ms: 2000}          # 2초+ 100%
    - name: normal-5pct
      type: probabilistic
      probabilistic: {sampling_percentage: 5} # 정상 트레이스 5%
```

#### 전략 2: 로그 레벨 최적화 (로그 비용 70% 절감)

```typescript
// 운영 환경: INFO 이상만 기록
// 개발 환경: DEBUG 포함 전체 기록
const LOG_LEVEL = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// 성능 민감한 경로에서는 로그 조건부 실행
if (logger.isLevelEnabled('debug')) {
  logger.debug({ embedding: embedding.slice(0, 5) }, '임베딩 벡터 샘플'); // 전체 벡터 로깅 금지
}
```

#### 전략 3: 메트릭 카디널리티 제어 (Prometheus 비용 50% 절감)

```yaml
# 불필요한 레이블 droplabel
prometheus.yml:
  global:
    external_labels:
      cluster: 'prod'  # 공통 레이블은 external_labels 사용

  scrape_configs:
    - job_name: 'ai-service'
      metric_relabel_configs:
        - action: labeldrop
          regex: 'pod|container|uid'  # k8s 고카디널리티 레이블 제거
```

#### 전략 4: Recording Rule 적극 활용 (쿼리 비용 60% 절감)

```yaml
# 자주 사용하는 복잡한 쿼리를 Recording Rule로 사전 계산
# → 대시보드 쿼리 시간 단축 + Prometheus CPU 절감
rules:
  - record: job:slo_error_rate:5m
    expr: |
      sum by (job) (rate(api_requests_total{status_code=~"5.."}[5m]))
      /
      sum by (job) (rate(api_requests_total[5m]))
```

#### 전략 5: 데이터 보존 계층화 (저장 비용 65% 절감)

```
Hot Storage  (Prometheus/Loki): 7~15일   → 빠른 SSD, 높은 비용
Warm Storage (Thanos/Loki S3):  90일     → 중간 HDD, 중간 비용
Cold Storage (Object Storage):  1년+     → 저렴한 S3, 낮은 비용

비용 비교:
Hot: 1 TB/월 = 100,000원
Warm: 1 TB/월 = 20,000원
Cold: 1 TB/월 = 3,000원
```

**비용 모니터링 대시보드 PromQL:**

```promql
# Loki 수집 속도 (비용 직결)
sum(rate(loki_distributor_bytes_received_total[1h])) by (namespace)

# Prometheus TSDB 크기
prometheus_tsdb_head_chunks_storage_size_bytes

# Tempo 트레이스 수
sum(rate(tempo_ingester_traces_created_total[1h]))

# 예상 월 비용 계산 (GB 단위)
sum(prometheus_tsdb_head_chunks_storage_size_bytes) / 1024 / 1024 / 1024
```

---

## 부록 A: PromQL/LogQL/TraceQL 빠른 참조

### 핵심 PromQL 패턴

```promql
# SLO 에러율
sum(rate(api_requests_total{status_code=~"5.."}[5m])) / sum(rate(api_requests_total[5m]))

# P99 레이턴시
histogram_quantile(0.99, sum by (le) (rate(api_request_duration_seconds_bucket[5m])))

# Apdex 점수
(
  sum(rate(api_request_duration_seconds_bucket{le="0.5"}[5m])) +
  sum(rate(api_request_duration_seconds_bucket{le="2"}[5m]))
) / 2 / sum(rate(api_request_duration_seconds_count[5m]))
```

### 핵심 LogQL 패턴

```logql
# 에러 로그 + JSON 파싱
{namespace="public-saas", level="error"} | json | line_format "{{.action}}: {{.message}}"

# 요청 레이턴시 분포
quantile_over_time(0.99, {app="ai-service"} | json | unwrap duration [5m]) by (tenant_id)

# 특정 사용자 활동 추적 (마스킹 적용)
{namespace="public-saas"} | json | actor=~"user:.*" | line_format "{{.action}} by {{.actor}}"
```

### 핵심 TraceQL 패턴

```promql
# 에러 트레이스
{resource.service.name="ai-service"} | status=error

# 느린 DB 쿼리 찾기
{span.db.system="postgresql"} | duration > 500ms | select(span.db.statement)

# 테넌트별 느린 트레이스
{resource.service.name=~".*" && span.tenant.id=~".+"} | duration > 2s
```

---

*작성: Implementer 에이전트 | 검토: Reviewer 에이전트 | 감리: Auditor 에이전트*  
*최종 수정: 2026-04-13 | 버전: 1.0.0 | Design Ref: MONITORING-FAQ-ADVANCED*
