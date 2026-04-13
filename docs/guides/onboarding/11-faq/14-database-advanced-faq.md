# 14. 데이터베이스 고급 FAQ

> 대상 독자: 공공기관 SaaS 프레임워크 개발자 (초급~중급)
> 선행 지식: `01-dev-faq.md`, `06-performance-faq.md` 완독
> 인프라 환경: CloudNativePG (CNPG) + Prisma 6 + Redis 7
> 최종 수정: 2026-04-13

---

## 목차

**PostgreSQL 운영** (Q1~Q8)
**Prisma 트러블슈팅** (Q9~Q17)
**성능 최적화** (Q18~Q25)

---

## PostgreSQL 운영

---

### Q1. PostgreSQL 슬로우 쿼리를 탐지하는 방법은?

**상황**: "API가 갑자기 느려졌는데 어떤 쿼리가 문제인지 모르겠습니다."

**원인 분석**: PostgreSQL은 `pg_stat_statements` 확장을 통해 모든 쿼리의 실행 통계를 수집합니다. 이를 분석하면 느린 쿼리를 식별할 수 있습니다.

**단계별 해결 방법**:

먼저 `pg_stat_statements` 확장이 활성화되어 있는지 확인합니다.

```sql
-- 확장 설치 여부 확인
SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements';

-- 미설치 시 설치 (슈퍼유저 권한 필요)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

CNPG 클러스터에서는 `postgresql.conf`에 사전 설정이 필요합니다.

```yaml
# platform/k8s/database/cnpg-cluster.yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: saas-postgres
spec:
  postgresql:
    parameters:
      shared_preload_libraries: "pg_stat_statements"
      pg_stat_statements.max: "10000"
      pg_stat_statements.track: "all"
      pg_stat_statements.track_utility: "true"
      log_min_duration_statement: "1000"  # 1초 이상 쿼리 로깅
```

슬로우 쿼리를 조회합니다.

```sql
-- 평균 실행 시간이 긴 쿼리 TOP 10
SELECT
  round(mean_exec_time::numeric, 2) AS avg_ms,
  round(total_exec_time::numeric / 1000, 2) AS total_sec,
  calls,
  round(stddev_exec_time::numeric, 2) AS stddev_ms,
  rows,
  shared_blks_hit,
  shared_blks_read,
  round(
    100.0 * shared_blks_hit /
    nullif(shared_blks_hit + shared_blks_read, 0),
    2
  ) AS cache_hit_ratio,
  -- 쿼리 앞 200자만 표시
  left(query, 200) AS query_preview
FROM pg_stat_statements
WHERE calls > 10  -- 10회 이상 실행된 쿼리만
ORDER BY mean_exec_time DESC
LIMIT 10;
```

특정 서비스(테넌트)의 쿼리만 필터링합니다.

```sql
-- ai-service 관련 슬로우 쿼리
SELECT
  mean_exec_time AS avg_ms,
  calls,
  query
FROM pg_stat_statements
WHERE query ILIKE '%ai_model%'
  OR query ILIKE '%ai_usage%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- 통계 초기화 (새 측정 시작)
SELECT pg_stat_statements_reset();
```

로그에서 슬로우 쿼리를 실시간으로 확인합니다.

```bash
# CNPG 로그에서 슬로우 쿼리 확인 (log_min_duration_statement=1000ms)
kubectl logs -n database \
  -l cnpg.io/instanceName=saas-postgres-1 \
  --since=10m \
  | grep "duration:"
```

**예방**: 개발 환경에서도 `log_min_duration_statement=500`으로 설정하여 조기에 슬로우 쿼리를 발견합니다.

---

### Q2. VACUUM이 실행되지 않아 테이블이 부풀어 있습니다. 해결 방법은?

**상황**: `pg_stat_user_tables`를 조회하니 `n_dead_tup`이 수백만 건이고, 테이블 크기가 실제 데이터보다 5배 이상 큽니다.

**원인**: PostgreSQL은 UPDATE/DELETE 시 기존 행을 물리적으로 삭제하지 않고 "죽은 행(dead tuple)"으로 표시합니다. VACUUM이 이를 회수합니다. VACUUM이 실행되지 않으면 테이블이 점점 부풀어 오릅니다.

**진단 명령어**:

```sql
-- 테이블별 dead tuple 및 마지막 VACUUM 시간 확인
SELECT
  schemaname,
  relname AS table_name,
  n_live_tup AS live_rows,
  n_dead_tup AS dead_rows,
  round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 2) AS dead_ratio_pct,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000
ORDER BY n_dead_tup DESC;

-- 테이블 실제 크기 대비 부풀음 확인
SELECT
  table_name,
  pg_size_pretty(pg_total_relation_size(table_name::regclass)) AS total_size,
  pg_size_pretty(pg_relation_size(table_name::regclass)) AS table_size,
  pg_size_pretty(
    pg_total_relation_size(table_name::regclass)
    - pg_relation_size(table_name::regclass)
  ) AS index_size
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size(table_name::regclass) DESC
LIMIT 20;
```

**해결 방법**:

```sql
-- 즉시 VACUUM ANALYZE 실행 (서비스 중단 없음)
VACUUM ANALYZE tenant_usage_logs;

-- 더 공격적인 VACUUM (블로트 완전 제거, 잠금 발생 주의)
VACUUM FULL ANALYZE tenant_usage_logs;
-- 주의: VACUUM FULL은 AccessExclusiveLock을 잡습니다.
--       서비스 중단 시간 동안만 실행하십시오.

-- Auto Vacuum 파라미터 조정 (테이블별 오버라이드)
ALTER TABLE tenant_usage_logs SET (
  autovacuum_vacuum_scale_factor = 0.01,  -- 1%만 쌓여도 VACUUM (기본값 0.2)
  autovacuum_analyze_scale_factor = 0.005,
  autovacuum_vacuum_cost_delay = 2ms      -- VACUUM 속도 높임 (기본값 2ms)
);
```

autovacuum이 실행되지 않는 원인을 찾습니다.

```sql
-- autovacuum worker가 실행 중인지 확인
SELECT
  pid,
  state,
  wait_event_type,
  wait_event,
  left(query, 100) AS query
FROM pg_stat_activity
WHERE application_name = 'autovacuum worker';

-- autovacuum 비활성화 여부 확인
SHOW autovacuum;
SHOW autovacuum_max_workers;

-- 장기 트랜잭션이 VACUUM을 막는지 확인
SELECT
  pid,
  now() - xact_start AS duration,
  state,
  left(query, 100) AS query
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY duration DESC
LIMIT 10;
```

장기 트랜잭션이 VACUUM을 막고 있다면 해당 트랜잭션을 종료합니다.

```sql
-- 1시간 이상 실행 중인 트랜잭션 종료
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE now() - xact_start > interval '1 hour'
  AND state != 'idle'
  AND pid != pg_backend_pid();
```

---

### Q3. 락(Lock) 대기로 인한 트랜잭션 타임아웃이 발생합니다. 어떻게 찾고 해결하나요?

**상황**: "ERR: canceling statement due to lock timeout" 오류가 발생합니다.

**락 대기 현황 조회**:

```sql
-- 현재 락 대기 중인 쿼리 목록
SELECT
  blocked.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocked_activity.application_name,
  now() - blocked_activity.query_start AS wait_duration,
  blocking.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocking_activity.state AS blocking_state,
  left(blocked_activity.query, 200) AS blocked_query,
  left(blocking_activity.query, 200) AS blocking_query
FROM pg_catalog.pg_locks blocked
JOIN pg_catalog.pg_stat_activity blocked_activity
  ON blocked.pid = blocked_activity.pid
JOIN pg_catalog.pg_locks blocking
  ON blocking.relation = blocked.relation
  AND blocking.locktype = blocked.locktype
  AND blocked.pid != blocking.pid
JOIN pg_catalog.pg_stat_activity blocking_activity
  ON blocking.pid = blocking_activity.pid
