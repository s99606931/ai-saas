# SQL 쿼리 모니터링 가이드 (PostgreSQL + Redis)

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: Implementer Agent
> **MTU**: MTU-N24 | **CSAP**: D-06 (감사로그), D-12 (개발보안·PII 마스킹)
> **배포 방식**: k3s + Helm Chart (Docker Compose 사용 안 함)

---

## 1. 개요 및 모니터링 대상

공공기관 SaaS 프레임워크는 PostgreSQL과 Redis를 핵심 데이터 계층으로 사용합니다. 이 가이드는 다음 항목의 모니터링 방법을 설명합니다.

| 대상 | 도구 | 주요 지표 |
|------|------|----------|
| PostgreSQL | prometheus-postgres-exporter | 슬로우쿼리, 캐시 히트율, 연결 수, 인덱스 미사용 |
| Redis | prometheus-redis-exporter | 키스페이스 히트율, Eviction, 메모리 사용량 |

**CSAP D-12 요건**: 모니터링 수집 데이터에 PII(개인식별정보)가 포함되지 않도록 SQL 쿼리 본문은 정규화(normalize)된 형식으로만 수집합니다.

---

## 2. PostgreSQL 설정

### 2.1 pg_stat_statements 확장 활성화

슬로우쿼리 통계 수집을 위해 PostgreSQL에 `pg_stat_statements` 확장이 필요합니다.

**postgresql.conf 설정:**

```ini
# 서버 재시작이 필요한 설정
shared_preload_libraries = 'pg_stat_statements'

# 재시작 없이 변경 가능한 설정
pg_stat_statements.track = all          # top(기본값), all, none
pg_stat_statements.max = 10000          # 추적할 최대 쿼리 수
pg_stat_statements.track_utility = on   # DDL 쿼리 포함 여부
pg_stat_statements.save = on            # 재시작 후 통계 보존
```

Kubernetes ConfigMap으로 관리하는 경우:

```bash
# PostgreSQL ConfigMap 수정
kubectl edit configmap postgres-config -n <앱-네임스페이스>

# 수정 후 파드 재시작 (설정 반영)
kubectl rollout restart deployment/postgres -n <앱-네임스페이스>

# 재시작 완료 확인
kubectl rollout status deployment/postgres -n <앱-네임스페이스>
```

**확장 활성화 (파드 내 psql 실행):**

```bash
# PostgreSQL 파드 접속
kubectl exec -it deploy/postgres -n <앱-네임스페이스> -- psql -U postgres

-- 확장 생성 (재시작 후 실행)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 활성화 확인
SELECT name, default_version, installed_version
FROM pg_available_extensions
WHERE name = 'pg_stat_statements';

-- 현재 통계 확인 (상위 5개 슬로우쿼리)
SELECT
  query,
  calls,
  round(mean_exec_time::numeric, 2) AS mean_ms,
  round(total_exec_time::numeric, 2) AS total_ms
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 5;
\q
```

### 2.2 PostgreSQL Exporter Secret 생성

```bash
# 모니터링 전용 사용자 생성 (최소 권한 원칙 — CSAP D-08)
kubectl exec -it deploy/postgres -n <앱-네임스페이스> -- psql -U postgres <<'SQL'
CREATE USER monitor_user WITH PASSWORD 'CHANGE_ME_STRONG' CONNECTION LIMIT 5;
GRANT pg_monitor TO monitor_user;
GRANT CONNECT ON DATABASE saasdb TO monitor_user;
SQL

# Secret 생성
kubectl create secret generic postgres-exporter-secret \
  --namespace monitoring \
  --from-literal=DATA_SOURCE_NAME="postgresql://monitor_user:CHANGE_ME_STRONG@postgres-svc.<앱-네임스페이스>.svc.cluster.local:5432/saasdb?sslmode=disable"

# Secret 생성 확인
kubectl get secret postgres-exporter-secret -n monitoring
```

Exporter 설치 (Secret 생성 후):

```bash
helm upgrade --install postgres-exporter prometheus/prometheus-postgres-exporter \
  --namespace monitoring \
  --values infra/monitoring/postgres-exporter/values.yaml \
  --timeout 5m --wait

# 메트릭 수집 확인
kubectl logs -l app.kubernetes.io/name=prometheus-postgres-exporter -n monitoring --tail=20
```

### 2.3 슬로우쿼리 TOP 20 대시보드 사용법

Grafana에서 "SQL 모니터링 (PostgreSQL + Redis)" 대시보드를 엽니다.

**주요 패널 설명:**

