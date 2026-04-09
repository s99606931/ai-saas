---
sidebar_position: 2
title: SQL/DB 모니터링 가이드
description: PostgreSQL 성능 모니터링 — 슬로우쿼리, 인덱스, 커넥션, 디스크 사용량
---

# SQL/DB 모니터링 가이드

> **대상 독자**: DBA, 백엔드 개발자, 플랫폼 관리자
> **환경**: PostgreSQL 16 + pg_stat_statements + PostgreSQL Exporter + Prometheus + Grafana
> **CSAP 준수**: D-06(감사 로그), D-12(SQL 보안)

---

## 목차

1. [DB 모니터링이 필요한 이유](#1-db-모니터링이-필요한-이유)
2. [PostgreSQL Exporter 설정](#2-postgresql-exporter-설정)
3. [pg_stat_statements 활성화](#3-pg_stat_statements-활성화)
4. [슬로우 쿼리 모니터링](#4-슬로우-쿼리-모니터링)
5. [인덱스 사용률 분석](#5-인덱스-사용률-분석)
6. [커넥션 풀 모니터링](#6-커넥션-풀-모니터링)
7. [디스크 사용량 모니터링](#7-디스크-사용량-모니터링)
8. [복제 상태 모니터링](#8-복제-상태-모니터링)
9. [Grafana 대시보드 사용법](#9-grafana-대시보드-사용법)
10. [자주 묻는 질문](#10-자주-묻는-질문)

---

## 1. DB 모니터링이 필요한 이유

### 1.1 공공기관 SaaS에서의 DB 모니터링

- **CSAP D-12 준수**: SQL 쿼리 성능 모니터링 및 최적화 의무
- **CSAP D-06 준수**: DB 접근 감사 로그 수집
- **장애 예방**: 슬로우쿼리, 커넥션 고갈, 디스크 부족 사전 감지
- **성능 최적화**: 인덱스 미사용, 풀 스캔 쿼리 발견

### 1.2 모니터링 대상

| 영역 | 주요 지표 | 임계값 |
|------|---------|--------|
| **쿼리 성능** | 실행 시간, 호출 횟수, 행 수 | 5초 초과 = 슬로우 |
| **인덱스** | 인덱스 사용률, 풀 스캔 빈도 | 30% 미만 = 경고 |
| **커넥션** | 활성 연결 수, 대기 연결 수 | 80개 초과 = 경고 |
| **디스크** | 테이블/인덱스 크기, WAL 크기 | 80% = 경고 |
| **복제** | 복제 지연, 슬롯 상태 | 1분 지연 = 경고 |

---

## 2. PostgreSQL Exporter 설정

### 2.1 시크릿 생성

```bash
# PostgreSQL 접속 정보를 Kubernetes Secret으로 생성
kubectl create secret generic postgres-exporter-secret \
  --namespace monitoring \
  --from-literal=DATA_SOURCE_NAME="postgresql://saas_monitor:monitor_pass@saas-postgres-postgresql.saas-platform.svc.cluster.local:5432/saas_platform?sslmode=disable"
```

:::caution 보안 주의
모니터링 전용 읽기 전용 사용자를 생성하여 사용하세요:
```sql
-- PostgreSQL에서 모니터링 전용 사용자 생성
CREATE USER saas_monitor WITH PASSWORD 'monitor_pass';
GRANT pg_monitor TO saas_monitor;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO saas_monitor;
```
:::

### 2.2 Exporter 설치

```bash
# PostgreSQL Exporter Helm 설치
helm upgrade --install postgres-exporter prometheus/prometheus-postgres-exporter \
  --namespace monitoring \
  --values infra/monitoring/postgres-exporter/values.yaml \
  --timeout 5m --wait
```

### 2.3 설치 확인

```bash
# Pod 상태 확인
kubectl get pods -n monitoring -l app.kubernetes.io/name=prometheus-postgres-exporter

# 메트릭 수집 확인
kubectl port-forward -n monitoring svc/postgres-exporter-prometheus-postgres-exporter 9187:80 &
curl -s http://localhost:9187/metrics | head -20
```

---

## 3. pg_stat_statements 활성화

### 3.1 왜 pg_stat_statements가 필요한가?

`pg_stat_statements`는 PostgreSQL 확장으로, 실행된 **모든 SQL의 통계**를 수집합니다.
이 확장 없이는 슬로우쿼리를 체계적으로 모니터링할 수 없습니다.

### 3.2 활성화 방법

```bash
# 방법 1: PostgreSQL에 직접 접속하여 활성화
kubectl exec -it saas-postgres-postgresql-0 -n saas-platform -- psql -U saas -d saas_platform

# psql 프롬프트에서:
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
\q
```

```bash
# 방법 2: postgresql.conf에 설정 추가 (영구)
# Helm values에서 설정:
# primary:
#   extendedConfiguration: |
#     shared_preload_libraries = 'pg_stat_statements'
#     pg_stat_statements.max = 10000
#     pg_stat_statements.track = all
```

### 3.3 활성화 확인

```sql
-- pg_stat_statements가 활성화되었는지 확인
SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements';

-- 수집된 쿼리 통계 확인 (상위 10개)
SELECT
  queryid,
  calls,
  total_exec_time / 1000 AS total_sec,
  mean_exec_time / 1000 AS mean_sec,
  rows,
  query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
```

---

## 4. 슬로우 쿼리 모니터링

### 4.1 Grafana에서 슬로우쿼리 확인

1. Grafana 접속 (`http://localhost:30300`)
2. Dashboards > Public SaaS > SQL 모니터링
3. "슬로우 쿼리 Top 10" 패널 확인

### 4.2 Prometheus에서 직접 조회

```promql
# 평균 실행 시간이 1초 이상인 쿼리
pg_stat_statements_mean_exec_time_seconds > 1

# 총 실행 시간 기준 상위 쿼리
topk(10, pg_stat_statements_total_exec_time_seconds)

# 5초 이상 슬로우쿼리 알림 (사전 구성됨)
pg_slow_queries_max_exec_time_seconds > 5
```

### 4.3 슬로우쿼리 해결 방법

슬로우쿼리가 발견되면 다음 순서로 분석합니다:

```sql
-- 1. 쿼리 실행 계획 확인
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM users WHERE email = 'test@example.com';

-- 2. 시퀀셜 스캔이 보이면 인덱스 추가 검토
-- "Seq Scan" → 인덱스 필요
-- "Index Scan" → 정상

-- 3. 인덱스 추가
CREATE INDEX idx_users_email ON users(email);

-- 4. 쿼리 통계 초기화 (선택적)
SELECT pg_stat_statements_reset();
```

---

## 5. 인덱스 사용률 분석

### 5.1 인덱스 사용률 확인

```sql
-- 테이블별 인덱스 사용률
SELECT
  schemaname,
  relname AS table_name,
  seq_scan,
  idx_scan,
  CASE WHEN (seq_scan + idx_scan) > 0
    THEN round(100.0 * idx_scan / (seq_scan + idx_scan), 1)
    ELSE 0
  END AS index_usage_pct
FROM pg_stat_user_tables
ORDER BY (seq_scan + idx_scan) DESC;
```

### 5.2 Prometheus 메트릭

```promql
# 인덱스 사용률 30% 미만 테이블 (알림 트리거)
pg_index_usage_index_usage_ratio < 0.3

# 시퀀셜 스캔 빈도
rate(pg_stat_user_tables_seq_scan[5m])

# 인덱스 스캔 빈도
rate(pg_stat_user_tables_idx_scan[5m])
```

### 5.3 미사용 인덱스 발견

```sql
-- 한 번도 사용되지 않은 인덱스
SELECT
  schemaname,
  relname AS table_name,
  indexrelname AS index_name,
  idx_scan AS times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## 6. 커넥션 풀 모니터링

### 6.1 커넥션 수 확인

```sql
-- 현재 연결 상태
SELECT
  state,
  count(*) AS count
FROM pg_stat_activity
GROUP BY state;

-- 상태별 의미:
-- active:              쿼리 실행 중
-- idle:                대기 중
-- idle in transaction: 트랜잭션 열린 채 대기 (주의!)
-- disabled:            비활성화
```

### 6.2 Prometheus 메트릭

```promql
# 전체 연결 수
pg_stat_activity_count

# 상태별 연결 수
pg_stat_activity_count{state="active"}
pg_stat_activity_count{state="idle"}
pg_stat_activity_count{state="idle in transaction"}

# 최대 연결 수
pg_settings_max_connections

# 연결 사용률 (%)
pg_stat_activity_count / pg_settings_max_connections * 100
```

### 6.3 커넥션 고갈 예방

```sql
-- 오래된 idle 연결 종료 (10분 이상)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < NOW() - INTERVAL '10 minutes';

-- idle in transaction 강제 종료 (5분 이상)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND state_change < NOW() - INTERVAL '5 minutes';
```

---

## 7. 디스크 사용량 모니터링

### 7.1 테이블/인덱스 크기

```sql
-- 테이블 크기 Top 10
SELECT
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  pg_size_pretty(pg_relation_size(relid)) AS data_size,
  pg_size_pretty(pg_indexes_size(relid)) AS index_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;

-- 데이터베이스 전체 크기
SELECT pg_size_pretty(pg_database_size('saas_platform'));
```

### 7.2 Prometheus 메트릭

```promql
# DB 전체 크기
pg_database_size_bytes{datname="saas_platform"}

# 테이블 크기
pg_total_relation_size_bytes
```

### 7.3 VACUUM 상태

```sql
-- 마지막 VACUUM/ANALYZE 시간
SELECT
  relname,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze,
  n_dead_tup
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
```

---

## 8. 복제 상태 모니터링

### 8.1 복제 지연 확인

```sql
-- 스트리밍 복제 상태
SELECT
  pid,
  usename,
  application_name,
  client_addr,
  state,
  sent_lsn,
  write_lsn,
  flush_lsn,
  replay_lsn,
  pg_wal_lsn_diff(sent_lsn, replay_lsn) AS replication_lag_bytes
FROM pg_stat_replication;
```

### 8.2 Prometheus 메트릭

```promql
# 복제 지연 (바이트)
pg_replication_lag_bytes

# 복제 슬롯 상태
pg_replication_slots_active
```

---

## 9. Grafana 대시보드 사용법

### 9.1 SQL 모니터링 대시보드

경로: Dashboards > Public SaaS > SQL 모니터링

대시보드 패널 구성:

| 패널 | 내용 | 주의 기준 |
|------|------|----------|
| 슬로우쿼리 Top 10 | 평균 실행 시간 기준 | 5초 초과 |
| 쿼리 호출 빈도 | 초당 쿼리 수 | - |
| 인덱스 사용률 | 테이블별 사용률 | 30% 미만 |
| 활성 연결 수 | 현재 DB 연결 | 80개 초과 |
| DB 크기 추이 | 데이터베이스 전체 크기 | - |
| Dead Tuple 수 | VACUUM 필요 여부 | 100만 초과 |
| 복제 지연 | 바이트 단위 | 1MB 초과 |

### 9.2 알림 동작

다음 알림이 자동 구성되어 있습니다:

| 알림 | 조건 | 수신자 |
|------|------|--------|
| SlowQueryDetected | 5초 초과 쿼리 | DBA팀 |
| LowIndexUsage | 인덱스 사용률 30% 미만 30분 지속 | DBA팀 |
| PostgreSQLHighConnectionCount | 연결 수 80개 초과 5분 지속 | DBA팀 |

---

## 10. 자주 묻는 질문

**Q: pg_stat_statements가 성능에 영향을 주나요?**
A: 오버헤드는 무시할 수 있는 수준입니다 (1~5%). 프로덕션 환경에서도 안전하게 사용할 수 있습니다.

**Q: 슬로우쿼리 기준 5초는 어디서 정하나요?**
A: `infra/monitoring/alerting-rules.yaml`의 `SlowQueryDetected` 규칙에서 변경할 수 있습니다.

**Q: 쿼리 통계를 초기화하려면?**
A: `SELECT pg_stat_statements_reset();` 실행. 주의: 모든 통계가 삭제됩니다.

**Q: PostgreSQL Exporter가 연결 실패하면?**
A: Secret의 DATA_SOURCE_NAME을 확인하세요. 호스트명, 포트, 사용자 권한이 올바른지 검증합니다.

---

*이 문서는 MTU-N36 SQL/DB 모니터링 특화 가이드입니다.*
*CSAP D-06/D-12 요건을 준수합니다.*