WHERE NOT blocked.granted
ORDER BY wait_duration DESC;
```

**실시간 락 그래프** (누가 누구를 막는지):

```sql
-- 락 체인 시각화
WITH RECURSIVE lock_tree AS (
  -- 시작점: 락을 잡고 있는 프로세스
  SELECT
    blocking.pid AS blocker_pid,
    blocked.pid AS waiter_pid,
    1 AS depth,
    ARRAY[blocking.pid] AS path
  FROM pg_locks blocked
  JOIN pg_locks blocking
    ON blocking.relation = blocked.relation
    AND blocking.locktype = blocked.locktype
    AND blocked.pid != blocking.pid
    AND NOT blocked.granted
    AND blocking.granted

  UNION ALL

  -- 재귀: 대기 체인 추적
  SELECT
    lt.waiter_pid AS blocker_pid,
    blocked.pid AS waiter_pid,
    lt.depth + 1,
    lt.path || lt.waiter_pid
  FROM lock_tree lt
  JOIN pg_locks blocked ON blocked.pid != lt.waiter_pid
  WHERE depth < 10 AND NOT (lt.waiter_pid = ANY(lt.path))
)
SELECT
  blocker_pid,
  a1.query AS blocker_query,
  waiter_pid,
  a2.query AS waiter_query,
  depth
FROM lock_tree
JOIN pg_stat_activity a1 ON a1.pid = blocker_pid
JOIN pg_stat_activity a2 ON a2.pid = waiter_pid;
```

**해결 및 예방**:

```sql
-- 락을 잡고 있는 프로세스 종료 (긴급 상황)
SELECT pg_terminate_backend(blocking_pid);

-- 예방: 락 타임아웃 설정 (Prisma 클라이언트에서)
SET lock_timeout = '5s';
SET statement_timeout = '30s';
```

```typescript
// Prisma에서 락 타임아웃 설정
// Design Ref: §3 락 관리
const result = await prisma.$transaction(async (tx) => {
  // 락 타임아웃 설정 (이 트랜잭션에만 적용)
  await tx.$executeRaw`SET lock_timeout = '3s'`;
  await tx.$executeRaw`SET statement_timeout = '10s'`;

  return await tx.tenantUsageLog.update({
    where: { id: logId },
    data: { processedAt: new Date() },
  });
}, {
  maxWait: 5000,   // 연결 대기 최대 5초
  timeout: 15000,  // 트랜잭션 최대 15초
});
```

---

### Q4. CNPG(CloudNativePG) Standby 노드가 Primary에서 뒤처집니다. 원인과 해결은?

**상황**: 읽기 전용 쿼리를 Standby로 보냈는데 데이터가 오래되었습니다.

**복제 지연 확인**:

```sql
-- Primary 노드에서 실행: Standby 복제 상태 확인
SELECT
  application_name,
  client_addr,
  state,
  sent_lsn,
  write_lsn,
  flush_lsn,
  replay_lsn,
  -- 복제 지연 바이트
  sent_lsn - replay_lsn AS replay_lag_bytes,
  -- 복제 지연 시간
  write_lag,
  flush_lag,
  replay_lag
FROM pg_stat_replication
ORDER BY replay_lag DESC;

-- 현재 WAL 위치
SELECT pg_current_wal_lsn(), pg_current_wal_insert_lsn();
```

```bash
# Standby 노드에서 실행: 수신된 LSN 확인
kubectl exec -n database saas-postgres-2 -- \
  psql -U postgres -c "SELECT pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn(), pg_is_in_recovery();"

# CNPG 클러스터 상태 확인
kubectl get cluster saas-postgres -n database -o yaml | grep -A 20 "status:"
kubectl describe cluster saas-postgres -n database
```

**원인별 해결**:

```bash
# 원인 1: 네트워크 대역폭 부족
# WAL 송신 속도 확인 (Primary에서)
kubectl exec -n database saas-postgres-1 -- \
  psql -U postgres -c "SELECT * FROM pg_stat_replication;"

# 원인 2: Standby의 WAL 적용(replay) 속도 부족
# Standby 노드에서 복제 충돌 확인
kubectl exec -n database saas-postgres-2 -- \
  psql -U postgres -c "SELECT * FROM pg_stat_replication_slots;"

# 복제 충돌 해소 (Hot Standby 충돌 쿼리 강제 종료)
kubectl exec -n database saas-postgres-2 -- \
  psql -U postgres -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE wait_event_type = 'Lock';"

# 원인 3: 슬롯이 꽉 참
kubectl exec -n database saas-postgres-1 -- \
  psql -U postgres -c "
    SELECT slot_name, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS lag
    FROM pg_replication_slots;"
```

CNPG에서 복제 지연 알림을 설정합니다.

```yaml
# platform/k8s/monitoring/alerts/cnpg-alerts.yaml
- alert: CNPGReplicationLag
  expr: |
    cnpg_pg_replication_in_recovery
    AND cnpg_pg_replication_replay_lag_seconds > 30
  for: 5m
  labels:
    severity: warning
    csap_control: D-09
  annotations:
    summary: "CNPG 복제 지연 30초 초과"
    description: "{{ $labels.pod }}: {{ $value }}초 지연"
```

---

### Q5. 대용량 테이블에 인덱스를 추가할 때 서비스를 중단하지 않는 방법은?

**상황**: `tenant_usage_logs` 테이블(1억 행)에 인덱스를 추가해야 하는데, 일반 `CREATE INDEX`는 테이블 잠금을 겁니다.

**해결**: `CREATE INDEX CONCURRENTLY`를 사용합니다. 이 명령어는 테이블 잠금 없이 인덱스를 빌드합니다.

```sql
-- 잘못된 방법: 테이블 잠금 발생 (서비스 중단)
CREATE INDEX idx_usage_tenant_date
ON tenant_usage_logs (tenant_id, created_at);

-- 올바른 방법: 동시 인덱스 생성 (서비스 무중단)
CREATE INDEX CONCURRENTLY idx_usage_tenant_date
ON tenant_usage_logs (tenant_id, created_at DESC);

-- 부분 인덱스: 최근 90일 데이터만 인덱싱 (크기 절감)
CREATE INDEX CONCURRENTLY idx_usage_recent
ON tenant_usage_logs (tenant_id, created_at DESC)
WHERE created_at > CURRENT_DATE - INTERVAL '90 days';

-- 인덱스 생성 진행률 확인
SELECT
  phase,
  blocks_done,
  blocks_total,
  round(100.0 * blocks_done / nullif(blocks_total, 0), 2) AS progress_pct,
  tuples_done,
  tuples_total
FROM pg_stat_progress_create_index
WHERE relid = 'tenant_usage_logs'::regclass;
```

주의사항:

```sql
-- CONCURRENTLY 실패 시 INVALID 상태 인덱스가 남음
-- INVALID 인덱스 확인
SELECT indexname, indisvalid
FROM pg_indexes
JOIN pg_index ON pg_index.indexrelid = (schemaname||'.'||indexname)::regclass
WHERE NOT indisvalid;

-- INVALID 인덱스 제거 후 재시도
DROP INDEX CONCURRENTLY idx_usage_tenant_date;
CREATE INDEX CONCURRENTLY idx_usage_tenant_date
ON tenant_usage_logs (tenant_id, created_at DESC);
```

Prisma 마이그레이션에서 동시 인덱스를 사용하는 방법입니다.

```sql
-- prisma/migrations/20260413_add_usage_index/migration.sql
-- Prisma는 CONCURRENTLY를 자동으로 추가하지 않으므로 수동 작성

-- 기존 마이그레이션 주석 처리 후 수동 실행
-- CreateIndex
CREATE INDEX CONCURRENTLY IF NOT EXISTS "TenantUsageLog_tenantId_createdAt_idx"
ON "TenantUsageLog"("tenantId", "createdAt" DESC);
```

---

### Q6. WAL 로그가 너무 많이 쌓여 디스크가 가득 차고 있습니다. 해결 방법은?

**상황**: CNPG Pod의 스토리지가 90% 이상 차서 알림이 발생했습니다.

**WAL 쌓임 원인 분석**:

```sql
-- 복제 슬롯이 WAL을 붙잡고 있는지 확인
SELECT
  slot_name,
  plugin,
  active,
  active_pid,
  pg_size_pretty(
    pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)
  ) AS retained_wal_size,
  confirmed_flush_lsn