| 패널 이름 | 표시 내용 | 활용 방법 |
|---------|----------|---------|
| 슬로우쿼리 TOP 20 | 평균 실행시간 기준 상위 쿼리 | 5초 초과 쿼리 즉시 개선 |
| 쿼리 호출 빈도 | 초당 호출 횟수 | 과도한 반복 쿼리 탐지 |
| 캐시 히트율 | shared_buffers 히트율 | 95% 미만 시 메모리 증설 검토 |
| 활성 연결 수 | 현재 DB 연결 수 | max_connections 초과 여부 확인 |
| 인덱스 미사용 쿼리 | seq_scan 빈도 높은 테이블 | 인덱스 추가 검토 |

**시간 범위 필터 사용:**

```
Grafana 우측 상단 시간 선택기 → "Last 1 hour" 또는 사용자 정의
자동 새로고침: 30초 간격 권장 (운영 중 슬로우쿼리 실시간 감시)
```

### 2.4 주요 LogQL / PromQL 쿼리 예제

**5초 초과 슬로우쿼리 조회 (PromQL):**

```promql
# 평균 실행시간 5초 초과 쿼리 목록
pg_stat_statements_mean_exec_time_seconds{datname="saasdb"} > 5

# 초당 슬로우쿼리 발생 횟수
rate(pg_stat_statements_calls_total{datname="saasdb"}[5m])
```

**캐시 히트율 < 95% 알림 (PromQL):**

```promql
# 버퍼 캐시 히트율 계산
(
  sum(pg_stat_database_blks_hit{datname="saasdb"})
  /
  (sum(pg_stat_database_blks_hit{datname="saasdb"}) + sum(pg_stat_database_blks_read{datname="saasdb"}))
) * 100

# 95% 미만인 경우만 표시 (알림 조건)
(
  sum(pg_stat_database_blks_hit{datname="saasdb"})
  /
  (sum(pg_stat_database_blks_hit{datname="saasdb"}) + sum(pg_stat_database_blks_read{datname="saasdb"}))
) * 100 < 95
```

**인덱스 미사용 쿼리 탐지 (PromQL):**

```promql
# Sequential Scan 비율이 높은 테이블 탐지
(
  pg_stat_user_tables_seq_scan{datname="saasdb"}
  /
  (pg_stat_user_tables_seq_scan{datname="saasdb"} + pg_stat_user_tables_idx_scan{datname="saasdb"} + 1)
) > 0.7
```

**Loki에서 PostgreSQL 에러 로그 조회 (LogQL):**

```logql
# PostgreSQL 에러 로그 필터
{app="postgres", namespace=~".+"} |= "ERROR" | json

# 슬로우쿼리 로그 (log_min_duration_statement 설정 필요)
{app="postgres"} |~ "duration: [0-9]{4,}" | regexp `duration: (?P<duration>[0-9]+\.[0-9]+) ms`
| duration > 1000
```

---

## 3. Redis 설정

### 3.1 Redis Exporter Secret 생성

```bash
# Secret 생성
kubectl create secret generic redis-exporter-secret \
  --namespace monitoring \
  --from-literal=REDIS_ADDR="redis://redis-svc.<앱-네임스페이스>.svc.cluster.local:6379" \
  --from-literal=REDIS_PASSWORD="CHANGE_ME_STRONG"

# Secret 생성 확인
kubectl get secret redis-exporter-secret -n monitoring

# Exporter 설치
helm upgrade --install redis-exporter prometheus/prometheus-redis-exporter \
  --namespace monitoring \
  --values infra/monitoring/redis-exporter/values.yaml \
  --timeout 5m --wait

# 메트릭 수집 확인
kubectl logs -l app.kubernetes.io/name=prometheus-redis-exporter -n monitoring --tail=20
```

### 3.2 Eviction 알림 설정

Redis Eviction은 메모리 부족 시 데이터가 자동 삭제되는 현상으로, 공공기관 서비스에서 반드시 감지해야 합니다.

**AlertManager Rule 예시:**

```yaml
# infra/monitoring/alerting-rules.yaml에 추가
groups:
  - name: redis-alerts
    rules:
      - alert: RedisEviction
        expr: increase(redis_evicted_keys_total[5m]) > 0
        for: 0m
        labels:
          severity: warning
          csap: D-06
        annotations:
          summary: "Redis Eviction 발생"
          description: "{{ $labels.instance }} — 최근 5분간 {{ $value }}개 키 삭제됨. 메모리 증설 또는 maxmemory-policy 검토 필요"

      - alert: RedisMemoryHigh
        expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Redis 메모리 사용률 85% 초과"
          description: "{{ $labels.instance }} — 메모리 {{ $value | humanizePercentage }} 사용 중"
```

AlertManager 룰 적용:

```bash
kubectl apply -f infra/monitoring/alerting-rules.yaml -n monitoring
kubectl rollout restart deployment/kube-prometheus-stack-alertmanager -n monitoring
```

### 3.3 Keyspace 히트율 모니터링