FROM pg_replication_slots
ORDER BY pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) DESC;

-- WAL 디렉토리 크기 확인
SELECT pg_size_pretty(sum(size)) AS wal_size
FROM pg_ls_waldir();

-- wal_keep_size 설정 확인
SHOW wal_keep_size;
SHOW max_wal_size;
```

**긴급 조치**:

```bash
# 1. 비활성화된 복제 슬롯 삭제 (WAL 블로킹 해소)
kubectl exec -n database saas-postgres-1 -- \
  psql -U postgres -c "
    SELECT pg_drop_replication_slot(slot_name)
    FROM pg_replication_slots
    WHERE active = false
      AND pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) > 1073741824;  -- 1GB 이상
  "

# 2. 수동 체크포인트로 WAL 정리 촉진
kubectl exec -n database saas-postgres-1 -- \
  psql -U postgres -c "CHECKPOINT;"

# 3. CNPG PVC 용량 증설 (PVC 자동 확장 필요)
kubectl patch cluster saas-postgres -n database --type=merge -p '
{
  "spec": {
    "storage": {
      "size": "200Gi"
    }
  }
}'
```

**장기 예방 설정**:

```yaml
# CNPG 클러스터 WAL 설정 최적화
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: saas-postgres
spec:
  postgresql:
    parameters:
      # WAL 최대 크기 (디스크의 10%)
      max_wal_size: "8GB"
      # 최소 보관 WAL (복제 지연 대비)
      wal_keep_size: "2GB"
      # 아카이브 성공 시 즉시 정리
      archive_cleanup_command: "pg_archivecleanup /var/lib/postgresql/data/pg_wal %r"
  backup:
    # WAL 아카이빙 활성화 (S3 → MinIO)
    barmanObjectStore:
      destinationPath: s3://saas-backups/wal
      s3Credentials:
        accessKeyId:
          name: backup-credentials
          key: ACCESS_KEY_ID
```

---

### Q7. PostgreSQL 연결 수(max_connections) 한계에 도달했습니다. 어떻게 해결하나요?

**상황**: `FATAL: remaining connection slots are reserved for non-replication superuser connections` 오류가 발생합니다.

**현재 연결 상태 진단**:

```sql
-- 현재 연결 수 및 최대값
SELECT
  max_conn,
  used,
  res_for_super,
  max_conn - used - res_for_super AS available
FROM
  (SELECT count(*) AS used FROM pg_stat_activity) t1,
  (SELECT setting::int AS max_conn FROM pg_settings WHERE name = 'max_connections') t2,
  (SELECT setting::int AS res_for_super FROM pg_settings WHERE name = 'superuser_reserved_connections') t3;

-- 애플리케이션별 연결 수
SELECT
  application_name,
  state,
  count(*) AS connections
FROM pg_stat_activity
WHERE pid != pg_backend_pid()
GROUP BY application_name, state
ORDER BY connections DESC;

-- idle 연결 강제 종료 (유휴 연결 정리)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND now() - state_change > interval '10 minutes'
  AND application_name != 'pg_isready';
```

**PgBouncer 연결 풀링 설정**:

```yaml
# platform/k8s/database/pgbouncer.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: pgbouncer-config
  namespace: database
data:
  pgbouncer.ini: |
    [databases]
    saasdb = host=saas-postgres-rw port=5432 dbname=saasdb

    [pgbouncer]
    listen_port = 5432
    listen_addr = 0.0.0.0
    auth_type = scram-sha-256
    auth_file = /etc/pgbouncer/userlist.txt

    # 트랜잭션 모드 (Prisma와 호환)
    pool_mode = transaction

    # 서버 연결 풀 크기 (PostgreSQL max_connections의 80%)
    max_client_conn = 1000    # 클라이언트 최대 연결
    default_pool_size = 50    # DB 실제 연결 수
    min_pool_size = 5
    reserve_pool_size = 10    # 긴급 예비 연결

    # 타임아웃
    server_idle_timeout = 600
    client_idle_timeout = 60
    query_timeout = 30

    # 로깅 (CSAP D-06)
    log_connections = 1
    log_disconnections = 1
    log_pooler_errors = 1
```

**Prisma에서 PgBouncer 연결 설정**:

```typescript
// CNPG에서 PgBouncer를 거쳐 접속
// DATABASE_URL=postgresql://user:pass@pgbouncer:5432/saasdb?pgbouncer=true&connection_limit=5

// prisma/schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  // PgBouncer 트랜잭션 모드 호환성 (prepared statements 비활성화)
  directUrl = env("DIRECT_URL")  // 마이그레이션용 직접 연결
}
```

---

### Q8. Row-Level Security(RLS) 정책이 예상대로 작동하지 않을 때 디버깅 방법은?

**상황**: `tenant_id` 기반 RLS를 설정했는데 다른 테넌트 데이터가 보이거나 빈 결과가 반환됩니다.

**RLS 정책 디버깅**:

```sql
-- 1. RLS가 활성화되어 있는지 확인
SELECT
  tablename,
  rowsecurity AS rls_enabled,
  forcerowsecurity AS rls_forced
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('tenant_usage_logs', 'ai_model');

-- 2. 현재 적용된 정책 목록
SELECT
  polname AS policy_name,
  polcmd AS command,
  polroles::regrole[] AS applies_to,
  pg_get_expr(polqual, polrelid) AS using_expression,
  pg_get_expr(polwithcheck, polrelid) AS with_check_expression
FROM pg_policy
WHERE polrelid = 'tenant_usage_logs'::regclass;

-- 3. 특정 역할로 RLS 테스트 (실제 쿼리 시뮬레이션)
SET ROLE ai_service_role;
SET app.current_tenant_id = 'tenant-uuid-1234';

-- 이 쿼리가 예상 데이터만 반환하는지 확인
SELECT count(*) FROM tenant_usage_logs;

RESET ROLE;

-- 4. RLS 우회하여 전체 데이터 확인 (슈퍼유저만 가능)
SET row_security = OFF;
SELECT count(*) FROM tenant_usage_logs;  -- 전체 행 수
SET row_security = ON;
```

**올바른 RLS 정책 설정 예시**:

```sql
-- 테넌트 격리 RLS 정책
ALTER TABLE tenant_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_usage_logs FORCE ROW LEVEL SECURITY;

-- 테넌트별 읽기 정책
CREATE POLICY tenant_isolation_select ON tenant_usage_logs
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- 테넌트별 쓰기 정책
CREATE POLICY tenant_isolation_insert ON tenant_usage_logs
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- 관리자는 전체 접근 가능
CREATE POLICY admin_full_access ON tenant_usage_logs
  FOR ALL
  TO platform_admin
  USING (true);
```

Prisma에서 `app.current_tenant_id`를 설정하는 방법입니다.

```typescript
// Design Ref: §8 RLS 멀티테넌시
// Prisma $extends로 자동 tenantId 주입
export const tenantPrisma = (tenantId: string) =>
  prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          // 모든 쿼리 전에 RLS 컨텍스트 설정
          return prisma.$transaction(async (tx) => {
            await tx.$executeRaw`
              SELECT set_config('app.current_tenant_id', ${tenantId}, true)
            `;
            return query(args);
          });
        },
      },
    },
  });
```

---

## Prisma 트러블슈팅

---

### Q9. Prisma migrate deploy가 프로덕션에서 실패했습니다. 어떻게 복구하나요?

**상황**: CI/CD 파이프라인에서 `prisma migrate deploy`가 실패하고 `_prisma_migrations` 테이블에 실패 상태가 남았습니다.

**실패 상태 확인**:

```sql
-- 마이그레이션 이력 조회
SELECT
  migration_name,
  checksum,
  started_at,
  finished_at,
  applied_steps_count,
  logs,
  rolled_back_at,
  applied_steps_count
FROM _prisma_migrations
ORDER BY started_at DESC
LIMIT 20;

-- 실패한 마이그레이션 확인
SELECT migration_name, logs
FROM _prisma_migrations
WHERE finished_at IS NULL
  OR rolled_back_at IS NOT NULL;
```

**복구 절차**:

```bash
# 방법 1: 실패한 마이그레이션을 수동으로 적용 후 완료 표시
# 1) 마이그레이션 SQL을 수동으로 실행
kubectl exec -n database saas-postgres-1 -- \
  psql -U postgres -d saasdb \
  -f /tmp/failed-migration.sql

# 2) Prisma 마이그레이션 상태를 완료로 표시
npx prisma migrate resolve \
  --applied "20260413_add_tenant_statistics"

# 방법 2: 실패한 마이그레이션을 롤백 표시 후 재시도
npx prisma migrate resolve \
  --rolled-back "20260413_add_tenant_statistics"

# 방법 3: 마이그레이션 파일 수정 후 재배포
# (마이그레이션 파일의 오류를 수정한 경우)
npx prisma migrate deploy
```

**마이그레이션 안전 배포 체크리스트**:

```bash
# 프로덕션 배포 전 반드시 확인
# 1. 스테이징 환경에서 먼저 실행
DATABASE_URL=$STAGING_DB npx prisma migrate deploy

# 2. 실행 전 현재 상태 스냅샷
npx prisma migrate status

# 3. 배포 중 다운타임 예측 (큰 테이블 ALTER는 오래 걸림)
EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM "TenantUsageLog";

# 4. 롤백 계획 수립
# migration.sql에 롤백 스크립트를 주석으로 포함
cat prisma/migrations/20260413_add_tenant_stats/migration.sql
```

---

### Q10. P2024 오류(Connection pool timeout)가 자주 발생합니다. 원인과 해결 방법은?

**오류 메시지**: `PrismaClientKnownRequestError: Timed out fetching a new connection from the connection pool. (P2024)`

**원인**: 연결 풀이 고갈되었습니다. 보통 다음 원인 중 하나입니다.

1. 트랜잭션이 연결을 너무 오래 보유
2. 동시 요청 수 대비 연결 풀이 너무 작음
3. 쿼리 실행 시간이 너무 길어 연결을 점유

**연결 풀 현황 확인**:

```bash
# PostgreSQL에서 연결 상태 확인
kubectl exec -n database saas-postgres-1 -- \
  psql -U postgres -c "
    SELECT application_name, state, count(*)
    FROM pg_stat_activity
    GROUP BY application_name, state
    ORDER BY count(*) DESC;"
```

**Prisma 연결 풀 조정**:

```typescript
// Prisma 연결 풀 최적화
// Design Ref: §10 연결 풀 설정
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      // connection_limit: 각 Pod의 DB 연결 수
      // pool_timeout: 연결 대기 최대 시간(초)
      // connect_timeout: DB 연결 타임아웃(초)
      url: `${process.env['DATABASE_URL']}?connection_limit=10&pool_timeout=30&connect_timeout=10`,
    },
  },
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
  ],
});

// 연결 획득 시간 모니터링
prisma.$on('query', (e) => {
  if (e.duration > 1000) {
    console.warn(`[SLOW QUERY] ${e.duration}ms: ${e.query.slice(0, 100)}`);
  }
});
```

K8s 환경에서 Pod 수와 연결 수 계산입니다. (아래 다이어그램 참조)

```
PostgreSQL max_connections = 200
PgBouncer pool_size = 50 (DB 측 실제 연결)
각 Pod connection_limit = PgBouncer pool_size / Pod 수
예: Pod 5개 → connection_limit = 50 / 5 = 10
```

```bash
# 현재 Pod 수 확인
kubectl get pods -n saas -l app=ai-service --no-headers | wc -l

# Pod 수에 맞게 DATABASE_URL 업데이트
# HPA 설정과 연동하여 자동화 권장
```

---

### Q11. Prisma Client가 "prepared statement already exists" 오류를 반환합니다.

**오류 메시지**: `ERROR: prepared statement "s0" already exists`

**원인**: PgBouncer를 트랜잭션 모드로 사용할 때 Prisma의 Prepared Statement가 PgBouncer의 연결 재사용과 충돌합니다.

**즉각 해결**:

```typescript
// DATABASE_URL에 pgbouncer=true 추가
// 이 옵션은 Prisma가 Prepared Statement를 사용하지 않게 합니다
const databaseUrl = `${process.env['DATABASE_URL']}&pgbouncer=true&connection_limit=5`;
```

또는 Prisma 스키마에서 설정합니다.

```prisma
// prisma/schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  // 마이그레이션은 Prepared Statement가 필요하므로 직접 연결
  directUrl = env("DIRECT_DATABASE_URL")
}
```

```bash
# 환경 변수 설정
# DATABASE_URL: PgBouncer 경유 (pgbouncer=true)
DATABASE_URL="postgresql://user:pass@pgbouncer:5432/saasdb?pgbouncer=true&connection_limit=5"
# DIRECT_DATABASE_URL: PostgreSQL 직접 연결 (마이그레이션용)
DIRECT_DATABASE_URL="postgresql://user:pass@cnpg-rw:5432/saasdb"
```

---

### Q12. N+1 쿼리를 Prisma에서 자동으로 탐지하는 방법은?

**상황**: 100개의 테넌트를 조회할 때 101번의 쿼리가 발생합니다.

**N+1 문제 예시와 해결**:

```typescript
// 잘못된 방법 (N+1 발생)
const tenants = await prisma.tenant.findMany({ take: 100 });
for (const tenant of tenants) {
  // 각 테넌트마다 별도 쿼리 → 100개 추가 쿼리 발생!
  const usageCount = await prisma.aiUsageLog.count({
    where: { tenantId: tenant.id },
  });
}

// 올바른 방법 1: include로 한 번에 조회
const tenants = await prisma.tenant.findMany({
  take: 100,
  include: {
    _count: {
      select: { aiUsageLogs: true },
    },
  },
});

// 올바른 방법 2: groupBy로 집계
const usageCounts = await prisma.aiUsageLog.groupBy({
  by: ['tenantId'],
  _count: { id: true },
  where: {
    tenantId: { in: tenantIds },
  },
});
```

**자동 탐지 설정**:

```typescript
// Prisma 쿼리 로깅으로 N+1 탐지
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: [{ emit: 'event', level: 'query' }],
});

// 동일 쿼리가 짧은 시간에 반복되면 N+1 의심
const recentQueries: Map<string, number[]> = new Map();

prisma.$on('query', (e) => {
  const queryKey = e.query.replace(/\$\d+/g, '?');  // 파라미터 정규화
  const timestamps = recentQueries.get(queryKey) ?? [];
  timestamps.push(Date.now());

  // 1초 내 동일 쿼리 10회 이상 = N+1 경고
  const recentCount = timestamps.filter(t => Date.now() - t < 1000).length;
  if (recentCount >= 10) {
    console.warn(`[N+1 탐지] ${recentCount}회 반복 쿼리: ${queryKey.slice(0, 100)}`);
  }

  recentQueries.set(queryKey, timestamps.slice(-20));
});
```

개발 환경에서는 `prisma-query-inspector` 같은 도구를 사용합니다.

```bash
# 개발 환경 N+1 탐지
DEBUG="prisma:query" npx ts-node src/main.ts 2>&1 | \
  awk '/prisma:query/ {print $0}' | \
  sort | uniq -c | sort -rn | head -20
```

---

### Q13. $transaction 내에서 중간에 실패했을 때 어떻게 처리되나요?

Prisma `$transaction`은 모든 작업이 성공하거나 모두 롤백되는 원자성(Atomicity)을 보장합니다.

```typescript
// Design Ref: §13 트랜잭션 원자성
// 실제 ai-service 패턴 참조 (rag.handler.ts)