```promql
# Redis 키스페이스 히트율 (90% 미만 시 캐시 전략 검토)
(
  redis_keyspace_hits_total
  /
  (redis_keyspace_hits_total + redis_keyspace_misses_total + 1)
) * 100

# 히트율 90% 미만 알림 조건
(
  rate(redis_keyspace_hits_total[5m])
  /
  (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m]) + 0.001)
) * 100 < 90

# TTL 만료로 인한 키 삭제 추이
rate(redis_expired_keys_total[5m])
```

Redis 현재 상태를 직접 확인하는 방법:

```bash
# Redis 파드 접속
kubectl exec -it deploy/redis -n <앱-네임스페이스> -- redis-cli -a $REDIS_PASSWORD

# INFO 통계 확인
INFO stats | grep -E "keyspace_hits|keyspace_misses|evicted_keys|expired_keys"
INFO memory | grep -E "used_memory_human|maxmemory_human"

# Keyspace별 키 수 확인
INFO keyspace
\quit
```

---

## 4. CSAP D-12 준수: SQL 쿼리 PII 마스킹 확인

공공기관 시스템에서 수집되는 SQL 쿼리 본문에는 주민등록번호, 이름, 연락처 등의 PII가 포함될 수 있습니다. CSAP D-12 요건에 따라 다음을 확인합니다.

### 4.1 pg_stat_statements 쿼리 정규화 확인

`pg_stat_statements`는 기본적으로 파라미터 값을 `$1`, `$2`로 치환하여 저장합니다. 이 동작을 반드시 확인합니다.

```bash
# PostgreSQL 파드에서 확인
kubectl exec -it deploy/postgres -n <앱-네임스페이스> -- psql -U postgres -c "
SELECT
  queryid,
  left(query, 100) AS query_preview,
  calls
FROM pg_stat_statements
WHERE query ILIKE '%users%'
LIMIT 5;"
```

예상 결과 (PII 포함 안 됨):

```
query_preview
----------------------------------------------
SELECT * FROM users WHERE email = $1           ← 파라미터값 $1로 치환됨 (정상)
UPDATE users SET name = $1 WHERE id = $2       ← 실제 이름 값 없음 (정상)
```

**주의**: `pg_stat_statements.track_planning = on` 상태에서 쿼리 계획에 리터럴이 포함될 수 있습니다. 확인이 필요합니다.

```bash
kubectl exec -it deploy/postgres -n <앱-네임스페이스> -- psql -U postgres -c "
SHOW pg_stat_statements.track_planning;"
```

### 4.2 Prometheus Exporter 수집 메트릭 PII 확인

PostgreSQL Exporter가 수집하는 레이블에 쿼리 원문이 포함되지 않도록 설정을 확인합니다.

```bash
# Exporter values.yaml에서 쿼리 정규화 옵션 확인
cat infra/monitoring/postgres-exporter/values.yaml | grep -i "query\|normalize\|mask"

# 실제 수집 메트릭에서 PII 노출 여부 점검
kubectl port-forward svc/postgres-exporter 9187 -n monitoring &
curl -s http://localhost:9187/metrics | grep pg_stat_statements | head -20
```

PII가 발견된 경우 즉시 `infra/monitoring/postgres-exporter/values.yaml`에서 해당 메트릭 수집을 비활성화하고 운영보안팀에 보고합니다 (CSAP D-12).

---

## 5. 실용적인 PromQL 쿼리 10개

Grafana Explore 또는 대시보드 패널에서 바로 복사하여 사용합니다.

```promql
# [1] PostgreSQL 활성 연결 수
pg_stat_activity_count{datname="saasdb", state="active"}

# [2] PostgreSQL 총 연결 수 (max_connections 대비 비율)
pg_stat_activity_count{datname="saasdb"} / pg_settings_max_connections * 100

# [3] PostgreSQL 초당 트랜잭션 처리량
rate(pg_stat_database_xact_commit_total{datname="saasdb"}[5m])
+ rate(pg_stat_database_xact_rollback_total{datname="saasdb"}[5m])

# [4] PostgreSQL 롤백 비율 (5% 초과 시 애플리케이션 오류 의심)
rate(pg_stat_database_xact_rollback_total{datname="saasdb"}[5m])
/
(rate(pg_stat_database_xact_commit_total{datname="saasdb"}[5m]) + 0.001)
* 100

# [5] PostgreSQL 데이터베이스 크기 (바이트)
pg_database_size_bytes{datname="saasdb"}

# [6] Redis 메모리 사용률
redis_memory_used_bytes / redis_memory_max_bytes * 100

# [7] Redis 초당 명령 처리량
rate(redis_commands_processed_total[5m])

# [8] Redis 연결된 클라이언트 수
redis_connected_clients

# [9] PostgreSQL 대기 중인 잠금 수 (교착상태 전조)
pg_locks_count{mode="ExclusiveLock", granted="false"}

# [10] PostgreSQL 복제 지연 (Primary-Replica 구성 시)
pg_replication_lag
```

---

## 6. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 (MTU-N24 기반) | Implementer Agent |