async function createTenantWithInitialData(
  tenantName: string,
  adminEmail: string,
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      // 1단계: 테넌트 생성
      const tenant = await tx.tenant.create({
        data: { name: tenantName, tier: 'STARTER' },
      });

      // 2단계: 관리자 계정 생성
      const admin = await tx.user.create({
        data: {
          email: adminEmail,
          tenantId: tenant.id,
          role: 'ADMIN',
        },
      });

      // 3단계: 실패 시뮬레이션
      if (!admin.id) {
        // 이 오류가 발생하면 1단계와 2단계 모두 롤백
        throw new Error('관리자 계정 생성 실패');
      }

      // 4단계: 기본 설정 생성
      await tx.tenantConfig.create({
        data: {
          tenantId: tenant.id,
          maxAiRequests: 100,
          aiGrade: 'O',
        },
      });

      // 여기까지 모두 성공해야 커밋
    }, {
      maxWait: 5000,   // 연결 획득 대기 최대 5초
      timeout: 30000,  // 트랜잭션 전체 최대 30초
      isolationLevel: 'ReadCommitted',  // 격리 수준
    });
  } catch (error) {
    // $transaction은 실패 시 자동 롤백
    // 여기서는 에러 로깅만 수행
    console.error('[TX 롤백] 테넌트 생성 실패:', error);
    throw error;  // 상위로 전파
  }
}
```

중첩 트랜잭션(Savepoint)은 지원하지 않지만 `$transaction` 내부에서 에러를 잡아 부분 처리할 수 있습니다.

```typescript
// 부분 실패 허용 패턴
await prisma.$transaction(async (tx) => {
  await tx.tenant.create({ data: tenantData });

  // 선택적 작업: 실패해도 전체 롤백하지 않음
  try {
    await tx.auditLog.create({ data: auditData });
  } catch {
    // 감사 로그 실패는 무시하고 계속 진행
    console.warn('[감사 로그] 기록 실패, 계속 진행');
  }
});
```

---

### Q14. Prisma Studio를 프로덕션 DB에 안전하게 연결하는 방법은?

**주의**: Prisma Studio는 DB를 직접 읽기/쓰기하는 강력한 도구입니다. 프로덕션 DB에 연결할 때는 반드시 보안 조치가 필요합니다.

**안전한 접근 방법**:

```bash
# 방법 1: kubectl port-forward로 임시 터널 (권장)
# 1) CNPG 읽기 전용 서비스로만 접근
kubectl port-forward -n database svc/saas-postgres-ro 5433:5432 &

# 2) 읽기 전용 크리덴셜로 연결 (쓰기 권한 없음)
DATABASE_URL="postgresql://readonly_user:$(vault kv get -field=password saas-secrets/prisma-studio/readonly)@localhost:5433/saasdb" \
  npx prisma studio

# 방법 2: CSAP D-06 감사 로그 포함 접근
# Prisma Studio 세션 시작/종료를 감사 로그에 기록
cat >> .claude/audit.jsonl << EOF
{"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","actor":"$USER","action":"PRISMA_STUDIO_START","target":"production-db","ip":"$(curl -s ifconfig.me)"}
EOF

# 방법 3: 임시 스냅샷 DB (프로덕션 직접 접근 금지)
# 프로덕션 DB를 복제하여 임시 DB 생성
kubectl cnpg backup saas-postgres -n database
kubectl cnpg restore saas-postgres-snapshot \
  --cluster saas-postgres \
  --backup $(kubectl get backup -n database -o name | head -1)
```

읽기 전용 계정 생성:

```sql
-- 읽기 전용 Prisma Studio 계정
CREATE USER prisma_studio_ro WITH PASSWORD '...'
  NOSUPERUSER NOCREATEDB NOCREATEROLE;

GRANT CONNECT ON DATABASE saasdb TO prisma_studio_ro;
GRANT USAGE ON SCHEMA public TO prisma_studio_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO prisma_studio_ro;

-- 민감 컬럼 마스킹 뷰 제공 (PII 보호)
CREATE VIEW v_users_masked AS
SELECT
  id,
  LEFT(email, 3) || '***@***' AS email,  -- PII 마스킹
  role,
  tenant_id,
  created_at
FROM users;

GRANT SELECT ON v_users_masked TO prisma_studio_ro;
```

---

### Q15. 멀티테넌트 환경에서 Prisma $extends로 자동 tenantId 필터를 추가하는 방법은?

```typescript
// Design Ref: §15 멀티테넌트 Prisma $extends
// Plan SC: FR-MT.1 테넌트 격리

/**
 * 모든 쿼리에 자동으로 tenantId 조건을 추가하는 Prisma 확장
 * 개발자가 실수로 tenantId를 빠뜨려도 자동으로 적용됩니다.
 */
export function createTenantPrismaClient(tenantId: string) {
  return prisma.$extends({
    name: 'tenant-isolation',
    query: {
      // tenantId 필드가 있는 모든 모델에 자동 적용
      $allModels: {
        async findMany({ args, query, model }) {
          // tenantId 필드가 있는 모델만 필터 적용
          const modelsWithTenant = [
            'AiModel', 'AiUsageLog', 'AiKnowledgeDocument',
            'TenantConfig', 'User',
          ];

          if (modelsWithTenant.includes(model)) {
            args.where = {
              ...args.where,
              tenantId,
            };
          }
          return query(args);
        },

        async findFirst({ args, query, model }) {
          if (['AiModel', 'AiUsageLog', 'TenantConfig'].includes(model)) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },

        async create({ args, query, model }) {
          if (['AiModel', 'AiUsageLog', 'TenantConfig'].includes(model)) {
            // 생성 시 tenantId 자동 주입
            args.data = { ...args.data, tenantId };
          }
          return query(args);
        },

        async update({ args, query, model }) {
          if (['AiModel', 'TenantConfig'].includes(model)) {
            // 수정 시 WHERE 조건에 tenantId 추가
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },

        async delete({ args, query, model }) {
          if (['AiModel', 'AiUsageLog'].includes(model)) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },
      },
    },
  });
}

// 사용 예시 (ai-rag.handler.ts 패턴 참조)
export async function ragIngestHandler(request, reply) {
  const { tenantId } = request.body;
  const db = createTenantPrismaClient(tenantId);

  // tenantId 조건이 자동으로 포함됨
  const existing = await db.aiKnowledgeDocument.findFirst({
    where: { title: body.title },  // tenantId 자동 추가
  });
}
```

---

### Q16. Prisma 마이그레이션 이력이 프로덕션과 스테이징이 다를 때 동기화 방법은?

**현재 상태 비교**:

```bash
# 프로덕션 마이그레이션 이력 조회
DATABASE_URL=$PROD_DB npx prisma migrate status

# 스테이징 마이그레이션 이력 조회
DATABASE_URL=$STAGING_DB npx prisma migrate status

# 각 환경의 마이그레이션 이력 텍스트 파일로 저장
DATABASE_URL=$PROD_DB npx prisma migrate status > /tmp/prod-migrations.txt
DATABASE_URL=$STAGING_DB npx prisma migrate status > /tmp/staging-migrations.txt

# 차이점 확인
diff /tmp/prod-migrations.txt /tmp/staging-migrations.txt
```

**동기화 방법**:

```bash
# 시나리오 1: 스테이징이 프로덕션보다 마이그레이션이 적을 때
# 프로덕션에서 적용된 마이그레이션을 스테이징에도 적용
DATABASE_URL=$STAGING_DB npx prisma migrate deploy

# 시나리오 2: 스테이징에만 있는 마이그레이션이 있을 때
# (스테이징에서 실험적으로 추가한 경우)
# 해당 마이그레이션을 롤백 표시
DATABASE_URL=$STAGING_DB npx prisma migrate resolve \
  --rolled-back "20260410_experimental_index"

# 시나리오 3: _prisma_migrations 테이블 직접 수정 (최후 수단)
kubectl exec -n database staging-postgres -- \
  psql -U postgres -d saasdb -c "
    DELETE FROM _prisma_migrations
    WHERE migration_name = '20260410_experimental_index'
      AND rolled_back_at IS NOT NULL;"
```

**예방**: 마이그레이션은 항상 스테이징 → 프로덕션 순서로 배포합니다.

```yaml
# .gitea/workflows/database-migration.yml
name: DB Migration

on:
  push:
    paths:
      - 'prisma/migrations/**'
    branches:
      - stg  # 스테이징 먼저

jobs:
  migrate-staging:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Staging 마이그레이션
        env:
          DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}
        run: |
          npx prisma migrate deploy
          npx prisma migrate status

  migrate-production:
    needs: migrate-staging
    environment: production  # 수동 승인 필요
    steps:
      - name: Production 마이그레이션
        env:
          DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
        run: npx prisma migrate deploy
```

---

### Q17. Prisma 타입이 실제 DB 스키마와 맞지 않습니다. 재생성 방법은?

**증상**: `PrismaClientKnownRequestError: The column 'X' does not exist in the current database` 오류.

```bash
# 현재 DB 스키마와 Prisma 스키마 차이 확인
npx prisma db pull --print > /tmp/db-schema.prisma
diff prisma/schema.prisma /tmp/db-schema.prisma

# DB 스키마에서 Prisma 스키마 재생성 (기존 schema.prisma 덮어쓰기)
npx prisma db pull

# Prisma Client 재생성
npx prisma generate

# 타입 체크
npx tsc --noEmit

# 만약 DB를 Prisma 스키마에 맞게 수정하려면 (위험: 데이터 손실 가능)
# 반드시 백업 후 실행
npx prisma db push --accept-data-loss
```

직접 SQL로 스키마를 확인합니다.

```sql
-- 테이블 컬럼 목록 조회
SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'AiModel'
ORDER BY ordinal_position;

-- 현재 인덱스 목록
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'AiModel';
```

---

## 성능 최적화

---

### Q18. API 응답 시간이 갑자기 5배 느려졌습니다. DB 쿼리 분석 방법은?

```mermaid
flowchart TD
    A([응답 시간 급증 감지]) --> B{Grafana 대시보드\n확인}
    B --> C{DB 관련 지표\n급증?}
    C -- Yes --> D[pg_stat_statements\n슬로우 쿼리 TOP 10 조회]
    C -- No --> E[API 서버 자체 문제\n확인: CPU/메모리/캐시]

    D --> F{문제 쿼리 발견?}
    F -- Yes --> G[EXPLAIN ANALYZE\n실행 계획 분석]
    F -- No --> H[연결 풀 고갈 여부\n확인]

    G --> I{Sequential Scan\n또는 비효율 조인?}
    I -- Sequential Scan --> J[인덱스 추가\nCREATE INDEX CONCURRENTLY]
    I -- 비효율 조인 --> K[쿼리 리팩토링\n또는 materialized view]
    I -- 통계 오래됨 --> L[ANALYZE 테이블 실행]

    H --> M{연결 수 한계\n도달?}
    M -- Yes --> N[PgBouncer 풀 크기 증가\n또는 Pod 연결 수 감소]
    M -- No --> O[장기 트랜잭션 확인\npg_stat_activity]

    J --> P([모니터링 지속])
    K --> P
    L --> P
    N --> P
    O --> P

    style A fill:#ffebee
    style P fill:#e8f5e9
```

**단계별 진단 명령어**:

```bash
# 1. 최근 슬로우 쿼리 확인 (Q1 참조)
kubectl exec -n database saas-postgres-1 -- \
  psql -U postgres -d saasdb -c "
    SELECT mean_exec_time, calls, left(query, 100)
    FROM pg_stat_statements
    ORDER BY mean_exec_time DESC
    LIMIT 5;"

# 2. 현재 실행 중인 쿼리 확인
kubectl exec -n database saas-postgres-1 -- \
  psql -U postgres -c "
    SELECT pid, now() - query_start AS duration, state, left(query, 100)
    FROM pg_stat_activity
    WHERE state != 'idle'
    ORDER BY duration DESC;"

# 3. Prometheus에서 쿼리 지연 추이
# (Grafana 대시보드 'PostgreSQL Overview' 참조)
```

---

### Q19. Prisma findMany에서 count()를 같이 사용하면 성능이 나빠집니다. 해결 방법은?

**문제**: 페이지네이션 구현 시 `findMany`와 `count`를 따로 호출하면 DB 쿼리가 2번 발생합니다.

```typescript
// 잘못된 방법: 2번 쿼리
const [items, total] = await Promise.all([
  prisma.aiUsageLog.findMany({
    where: { tenantId },
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { createdAt: 'desc' },
  }),
  prisma.aiUsageLog.count({ where: { tenantId } }),
]);
```

**최적화 방법 1**: `$transaction`으로 단일 DB 왕복

```typescript
// 단일 트랜잭션으로 묶어서 커넥션 1회 사용
const [items, total] = await prisma.$transaction([
  prisma.aiUsageLog.findMany({
    where: { tenantId },
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      modelId: true,
      tokens: true,
      createdAt: true,
      // 필요한 필드만 선택 (over-fetching 방지)
    },
  }),
  prisma.aiUsageLog.count({ where: { tenantId } }),
]);
```

**최적화 방법 2**: Window Function으로 단일 쿼리

```typescript
// 단일 SQL로 데이터 + 전체 건수 동시 조회
const result = await prisma.$queryRaw<Array<{
  id: string;
  model_id: string;
  total_count: bigint;
}>>`
  SELECT
    id,
    model_id,
    COUNT(*) OVER() AS total_count
  FROM "AiUsageLog"
  WHERE tenant_id = ${tenantId}::uuid
  ORDER BY created_at DESC
  LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
`;

const total = Number(result[0]?.total_count ?? 0);
const items = result.map(({ total_count: _, ...item }) => item);
```

**최적화 방법 3**: 대용량 테이블에서 정확한 count 대신 추정값 사용

```sql
-- PostgreSQL 통계 기반 빠른 추정 count (O(1) 시간 복잡도)
SELECT reltuples::bigint AS estimated_count
FROM pg_class
WHERE oid = 'public."AiUsageLog"'::regclass;
```

---

### Q20. Redis 캐시 히트율이 낮습니다. 분석 및 개선 방법은?

**캐시 히트율 분석**:

```bash
# Redis INFO 통계 확인
kubectl exec -n saas \
  $(kubectl get pod -n saas -l app=redis -o jsonpath='{.items[0].metadata.name}') \
  -- redis-cli INFO stats | grep -E "keyspace_hits|keyspace_misses"

# 캐시 히트율 계산
# hit_rate = keyspace_hits / (keyspace_hits + keyspace_misses) * 100
# 목표: 80% 이상

# 키 패턴별 TTL 확인
kubectl exec -n saas \
  $(kubectl get pod -n saas -l app=redis-master -o jsonpath='{.items[0].metadata.name}') \
  -- redis-cli --scan --pattern "ai:*" | head -20

# 메모리 사용량
kubectl exec -n saas redis-0 -- redis-cli INFO memory | \
  grep -E "used_memory_human|maxmemory_human|mem_fragmentation_ratio"
```

**캐시 키 설계 개선**:

```typescript
// Design Ref: §20 캐시 계층 최적화
// 계층적 캐시 키 설계 (테넌트 격리 보장)

const CACHE_KEYS = {
  // 테넌트별 AI 모델 목록 (5분 캐시)
  aiModels: (tenantId: string) => `ai:models:${tenantId}`,

  // AI 사용량 통계 (1분 캐시)
  usageStats: (tenantId: string, date: string) =>
    `ai:usage:${tenantId}:${date}`,

  // RAG 쿼리 결과 (10분 캐시, 질문 해시 포함)
  ragQuery: (tenantId: string, questionHash: string) =>
    `ai:rag:${tenantId}:${questionHash}`,
} as const;

// 캐시 레이어 구현
async function getAiModelsWithCache(tenantId: string) {
  const cacheKey = CACHE_KEYS.aiModels(tenantId);

  // 1. 캐시 확인
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);  // 캐시 히트
  }

  // 2. DB 쿼리
  const models = await prisma.aiModel.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, name: true, provider: true, endpoint: true },
  });

  // 3. 캐시 저장 (TTL: 5분)
  await redis.setex(cacheKey, 300, JSON.stringify(models));

  return models;
}

// 데이터 변경 시 캐시 무효화
async function updateAiModel(tenantId: string, modelId: string, data: unknown) {
  await prisma.aiModel.update({ where: { id: modelId }, data });

  // 해당 테넌트의 캐시만 삭제 (다른 테넌트 영향 없음)
  await redis.del(CACHE_KEYS.aiModels(tenantId));
}
```

---

### Q21. Connection Pool을 얼마로 설정해야 하나요? (Prisma + K8s Pod 수 기준)

```mermaid
flowchart TD
    A([환경 파악]) --> B[PostgreSQL\nmax_connections 확인]
    B --> C[PgBouncer\npool_size 설정]
    C --> D{K8s HPA\n최대 Pod 수?}

    D --> E[Pod당 connection_limit 계산\n= PgBouncer pool_size / max_pods]
    E --> F{connection_limit >= 2?}

    F -- Yes --> G[DATABASE_URL에\nconnection_limit 설정]
    F -- No --> H[PgBouncer pool_size 증가\n또는 max_pods 감소]

    G --> I[pool_timeout 설정\n= 평균 쿼리시간 * 2]
    I --> J[부하 테스트\nk6 실행]
    J --> K{P99 응답시간\n< SLO?}
    K -- Yes --> L([설정 완료])
    K -- No --> M[connection_limit 조정\n또는 캐시 활용]
    M --> J

    H --> D

    style A fill:#e3f2fd
    style L fill:#e8f5e9
    style M fill:#fff3e0
```

**계산 공식**:

```
# 기본 공식
PostgreSQL max_connections = 200
슈퍼유저 예약 = 5 (superuser_reserved_connections)
복제 연결 = 2 (Standby 노드용)
PgBouncer 사용 가능 연결 = 200 - 5 - 2 = 193
PgBouncer pool_size (안전 마진) = 193 * 0.8 = ~150

# 서비스별 할당 (총 150)
ai-service: 50 (높은 부하)
compliance-service: 30
security-service: 20
portal: 30
기타: 20

# Pod당 connection_limit
ai-service 최대 Pod 수 = 5 (HPA maxReplicas)
ai-service connection_limit = 50 / 5 = 10
```

실제 설정 예시입니다.

```bash
# ai-service DATABASE_URL 설정
# connection_limit: Pod당 최대 연결 수
# pool_timeout: 연결 대기 최대 시간(초) — P99 쿼리시간의 2배
# connect_timeout: DB 연결 타임아웃(초)
DATABASE_URL="postgresql://user:pass@pgbouncer:5432/saasdb?\
connection_limit=10&\
pool_timeout=30&\
connect_timeout=5&\
pgbouncer=true"
```

```yaml
# HPA 설정과 연동
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ai-service-hpa
  namespace: saas
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ai-service
  minReplicas: 2
  maxReplicas: 5  # 이 값이 connection_limit 계산 기준
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

---

### Q22. JOIN이 많은 복잡한 쿼리를 Prisma로 어떻게 최적화하나요?

```typescript
// 복잡한 JOIN 최적화 예시
// 테넌트별 AI 사용량 + 모델 정보 + 비용을 한 번에 조회

// 방법 1: Prisma include (단순하지만 N+1 위험)
const usage = await prisma.aiUsageLog.findMany({
  where: { tenantId, createdAt: { gte: startDate } },
  include: {
    model: {
      select: { name: true, provider: true },
    },
  },
  take: 100,
});

// 방법 2: select로 필요한 필드만 조회 (over-fetching 방지)
const usage = await prisma.aiUsageLog.findMany({
  where: { tenantId, createdAt: { gte: startDate } },
  select: {
    id: true,
    tokens: true,
    latencyMs: true,
    createdAt: true,
    model: {
      select: {
        name: true,
        provider: true,
        config: true,  // JSON 필드
      },
    },
  },
  orderBy: { createdAt: 'desc' },
  take: 100,
});

// 방법 3: $queryRaw로 최적화된 SQL 직접 작성
const usageStats = await prisma.$queryRaw<Array<{
  model_name: string;
  provider: string;
  total_tokens: bigint;
  avg_latency: number;
  request_count: bigint;
}>>`
  SELECT
    m.name AS model_name,
    m.provider,
    SUM(ul.tokens) AS total_tokens,
    AVG(ul.latency_ms) AS avg_latency,
    COUNT(*) AS request_count
  FROM "AiUsageLog" ul
  JOIN "AiModel" m ON m.id = ul.model_id
  WHERE ul.tenant_id = ${tenantId}::uuid
    AND ul.created_at >= ${startDate}
  GROUP BY m.id, m.name, m.provider
  ORDER BY total_tokens DESC
`;
```

**materialized view 활용** (집계 쿼리 성능 10배 향상):

```sql
-- 일별 테넌트 통계 materialized view
CREATE MATERIALIZED VIEW mv_daily_usage_stats AS
SELECT
  tenant_id,
  model_id,
  DATE(created_at) AS usage_date,
  COUNT(*) AS request_count,
  SUM(tokens) AS total_tokens,
  AVG(latency_ms) AS avg_latency
FROM "AiUsageLog"
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY tenant_id, model_id, DATE(created_at);

CREATE UNIQUE INDEX ON mv_daily_usage_stats
  (tenant_id, model_id, usage_date);

-- 1시간마다 갱신 (CronJob으로 실행)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_usage_stats;
```

---

### Q23. 날짜 범위 쿼리가 느립니다. 인덱스 전략은?

**상황**: `WHERE created_at BETWEEN '2026-01-01' AND '2026-04-01'` 쿼리가 테이블 전체를 스캔합니다.

```sql
-- 문제 진단
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*)
FROM "AiUsageLog"
WHERE tenant_id = 'uuid-here'
  AND created_at >= '2026-01-01'
  AND created_at < '2026-04-01';

-- 출력 예시 (Sequential Scan — 문제 있음):
-- Seq Scan on "AiUsageLog" (cost=0.00..8520.00 rows=1000 width=0)
--   Filter: ((tenant_id = 'uuid') AND (created_at >= '2026-01-01'))
-- Rows Removed by Filter: 980000
```

**인덱스 전략**:

```sql
-- 복합 인덱스 (tenant_id + created_at)
-- tenant_id를 앞에 두어 테넌트별 파티셔닝 효과
CREATE INDEX CONCURRENTLY idx_usage_tenant_date
ON "AiUsageLog" (tenant_id, created_at DESC);

-- BRIN 인덱스 (대용량 시계열 데이터, 10배 작은 크기)
-- 데이터가 삽입 순서대로 정렬된 경우에만 효율적
CREATE INDEX CONCURRENTLY idx_usage_date_brin
ON "AiUsageLog" USING BRIN (created_at)
WITH (pages_per_range = 64);

-- 파티셔닝 (가장 효과적, 월별 파티션)
CREATE TABLE "AiUsageLog" (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- 월별 파티션 생성
CREATE TABLE "AiUsageLog_2026_04"
  PARTITION OF "AiUsageLog"
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
```

```typescript
// Prisma에서 날짜 범위 쿼리 최적화
const stats = await prisma.aiUsageLog.findMany({
  where: {
    tenantId,
    // Prisma가 인덱스를 사용할 수 있도록 범위 조건 사용
    createdAt: {
      gte: new Date('2026-01-01T00:00:00Z'),
      lt: new Date('2026-04-01T00:00:00Z'),
    },
  },
  select: {
    id: true,
    tokens: true,
    createdAt: true,
  },
  orderBy: { createdAt: 'desc' },
  take: 1000,
});
```

---

### Q24. 멀티테넌트 환경에서 테넌트별 DB 성능이 다릅니다. 격리 진단 방법은?

```bash
# 테넌트별 쿼리 성능 비교
kubectl exec -n database saas-postgres-1 -- \
  psql -U postgres -d saasdb -c "
    SELECT
      -- tenantId는 쿼리 파라미터에 포함됨
      -- pg_stat_statements에서 파라미터는 \$1로 표시
      left(query, 100) AS query_pattern,
      mean_exec_time,
      calls,
      rows / calls AS avg_rows
    FROM pg_stat_statements
    WHERE query ILIKE '%AiUsageLog%'
    ORDER BY mean_exec_time DESC
    LIMIT 20;"

# 특정 테넌트의 테이블 크기 확인 (파티션 미사용 시)
kubectl exec -n database saas-postgres-1 -- \
  psql -U postgres -d saasdb -c "
    SELECT
      tenant_id,
      count(*) AS row_count,
      pg_size_pretty(count(*) * 8192) AS estimated_size
    FROM \"AiUsageLog\"
    GROUP BY tenant_id
    ORDER BY row_count DESC;"
```

**대형 테넌트 격리 전략**:

```sql
-- 대형 테넌트 전용 파티션 생성 (LIST 파티셔닝)
CREATE TABLE "AiUsageLog" (
  id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
) PARTITION BY LIST (tenant_id);

-- 대형 테넌트 전용 파티션 (별도 테이블스페이스 가능)
CREATE TABLE "AiUsageLog_tenant_large_01"
  PARTITION OF "AiUsageLog"
  FOR VALUES IN ('large-tenant-uuid-01');

-- 나머지 테넌트 공유 파티션 (DEFAULT)
CREATE TABLE "AiUsageLog_others"
  PARTITION OF "AiUsageLog"
  DEFAULT;
```

```typescript
// 테넌트별 쿼리 성능 모니터링 미들웨어
export async function tenantPerformanceMiddleware(
  tenantId: string,
  operation: () => Promise<unknown>,
): Promise<unknown> {
  const startTime = Date.now();

  try {
    const result = await operation();
    const duration = Date.now() - startTime;

    // 느린 테넌트 작업 경고 (500ms 이상)
    if (duration > 500) {
      console.warn(`[TENANT PERF] tenantId=${tenantId} duration=${duration}ms`);
      // Prometheus 메트릭 기록
      tenantQueryDuration.observe({ tenantId }, duration / 1000);
    }

    return result;
  } catch (error) {
    throw error;
  }
}
```

---

### Q25. EXPLAIN ANALYZE 결과를 어떻게 해석하고 최적화하나요?

**EXPLAIN ANALYZE 실행**:

```sql
-- 실제 실행 계획 조회 (버퍼 사용량 포함)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT ul.id, ul.tokens, m.name AS model_name
FROM "AiUsageLog" ul
JOIN "AiModel" m ON m.id = ul.model_id
WHERE ul.tenant_id = 'tenant-uuid'
  AND ul.created_at >= '2026-01-01'
ORDER BY ul.created_at DESC
LIMIT 50;
```

**출력 해석 가이드**:

```
-- 예시 출력 분석
Limit  (cost=100.50..150.25 rows=50 width=50)
       (actual time=5.230..8.420 rows=50 loops=1)
  ->  Sort  (cost=100.50..125.37 rows=9950 width=50)
            (actual time=5.228..8.400 rows=50 loops=1)
        Sort Key: ul.created_at DESC
        Sort Method: top-N heapsort  Memory: 34kB
        ->  Hash Join  (cost=10.20..65.10 rows=9950 width=50)
                       (actual time=0.521..4.800 rows=9950 loops=1)
              Hash Cond: (ul.model_id = m.id)
              Buffers: shared hit=120 read=30  -- ❶ 캐시 히트/미스
              ->  Index Scan using idx_usage_tenant_date  -- ❷ 인덱스 사용
                    on "AiUsageLog" ul  (cost=0.42..50.00 rows=9950 width=40)
                                        (actual time=0.050..3.200 rows=9950 loops=1)
                    Index Cond: (tenant_id = 'uuid' AND created_at >= '2026-01-01')
                    Buffers: shared hit=100 read=20
              ->  Hash  (cost=5.10..5.10 rows=10 width=20)  -- ❸ 해시 조인
                         (actual time=0.200..0.200 rows=10 loops=1)
                    ->  Seq Scan on "AiModel" m  -- ❹ Sequential Scan (소형 테이블은 OK)
Planning Time: 1.234 ms   -- ❺ 계획 수립 시간
Execution Time: 8.523 ms  -- ❻ 실제 실행 시간
```

**해석 포인트**:

| 항목 | 의미 | 최적화 방향 |
|------|------|------------|
| `cost=예상..실제` 차이가 큼 | 테이블 통계 오래됨 | `ANALYZE 테이블명` 실행 |
| `Seq Scan` (대형 테이블) | 인덱스 미사용 | 적절한 인덱스 추가 |
| `shared read` 높음 | 캐시 미스 (디스크 I/O) | `shared_buffers` 증가 또는 쿼리 최적화 |
| `loops=N` 높음 | 중첩 루프 조인 | Hash Join 유도를 위해 `enable_nestloop=off` 테스트 |
| `Sort Method: external merge` | 메모리 부족 정렬 | `work_mem` 증가 또는 인덱스 정렬 활용 |

**공통 최적화 패턴**:

```sql
-- 1. 통계 갱신 (Seq Scan 원인이 오래된 통계인 경우)
ANALYZE "AiUsageLog";

-- 2. 특정 세션에서 work_mem 증가 (Sort Memory 부족 시)
SET work_mem = '64MB';
EXPLAIN (ANALYZE, BUFFERS) [문제 쿼리];

-- 3. 조인 순서 강제 (잘못된 플래너 결정 시)
SET join_collapse_limit = 1;
SET from_collapse_limit = 1;

-- 4. 플래너 힌트 (pg_hint_plan 확장 필요)
/*+ IndexScan(ul idx_usage_tenant_date) */
SELECT ...

-- 5. 통계 갱신 자동화
-- 분석 후 테이블별 autovacuum/autoanalyze 설정 튜닝
ALTER TABLE "AiUsageLog" SET (
  autovacuum_analyze_scale_factor = 0.01,
  autovacuum_analyze_threshold = 100
);
```

---

## 빠른 참조 카드

### 자주 쓰는 진단 쿼리 모음

```sql
-- 슬로우 쿼리 TOP 5
SELECT mean_exec_time, calls, left(query, 100)
FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 5;

-- 락 대기 확인
SELECT blocked.pid, blocking.pid, left(blocked_a.query, 100)
FROM pg_locks blocked
JOIN pg_locks blocking ON blocking.relation = blocked.relation
JOIN pg_stat_activity blocked_a ON blocked_a.pid = blocked.pid
WHERE NOT blocked.granted LIMIT 10;

-- 연결 수 확인
SELECT application_name, state, count(*)
FROM pg_stat_activity GROUP BY 1,2 ORDER BY 3 DESC;

-- 테이블 bloat 확인
SELECT relname, n_dead_tup, n_live_tup, last_autovacuum
FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 10;

-- 인덱스 사용률
SELECT relname, indexrelname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes ORDER BY idx_scan LIMIT 10;
```

### Prisma 빠른 명령어

```bash
# 마이그레이션 상태 확인
npx prisma migrate status

# 스키마 변경 사항 미리보기
npx prisma migrate dev --create-only

# 프로덕션 배포
npx prisma migrate deploy

# 타입 재생성
npx prisma generate

# DB 스키마에서 Prisma 스키마 추출
npx prisma db pull
```

---

*문의: 플랫폼팀 Slack `#platform-database` | 긴급 장애: `#on-call`*
