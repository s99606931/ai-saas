# 데이터베이스 전용 디버깅 가이드 — PostgreSQL + Prisma 완전 트러블슈팅

> **문서 ID**: ONBOARD-09-TROUBLE-06
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **대상**: 백엔드 개발자, DevOps 엔지니어, DBA
> **선행 학습**: `09-troubleshooting/02-debugging-guide.md` (일반 디버깅), `09-troubleshooting/03-performance-guide.md` (성능 최적화), `03-development/13-prisma-advanced.md` (Prisma 심화)
> **소요 시간**: 약 4~5시간 (실습 포함)
> **CSAP**: D-06 (침해사고 관리 — 데이터 복구), D-08 (접근 통제 — DB 접근), D-09 (암호화 — 저장 데이터), D-12 (시스템 개발 보안 — 파라미터화 쿼리)
> **Design Ref**: D-P00.6 DB 스키마, DESIGN-MTU-P00 §DB 접근, MTU-N286 §멀티테넌시 RLS

---

## 목차

1. [DB 디버깅 도구 모음](#1-db-디버깅-도구-모음)
   - 1.1 [PostgreSQL CLI (psql) 필수 명령어 20개](#11-postgresql-cli-psql-필수-명령어-20개)
   - 1.2 [Prisma Studio 활용법](#12-prisma-studio-활용법)
   - 1.3 [k9s에서 DB Pod 접근 방법](#13-k9s에서-db-pod-접근-방법)
   - 1.4 [pg_activity로 실시간 쿼리 모니터링](#14-pg_activity로-실시간-쿼리-모니터링)
   - 1.5 [DB 디버깅 도구 선택 흐름도](#15-db-디버깅-도구-선택-흐름도)
2. [연결 문제 디버깅](#2-연결-문제-디버깅)
   - 2.1 [커넥션 풀 고갈 진단](#21-커넥션-풀-고갈-진단)
   - 2.2 [커넥션 수 제한 설정 확인](#22-커넥션-수-제한-설정-확인)
   - 2.3 [Prisma 커넥션 수 튜닝](#23-prisma-커넥션-수-튜닝)
   - 2.4 [커넥션 타임아웃 원인별 해결 방법](#24-커넥션-타임아웃-원인별-해결-방법)
3. [느린 쿼리 분석](#3-느린-쿼리-분석)
   - 3.1 [pg_stat_statements 설정 및 분석](#31-pg_stat_statements-설정-및-분석)
   - 3.2 [EXPLAIN ANALYZE 읽는 방법](#32-explain-analyze-읽는-방법)
   - 3.3 [Seq Scan vs Index Scan 판단 기준](#33-seq-scan-vs-index-scan-판단-기준)
   - 3.4 [느린 쿼리 실전 예시 5개](#34-느린-쿼리-실전-예시-5개)
   - 3.5 [느린 쿼리 진단 의사결정 트리](#35-느린-쿼리-진단-의사결정-트리)
4. [락(Lock) 문제 디버깅](#4-락lock-문제-디버깅)
   - 4.1 [PostgreSQL 락 종류](#41-postgresql-락-종류)
   - 4.2 [데드락 탐지 및 해결 방법](#42-데드락-탐지-및-해결-방법)
   - 4.3 [락 대기 쿼리 찾기](#43-락-대기-쿼리-찾기)
   - 4.4 [Prisma에서 락 최소화 패턴](#44-prisma에서-락-최소화-패턴)
5. [마이그레이션 실패 디버깅](#5-마이그레이션-실패-디버깅)
   - 5.1 [마이그레이션 중단 후 상태 확인](#51-마이그레이션-중단-후-상태-확인)
   - 5.2 [더티 상태(dirty state) 해결 방법](#52-더티-상태dirty-state-해결-방법)
   - 5.3 [수동 롤백 절차](#53-수동-롤백-절차)
   - 5.4 [마이그레이션 로그 분석](#54-마이그레이션-로그-분석)
6. [멀티테넌시 DB 이슈](#6-멀티테넌시-db-이슈)
   - 6.1 [Row-level Security 정책 오류](#61-row-level-security-정책-오류)
   - 6.2 [테넌트 데이터 누출 탐지 방법](#62-테넌트-데이터-누출-탐지-방법)
   - 6.3 [스키마 격리 환경에서의 연결 관리](#63-스키마-격리-환경에서의-연결-관리)
7. [CSAP 데이터 보존 관련 이슈](#7-csap-데이터-보존-관련-이슈)
   - 7.1 [삭제 금지 데이터 실수 삭제 대응](#71-삭제-금지-데이터-실수-삭제-대응)
   - 7.2 [PITR(Point-in-Time Recovery) 복구 절차](#72-pitrpoint-in-time-recovery-복구-절차)
   - 7.3 [백업 상태 확인 명령어](#73-백업-상태-확인-명령어)
   - 7.4 [복구 시간 목표(RTO) 달성 확인](#74-복구-시간-목표rto-달성-확인)
8. [실전 시나리오 3가지](#8-실전-시나리오-3가지)
   - 시나리오 1: [N+1 쿼리로 인한 API 타임아웃](#시나리오-1-n1-쿼리로-인한-api-타임아웃)
   - 시나리오 2: [마이그레이션 후 404 응답 급증](#시나리오-2-마이그레이션-후-404-응답-급증)
   - 시나리오 3: [특정 테넌트 쿼리 응답 10배 지연](#시나리오-3-특정-테넌트-쿼리-응답-10배-지연)
9. [학습 체크리스트](#9-학습-체크리스트)
10. [변경 이력](#10-변경-이력)

---

## 1. DB 디버깅 도구 모음

### 1.1 PostgreSQL CLI (psql) 필수 명령어 20개

PostgreSQL CLI는 DB 문제를 직접 진단할 때 가장 강력한 도구입니다. 이 명령어들을 암기하면 대부분의 DB 문제를 현장에서 즉시 진단할 수 있습니다.

```shell
# --- 연결 ---
# 1. k3s 클러스터 내 PostgreSQL에 접속 (k9s 없이)
kubectl exec -it postgresql-0 -n saas-system -- \
  psql -U postgres -d saas_db

# 2. 특정 데이터베이스로 연결
\c saas_db

# 3. 현재 연결 정보 확인
\conninfo

# --- DB/테이블 탐색 ---
# 4. 데이터베이스 목록
\l

# 5. 현재 DB 테이블 목록 (크기 포함)
\dt+

# 6. 테이블 스키마 확인
\d users

# 7. 인덱스 목록 및 크기
\di+

# 8. 시퀀스 목록
\ds

# --- 성능 분석 ---
# 9. 현재 실행 중인 쿼리 목록 (5초 이상)
SELECT pid, duration, state, query
FROM pg_stat_activity
WHERE state != 'idle'
  AND now() - query_start > interval '5 seconds'
ORDER BY duration DESC;

# 10. 느린 쿼리 TOP 10 (pg_stat_statements 필요)
SELECT query, calls, total_exec_time/calls AS avg_ms,
       rows, shared_blks_hit, shared_blks_read
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

# 11. 테이블 크기 TOP 10
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
       pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
       pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;

# 12. VACUUM 및 ANALYZE 상태 확인
SELECT relname, last_vacuum, last_autovacuum,
       last_analyze, last_autoanalyze,
       n_dead_tup, n_live_tup
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;

# --- 연결 및 락 ---
# 13. 현재 연결 수 / 최대 연결 수
SELECT count(*) AS current,
       max_conn AS max,
       max_conn - count(*) AS available
FROM pg_stat_activity,
     (SELECT setting::int AS max_conn FROM pg_settings WHERE name='max_connections') m
GROUP BY max_conn;

# 14. 연결 클라이언트별 수
SELECT client_addr, count(*) AS connections, state
FROM pg_stat_activity
GROUP BY client_addr, state
ORDER BY connections DESC;

# 15. 락 대기 현황 (락 대기 중인 쿼리)
SELECT blocked.pid AS blocked_pid,
       blocked.query AS blocked_query,
       blocking.pid AS blocking_pid,
       blocking.query AS blocking_query,
       now() - blocked.query_start AS wait_duration
FROM pg_stat_activity AS blocked
JOIN pg_stat_activity AS blocking
  ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
WHERE blocked.cardinality(pg_blocking_pids(blocked.pid)) > 0;

# 16. 데드락 후 남은 락 확인
SELECT pid, locktype, relation::regclass, mode, granted
FROM pg_locks l
JOIN pg_class c ON c.oid = l.relation
WHERE NOT granted;

# --- 복제 및 백업 ---
# 17. WAL 위치 및 복제 상태
SELECT pg_current_wal_lsn(), pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0')/1024/1024 AS wal_mb;

# 18. 가장 오래된 트랜잭션 (PITR 관련)
SELECT pid, now() - xact_start AS duration, state, query
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY xact_start
LIMIT 5;

# --- 기타 ---
# 19. PostgreSQL 버전 및 설정 확인
SELECT version();
SHOW max_connections;
SHOW shared_buffers;
SHOW work_mem;

# 20. 자주 접근되는 인덱스 확인 (미사용 인덱스 탐지)
SELECT schemaname, tablename, indexname,
       idx_scan AS scans, idx_tup_read AS tuples_read
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC
LIMIT 20;
```

### 1.2 Prisma Studio 활용법

Prisma Studio는 브라우저 기반 DB GUI 도구입니다. 개발 환경에서 데이터를 시각적으로 확인하고 편집할 때 유용합니다.

```shell
# 주의: Prisma Studio는 개발 환경에서만 사용. 프로덕션 데이터 직접 편집 금지!

# 로컬에서 Prisma Studio 실행 (ai-service 기준)
cd /data/ai-saas/platform/services/ai-service
npx prisma studio

# k3s 환경에서 Prisma Studio를 사용하려면 포트포워딩 필요
# 1단계: PostgreSQL 포트포워딩
kubectl port-forward svc/postgresql 5432:5432 -n saas-system &

# 2단계: .env.local 파일에 연결 정보 설정
cat > .env.local << 'EOF'
DATABASE_URL="postgresql://postgres:password@localhost:5432/saas_db"
EOF

# 3단계: Prisma Studio 실행
DATABASE_URL="postgresql://localhost:5432/saas_db" npx prisma studio

# Prisma Studio 주요 기능:
# - 테이블 데이터 시각화
# - 레코드 검색 및 필터
# - 단건 레코드 수정 (긴급 수동 수정 시)
# - 관계형 데이터 탐색

# 주의사항:
# ❌ 감사 로그(AuditLog) 테이블 직접 수정 금지 (append-only, CSAP D-06)
# ❌ 프로덕션 환경에서 실행 금지
# ❌ 여러 테이블 동시 대량 수정 금지 (트랜잭션 없음)
```

### 1.3 k9s에서 DB Pod 접근 방법

k9s(Kubernetes TUI)에서 PostgreSQL Pod에 직접 접근하는 방법입니다.

```shell
# k9s에서 DB Pod 접근 단계별 방법:

# 방법 1: k9s TUI에서 접근
k9s
# 1. ':pod' 입력하여 Pod 목록으로 이동
# 2. postgresql-0 Pod 선택
# 3. 's' 키 → Shell 접속
# 4. Shell에서 psql 실행:
psql -U postgres -d saas_db

# 방법 2: kubectl 직접 실행
kubectl exec -it -n saas-system postgresql-0 -- bash

# 방법 3: 특정 쿼리 직접 실행
kubectl exec -n saas-system postgresql-0 -- \
  psql -U postgres -d saas_db -c "SELECT count(*) FROM \"AuditLog\";"

# 방법 4: 포트포워딩으로 로컬 psql 클라이언트 사용 (GUI 도구 연동 시 유리)
kubectl port-forward -n saas-system svc/postgresql 5432:5432
# 별도 터미널에서:
psql -h localhost -U postgres -d saas_db

# 접속 비밀번호 확인:
# CSAP D-09: 비밀번호는 Secret에 저장됨 (하드코딩 금지)
kubectl get secret postgresql -n saas-system -o jsonpath='{.data.postgres-password}' | base64 -d

# DB Pod 상태 확인 (접속 전 먼저 확인)
kubectl get pods -n saas-system -l app=postgresql
kubectl describe pod postgresql-0 -n saas-system
```

### 1.4 pg_activity로 실시간 쿼리 모니터링

`pg_activity`는 `top`과 유사한 PostgreSQL 전용 실시간 모니터링 도구입니다.

```shell
# pg_activity 설치 (PostgreSQL Pod에 없는 경우)
kubectl exec -n saas-system postgresql-0 -- apt-get install -y pg-activity

# pg_activity 실행
kubectl exec -it -n saas-system postgresql-0 -- \
  pg_activity -U postgres -d saas_db

# pg_activity 화면 설명:
# 상단: DB 통계 (연결 수, 캐시 히트율, 트랜잭션/초)
# 중단: Running 쿼리 목록 (실행 중인 쿼리 + 실행 시간)
# 하단: Waiting 쿼리 (락 대기 중인 쿼리)

# pg_activity 유용한 단축키:
# C → CPU 사용률 순 정렬
# D → 실행 시간 순 정렬
# R → 메모리 사용률 순 정렬
# q → 종료

# pg_activity 없는 경우 대안 (psql watch 모드)
# 3초마다 현재 실행 쿼리 갱신
watch -n 3 "kubectl exec -n saas-system postgresql-0 -- \
  psql -U postgres -d saas_db -c \
  \"SELECT pid, state, now()-query_start AS dur, query FROM pg_stat_activity \
    WHERE state != 'idle' ORDER BY dur DESC LIMIT 20;\""
```

### 1.5 DB 디버깅 도구 선택 흐름도

```mermaid
flowchart TD
    PROBLEM([DB 문제 발생]) --> SYMPTOM{증상 유형}

    SYMPTOM -->|"API 느림\n타임아웃"| SLOW_QUERY[느린 쿼리 의심]
    SYMPTOM -->|"연결 거부\nConnection refused"| CONN_ISSUE[연결 문제 의심]
    SYMPTOM -->|"데이터 이상\n잘못된 결과"| DATA_ISSUE[데이터 무결성 의심]
    SYMPTOM -->|"마이그레이션 실패"| MIGRATION[마이그레이션 이슈]
    SYMPTOM -->|"특정 테넌트만 문제"| TENANT[멀티테넌시 이슈]

    SLOW_QUERY --> CHECK_ACTIVITY{실행 중인\n쿼리 확인?}
    CHECK_ACTIVITY -->|예, 현재 문제 중| PG_ACTIVITY[pg_activity 또는\npg_stat_activity\n실시간 확인]
    CHECK_ACTIVITY -->|아니오, 과거 패턴| PG_STATS[pg_stat_statements\n누적 통계 분석]
    PG_ACTIVITY --> EXPLAIN[EXPLAIN ANALYZE\n실행 계획 확인]
    PG_STATS --> EXPLAIN

    CONN_ISSUE --> CONN_COUNT[psql로\n연결 수 확인\n명령어 #13]
    CONN_COUNT --> CONN_TOOL{연결 수\n비교}
    CONN_TOOL -->|"현재 ≈ 최대"| POOL_EXHAUST[커넥션 풀\n고갈 대응]
    CONN_TOOL -->|"현재 < 최대"| NETWORK_CHECK[네트워크/방화벽\n확인]

    DATA_ISSUE --> PRISMA_STUDIO[Prisma Studio로\n데이터 직접 확인]
    PRISMA_STUDIO --> RLS_CHECK{RLS 정책\n활성화 여부}
    RLS_CHECK -->|RLS 관련| TENANT
    RLS_CHECK -->|RLS 무관| SQL_CHECK[psql 직접 쿼리\n비교]

    MIGRATION --> PRISMA_STATUS[prisma migrate status\n상태 확인]
    PRISMA_STATUS --> DIRTY{Dirty\n상태?}
    DIRTY -->|예| RESOLVE_DIRTY[더티 상태\n해결 절차]
    DIRTY -->|아니오| MIGRATION_LOG[마이그레이션\n로그 분석]

    TENANT --> RLS_POLICY[psql로\nRLS 정책 확인]
    RLS_POLICY --> TENANT_FILTER[Prisma 미들웨어\n테넌트 필터 확인]

    style EXPLAIN fill:#e8f5e9,stroke:#2e7d32
    style POOL_EXHAUST fill:#fce4ec,stroke:#c62828
    style RESOLVE_DIRTY fill:#fff3e0,stroke:#e65100
```

---

## 2. 연결 문제 디버깅

### 2.1 커넥션 풀 고갈 진단

커넥션 풀 고갈은 "too many clients" 에러나 연결 타임아웃으로 나타납니다. Prisma Client 에러 메시지: `Can't reach database server` 또는 `Connection pool timeout`.

```sql
-- 1. 현재 연결 상태 전체 현황 (가장 먼저 실행)
SELECT
  state,
  count(*) AS count,
  max(now() - state_change) AS oldest_in_state,
  avg(now() - state_change) AS avg_age
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()  -- 현재 분석 세션 제외
GROUP BY state
ORDER BY count DESC;

-- 예상 출력:
-- state   | count | oldest_in_state | avg_age
-- --------+-------+-----------------+----------
-- idle    | 45    | 00:30:00        | 00:05:00   ← idle 연결이 많으면 문제
-- active  | 3     | 00:00:05        | 00:00:02
-- idle in transaction | 2 | 00:02:00 | 00:01:30  ← 위험! 트랜잭션 미종료

-- 2. 클라이언트별 연결 수 (어느 서비스에서 많이 연결하는지)
SELECT
  client_addr,
  usename AS db_user,
  application_name,
  count(*) AS connections,
  string_agg(state, ',') AS states
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
GROUP BY client_addr, usename, application_name
ORDER BY connections DESC;

-- 3. 오래된 idle 연결 찾기 (30분 이상 idle인 연결)
SELECT pid, client_addr, application_name,
       now() - state_change AS idle_duration
FROM pg_stat_activity
WHERE state = 'idle'
  AND now() - state_change > interval '30 minutes'
ORDER BY idle_duration DESC;

-- 4. 긴급 조치: 특정 클라이언트의 idle 연결 강제 종료
-- 주의: 운영 중 사용 시 서비스 영향 확인 후 실행
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE client_addr = '10.0.0.x'  -- 문제 클라이언트 IP
  AND state = 'idle'
  AND now() - state_change > interval '30 minutes';
```

```shell
# 에러 로그에서 연결 고갈 징후 탐지
kubectl logs -n saas-system deployment/ai-service --since=10m \
  | grep -E "pool timeout|too many clients|connection refused|ECONNREFUSED"

# Prisma 로그에서 연결 풀 에러
# Prisma 에러 코드:
# P1001: DB 서버 접근 불가
# P1002: DB 서버 타임아웃
# P2024: 연결 풀 타임아웃 (가장 흔한 문제)
kubectl logs -n saas-system deployment/ai-service --since=10m \
  | grep -E "P1001|P1002|P2024"
```

### 2.2 커넥션 수 제한 설정 확인

```sql
-- PostgreSQL 최대 연결 수 확인
SHOW max_connections;
-- 기본값: 100 (k3s 환경에서는 메모리에 따라 조정)

-- 현재 사용 중인 연결 수
SELECT count(*) FROM pg_stat_activity;

-- 연결 예약 현황 (superuser 전용 예약 포함)
SELECT name, setting, description
FROM pg_settings
WHERE name IN ('max_connections', 'superuser_reserved_connections',
               'idle_in_transaction_session_timeout', 'statement_timeout');

-- 권장 설정:
-- max_connections: 100~200 (서비스 수 × 커넥션 풀 크기)
-- superuser_reserved_connections: 3 (긴급 접속 예약)
-- idle_in_transaction_session_timeout: 30000 (30초, 미종료 트랜잭션 자동 종료)
-- statement_timeout: 30000 (30초, 무한 실행 쿼리 방지)
```

### 2.3 Prisma 커넥션 수 튜닝

```typescript
// platform/services/ai-service/src/lib/prisma.ts 기반

// Prisma 커넥션 풀 설정 최적화
// CSAP D-08: DB 접근 통제 — 단일 커넥션 풀 관리
import { PrismaClient } from '@prisma/client';

// 서비스별 권장 커넥션 풀 크기:
// connection_limit = (CPU 코어 수 × 2) + 여유분
// ai-service: CPU 2코어 → connection_limit = 5~10
// auth-service: CPU 1코어 → connection_limit = 3~5
// audit-service: CPU 0.5코어 → connection_limit = 2~3

const connectionLimit = parseInt(process.env['DB_CONNECTION_POOL_SIZE'] ?? '10');
const connectionTimeout = parseInt(process.env['DB_CONNECTION_TIMEOUT_MS'] ?? '5000');

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `${process.env['DATABASE_URL']}?connection_limit=${connectionLimit}&pool_timeout=${connectionTimeout / 1000}`,
    },
  },
  log: process.env['NODE_ENV'] === 'development'
    ? ['error', 'warn', 'query']  // 개발: 쿼리 로그 활성화
    : ['error'],                    // 운영: 에러만
});

// 연결 풀 상태 모니터링 (Prometheus 메트릭과 연동)
// Prisma 자체 메트릭: prisma_pool_connections_open, prisma_pool_connections_busy
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
});
```

**환경 변수로 연결 풀 조정**:

```yaml
# Deployment 환경 변수 설정
# k3s/deployments/ai-service.yaml
spec:
  template:
    spec:
      containers:
      - name: ai-service
        env:
        - name: DB_CONNECTION_POOL_SIZE
          value: "10"        # 기본값, 부하에 따라 조정
        - name: DB_CONNECTION_TIMEOUT_MS
          value: "5000"      # 5초 타임아웃
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: ai-service-db-secret
              key: database-url
```

### 2.4 커넥션 타임아웃 원인별 해결 방법

```
원인 1: 연결 풀 고갈
  증상: "Connection pool timeout" (Prisma P2024)
  진단: pg_stat_activity에서 연결 수 확인
  해결:
    - 단기: idle 연결 강제 종료 (pg_terminate_backend)
    - 중기: connection_limit 값 증가 (환경 변수 조정)
    - 장기: 쿼리 최적화로 연결 점유 시간 단축

원인 2: 장시간 실행 트랜잭션
  증상: 연결이 "idle in transaction" 상태
  진단: state_change가 오래된 "idle in transaction" 연결 탐지
  해결:
    - idle_in_transaction_session_timeout 설정 (30초 권장)
    - 코드에서 트랜잭션 범위 최소화

원인 3: 네트워크 지연 또는 방화벽
  증상: 간헐적 연결 실패, 규칙적인 패턴 없음
  진단: kubectl exec로 PostgreSQL DNS 해석 확인
  해결:
    - PostgreSQL Service 이름 확인 (postgresql.saas-system.svc.cluster.local)
    - NetworkPolicy에서 서비스 → DB 트래픽 허용 확인

원인 4: PostgreSQL 재시작 중
  증상: 짧은 시간 동안 연결 실패, 자동 복구
  진단: kubectl get events -n saas-system | grep postgresql
  해결:
    - Prisma의 retry 로직 확인
    - 재시작 원인 (OOMKilled, crashloop) 확인
```

---

## 3. 느린 쿼리 분석

### 3.1 pg_stat_statements 설정 및 분석

`pg_stat_statements`는 PostgreSQL이 실행한 모든 쿼리의 통계를 누적합니다. 느린 쿼리 패턴을 찾는 데 필수적인 도구입니다.

```sql
-- pg_stat_statements 활성화 확인
SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements';

-- 없으면 활성화 (슈퍼유저 권한 필요)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- postgresql.conf에 추가 필요 (k3s 재시작 필요):
-- shared_preload_libraries = 'pg_stat_statements'
-- pg_stat_statements.max = 10000
-- pg_stat_statements.track = all

-- 느린 쿼리 TOP 10 (평균 실행 시간 기준)
SELECT
  round(total_exec_time::numeric, 2) AS total_ms,
  calls,
  round((total_exec_time/calls)::numeric, 2) AS avg_ms,
  round(stddev_exec_time::numeric, 2) AS stddev_ms,
  rows,
  round(100.0 * shared_blks_hit /
        nullif(shared_blks_hit + shared_blks_read, 0), 2) AS cache_hit_ratio,
  query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- 가장 자주 실행되는 쿼리 (캐싱 효과가 큰 후보)
SELECT calls, round(total_exec_time::numeric, 2) AS total_ms,
       round((total_exec_time/calls)::numeric, 2) AS avg_ms,
       query
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 10;

-- 캐시 미스율이 높은 쿼리 (디스크 IO 유발)
SELECT
  shared_blks_read AS disk_reads,
  shared_blks_hit AS cache_hits,
  round(100.0 * shared_blks_read /
        nullif(shared_blks_hit + shared_blks_read, 0), 2) AS cache_miss_pct,
  query
FROM pg_stat_statements
WHERE shared_blks_hit + shared_blks_read > 0
ORDER BY cache_miss_pct DESC
LIMIT 10;

-- 통계 초기화 (기준점 재설정 시)
SELECT pg_stat_statements_reset();
```

### 3.2 EXPLAIN ANALYZE 읽는 방법

`EXPLAIN ANALYZE`는 쿼리 실행 계획을 보여줍니다. 처음 보면 복잡해 보이지만 핵심 용어만 이해하면 됩니다.

```sql
-- EXPLAIN ANALYZE 기본 사용
EXPLAIN ANALYZE
SELECT u.id, u.name, al.action, al.created_at
FROM "User" u
JOIN "AuditLog" al ON al."actorId" = u.id
WHERE u."tenantId" = 'tenant-001'
  AND al.created_at > now() - interval '7 days'
ORDER BY al.created_at DESC
LIMIT 100;
```

**EXPLAIN ANALYZE 출력 해석 가이드**:

```
EXPLAIN ANALYZE 출력 예시:
(1) Limit  (cost=1234.56..1234.78 rows=100 width=128)
           (actual time=45.2..45.3 rows=100 loops=1)
(2)  -> Sort  (cost=1234.56..1287.34 rows=21112 width=128)
              (actual time=45.1..45.2 rows=100 loops=1)
(3)       Sort Key: al.created_at DESC
(4)       Sort Method: top-N heapsort  Memory: 35kB
(5)       -> Hash Join  (cost=567.89..1101.23 rows=21112 width=128)
                        (actual time=12.3..44.8 rows=21112 loops=1)
(6)             Hash Cond: (al."actorId" = u.id)
(7)             -> Seq Scan on "AuditLog" al  (cost=0.00..890.12 rows=45678 width=72)
                                               (actual time=0.1..30.4 rows=45678 loops=1)
(8)                   Filter: (created_at > (now() - '7 days'::interval))
(9)                   Rows Removed by Filter: 123456
(10)            -> Hash  (cost=345.67..345.67 rows=1787 width=56)
                          (actual time=12.1..12.1 rows=1787 loops=1)
(11)                  Buckets: 2048  Batches: 1  Memory Usage: 145kB
(12)                  -> Index Scan on "User" u  (cost=0.29..345.67 rows=1787 width=56)
                                                  (actual time=0.1..11.8 rows=1787 loops=1)
(13)                        Index Cond: ("tenantId" = 'tenant-001')

Planning Time: 2.3 ms
Execution Time: 45.5 ms    ← 실제 총 실행 시간
```

**핵심 용어 설명**:

```
cost=X..Y: 예상 비용 (X: 첫 번째 행 반환까지, Y: 전체 완료까지)
  → 숫자가 클수록 비용이 많이 드는 작업
  → 실제 시간(actual time)과 비교하여 예측 정확도 확인

actual time=X..Y: 실제 실행 시간 (ms 단위)
  → X: 첫 번째 행 반환까지, Y: 전체 완료까지

rows=N: 예상 행 수 vs actual rows: 실제 행 수
  → 두 값이 크게 다르면 통계가 오래됨 → ANALYZE 실행 필요

loops=N: 이 노드가 반복된 횟수 (중첩 루프에서 중요)
  → actual time은 한 루프 기준, 전체 시간 = actual time × loops

Seq Scan (순차 스캔, 라인 7):
  → 테이블 전체를 읽음 → 큰 테이블에서 느림
  → 인덱스 없거나 대부분 행을 읽을 때 선택됨

Index Scan (인덱스 스캔, 라인 12):
  → 인덱스로 필요한 행만 읽음 → 선택적 쿼리에서 빠름

Rows Removed by Filter: 123456 (라인 9):
  → 조건으로 걸러진 행 수
  → 숫자가 크면 인덱스 추가 고려

Hash Join (라인 5):
  → 한쪽 테이블을 메모리에 해시로 올리고 다른 쪽과 조인
  → 대용량 조인에 효율적
```

### 3.3 Seq Scan vs Index Scan 판단 기준

```
PostgreSQL의 Seq Scan 선택 기준:
  - 테이블의 10~15% 이상 행을 읽어야 하면 Seq Scan이 더 빠름
  - 작은 테이블(<1000행)은 항상 Seq Scan이 빠름

Seq Scan이 문제인 경우:
  - 대형 테이블(>10만 행)에서 WHERE 조건이 있는데 Seq Scan 선택
  - Rows Removed by Filter 수가 매우 클 때

해결 방법:
  1. WHERE 조건 컬럼에 인덱스 추가
  2. 복합 인덱스 (여러 컬럼 동시 조건)
  3. 부분 인덱스 (자주 쓰는 WHERE 조건 포함)

인덱스 추가 예시:
```

```sql
-- AuditLog 테이블에서 tenantId + created_at 복합 인덱스 추가
-- (WHERE tenantId = ? AND created_at > ? 쿼리 최적화)
CREATE INDEX CONCURRENTLY idx_audit_log_tenant_created
ON "AuditLog" ("tenantId", "created_at" DESC);

-- CONCURRENTLY 옵션: 인덱스 생성 중 테이블 락 없음 (운영 중 안전)
-- 단, 인덱스 생성 시간이 더 걸림

-- 부분 인덱스: 최근 30일 데이터만 빠르게 조회
CREATE INDEX CONCURRENTLY idx_audit_log_recent
ON "AuditLog" ("tenantId", "actorId")
WHERE created_at > now() - interval '30 days';

-- 인덱스 생성 진행 상황 확인
SELECT phase, blocks_done, blocks_total, tuples_done, tuples_total
FROM pg_stat_progress_create_index;
```

### 3.4 느린 쿼리 실전 예시 5개

**예시 1: N+1 쿼리 문제 (가장 흔한 문제)**

```typescript
// ❌ N+1 쿼리 — Prisma에서 자주 발생
// 사용자 100명 조회 시 101개 쿼리 발생
const users = await prisma.user.findMany({ take: 100 });
for (const user of users) {
  // 루프마다 별도 쿼리 실행 (N개 추가 쿼리)
  const auditLogs = await prisma.auditLog.findMany({
    where: { actorId: user.id },
  });
}
// 총 쿼리 수: 1 (users) + 100 (각 user의 auditLogs) = 101개

// ✅ 해결: include로 한 번에 조회
const users = await prisma.user.findMany({
  take: 100,
  include: {
    auditLogs: {
      orderBy: { createdAt: 'desc' },
      take: 5,
    },
  },
});
// 총 쿼리 수: 2 (JOIN 쿼리로 최적화)

// EXPLAIN으로 차이 확인:
// EXPLAIN SELECT u.*, al.* FROM "User" u
//   LEFT JOIN "AuditLog" al ON al."actorId" = u.id
//   ORDER BY al."createdAt" DESC;
```

**예시 2: 인덱스 없는 WHERE 조건**

```sql
-- ❌ 느린 쿼리: AuditLog에서 특정 action 조회
-- Seq Scan 발생 (인덱스 없음)
EXPLAIN ANALYZE
SELECT * FROM "AuditLog"
WHERE action = 'USER_DELETE'
ORDER BY created_at DESC
LIMIT 50;
-- 출력: Seq Scan on "AuditLog" (cost=0.00..8901.23 rows=45678 ...)
-- 실행: Execution Time: 234.5 ms (느림!)

-- ✅ 해결: action 컬럼에 인덱스 추가
CREATE INDEX CONCURRENTLY idx_audit_log_action
ON "AuditLog" (action, created_at DESC);

-- 이후 실행:
-- Index Scan on idx_audit_log_action (cost=0.43..123.45 rows=50 ...)
-- 실행: Execution Time: 2.3 ms (100배 빠름!)
```

**예시 3: 정렬이 인덱스와 맞지 않음**

```sql
-- ❌ 느린 쿼리: created_at ASC 정렬이지만 인덱스는 DESC
EXPLAIN ANALYZE
SELECT * FROM "AuditLog"
WHERE "tenantId" = 'tenant-001'
ORDER BY created_at ASC  -- ← 방향이 인덱스와 반대
LIMIT 100;
-- 출력: Sort (external sort)가 발생 → 디스크 정렬

-- ✅ 해결 방법 1: 인덱스 방향을 쿼리와 맞춤
CREATE INDEX idx_audit_log_tenant_created_asc
ON "AuditLog" ("tenantId", created_at ASC);

-- ✅ 해결 방법 2: 항상 DESC 정렬 사용하도록 코드 변경
const logs = await prisma.auditLog.findMany({
  where: { tenantId },
  orderBy: { createdAt: 'desc' },  -- 인덱스 방향과 일치
  take: 100,
});
```

**예시 4: 함수 사용으로 인덱스 무효화**

```sql
-- ❌ 느린 쿼리: WHERE 절에 함수 사용 시 인덱스 무효화
EXPLAIN ANALYZE
SELECT * FROM "User"
WHERE LOWER(email) = 'hong@gov.kr';  -- LOWER() 함수가 인덱스 무효화
-- 출력: Seq Scan on "User" (전체 테이블 스캔)

-- ✅ 해결 방법 1: 함수 기반 인덱스 추가
CREATE INDEX idx_user_email_lower ON "User" (LOWER(email));

-- ✅ 해결 방법 2: 데이터를 소문자로 정규화하여 저장 (권장)
-- DB에 저장 시 소문자로 저장, WHERE에 LOWER() 불필요
```

**예시 5: 카운트 쿼리 최적화**

```sql
-- ❌ 느린 쿼리: 전체 카운트 (대형 테이블에서 매우 느림)
SELECT count(*) FROM "AuditLog" WHERE "tenantId" = 'tenant-001';
-- Seq Scan 발생, Execution Time: 3000ms+

-- ✅ 해결 방법 1: 인덱스 전용 스캔 활성화
-- tenantId 인덱스가 있으면 훨씬 빠름
CREATE INDEX idx_audit_log_tenantid ON "AuditLog" ("tenantId");
-- 이후 Index Only Scan으로 변경됨

-- ✅ 해결 방법 2: 근사 카운트 사용 (실시간 정확도 불필요 시)
SELECT reltuples::bigint AS approximate_count
FROM pg_class
WHERE relname = 'AuditLog';
-- 즉시 반환! (통계 기반 추정치)

-- ✅ 해결 방법 3: Prisma에서 캐싱된 카운트 사용
// 매 요청마다 count 쿼리 대신 Redis에 캐싱
const cachedCount = await redis.get(`count:audit:${tenantId}`);
if (cachedCount) return parseInt(cachedCount);
const count = await prisma.auditLog.count({ where: { tenantId } });
await redis.setex(`count:audit:${tenantId}`, 60, count.toString());
```

### 3.5 느린 쿼리 진단 의사결정 트리

```mermaid
flowchart TD
    SLOW[느린 쿼리 발견\nAPI 응답 > 1초] --> EXPLAIN

    EXPLAIN[EXPLAIN ANALYZE 실행]
    EXPLAIN --> SEQ_SCAN{Seq Scan\n있음?}

    SEQ_SCAN -->|있음| TABLE_SIZE{테이블\n크기}
    TABLE_SIZE -->|"< 10만 행\n(작은 테이블)"| SEQ_OK["Seq Scan 정상\n(인덱스가 느릴 수 있음)"]
    TABLE_SIZE -->|"> 10만 행\n(대형 테이블)"| FILTER_CHECK{WHERE 조건\n있음?}

    FILTER_CHECK -->|"있음\n(rows removed 많음)"| ADD_INDEX[해당 컬럼에\n인덱스 추가]
    FILTER_CHECK -->|"없음\n(전체 읽기)"| RETHINK[쿼리 구조\n재검토 필요]

    SEQ_SCAN -->|"없음 (Index Scan)"| SORT_CHECK{Sort\n노드 있음?}
    SORT_CHECK -->|"있고 external sort"| WORKMEM[work_mem 증가\n또는 정렬 인덱스 추가]
    SORT_CHECK -->|"없음"| JOIN_CHECK{Nested Loop\n많음?}

    JOIN_CHECK -->|"있고 rows 폭발"| HASH_JOIN[Hash Join 유도\nSET enable_nestloop=off]
    JOIN_CHECK -->|"적거나 없음"| STAT_CHECK{통계 오래됨?\nrows 예측 vs 실제 차이}

    STAT_CHECK -->|"크게 다름"| ANALYZE_CMD[ANALYZE 테이블명\n통계 갱신]
    STAT_CHECK -->|"비슷함"| CONN_COUNT_Q{동시 쿼리\n많음?}

    CONN_COUNT_Q -->|"많음"| RESOURCE[CPU/메모리\n자원 부족 의심]
    CONN_COUNT_Q -->|"적음"| CACHE_MISS{캐시 미스율\n높음?}

    CACHE_MISS -->|"높음 (>50%)"| SHARED_BUF[shared_buffers\n또는 work_mem 증가]
    CACHE_MISS -->|"낮음"| REVIEW[쿼리 구조 재설계\n또는 앱 레이어 캐싱]

    style ADD_INDEX fill:#e8f5e9,stroke:#2e7d32
    style ANALYZE_CMD fill:#e3f2fd,stroke:#1565c0
    style REVIEW fill:#fff3e0,stroke:#e65100
```

---

## 4. 락(Lock) 문제 디버깅

### 4.1 PostgreSQL 락 종류

```
PostgreSQL 주요 락 종류 (약한 것 → 강한 것):

1. AccessShareLock (가장 약함)
   - 발생: SELECT 쿼리
   - 충돌: 없음 (동시 읽기 허용)

2. RowShareLock
   - 발생: SELECT FOR UPDATE / FOR SHARE
   - 충돌: 배타적 락과 충돌

3. RowExclusiveLock
   - 발생: INSERT, UPDATE, DELETE
   - 충돌: 테이블 수준 공유 락과 충돌

4. ShareUpdateExclusiveLock
   - 발생: VACUUM, ANALYZE, CREATE INDEX CONCURRENTLY
   - 충돌: 스키마 변경 락과 충돌

5. ShareLock
   - 발생: CREATE INDEX (CONCURRENTLY 없이)
   - 충돌: RowExclusiveLock과 충돌 (INSERT/UPDATE/DELETE 차단!)

6. AccessExclusiveLock (가장 강함)
   - 발생: ALTER TABLE, DROP TABLE, TRUNCATE, LOCK TABLE
   - 충돌: 모든 락과 충돌 (완전 차단)

마이그레이션에서 주의:
  ALTER TABLE ADD COLUMN → AccessExclusiveLock 획득
  → 다른 모든 쿼리 대기 → 운영 중 장시간 차단 위험
  해결: 큰 테이블의 ALTER는 maintenance window에서 실행
```

### 4.2 데드락 탐지 및 해결 방법

```sql
-- 데드락 발생 시 PostgreSQL 로그에 자동 기록됨
-- 위치 확인:
-- kubectl logs -n saas-system postgresql-0 | grep -i "deadlock"

-- 데드락 예시와 분석:
-- 트랜잭션 A: User 행 1 락 → AuditLog 행 2 락 시도
-- 트랜잭션 B: AuditLog 행 2 락 → User 행 1 락 시도
-- → 데드락 발생 (PostgreSQL이 한 트랜잭션 자동 롤백)

-- 데드락 후 현재 남아있는 락 확인
SELECT
  l.pid,
  l.locktype,
  l.relation::regclass AS table_name,
  l.mode,
  l.granted,
  a.query,
  now() - a.query_start AS query_age
FROM pg_locks l
JOIN pg_stat_activity a ON a.pid = l.pid
WHERE NOT l.granted  -- 락 획득 대기 중인 것
ORDER BY query_age DESC;

-- 데드락 방지 코드 패턴:
```

```typescript
// ❌ 데드락 위험: 서로 다른 순서로 리소스 잠금
// 코드 A: User 먼저 → AuditLog
async function codeA(userId: string) {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id: userId }, data: { /* ... */ } });
    const log = await tx.auditLog.create({ data: { actorId: userId, /* ... */ } });
  });
}

// 코드 B: AuditLog 먼저 → User (반대 순서!)
async function codeB(userId: string) {
  await prisma.$transaction(async (tx) => {
    const log = await tx.auditLog.create({ data: { actorId: userId, /* ... */ } });
    const user = await tx.user.update({ where: { id: userId }, data: { /* ... */ } });
  });
}

// ✅ 해결: 일관된 순서로 접근 (항상 User → AuditLog)
async function safeCombinedOperation(userId: string) {
  await prisma.$transaction(async (tx) => {
    // 항상 User를 먼저 수정
    await tx.user.update({ where: { id: userId }, data: { /* ... */ } });
    // 그 다음 AuditLog 생성
    await tx.auditLog.create({ data: { actorId: userId, /* ... */ } });
  }, {
    isolationLevel: 'ReadCommitted',  // 필요한 최소 격리 수준 사용
    timeout: 5000,                    // 5초 타임아웃 (무한 대기 방지)
  });
}
```

### 4.3 락 대기 쿼리 찾기

```sql
-- 현재 락 대기 현황 전체 조회 (가장 유용한 쿼리)
SELECT
  blocking.pid AS blocking_pid,
  blocking.usename AS blocking_user,
  blocking.query AS blocking_query,
  now() - blocking.query_start AS blocking_duration,
  blocked.pid AS blocked_pid,
  blocked.usename AS blocked_user,
  blocked.query AS blocked_query,
  now() - blocked.query_start AS blocked_duration
FROM pg_stat_activity AS blocked
CROSS JOIN LATERAL (
  SELECT *
  FROM pg_stat_activity
  WHERE pid = ANY(pg_blocking_pids(blocked.pid))
  LIMIT 1
) AS blocking
WHERE cardinality(pg_blocking_pids(blocked.pid)) > 0;

-- 락 대기 체인 시각화 (누가 누구를 차단하는지)
WITH RECURSIVE lock_chain AS (
  -- 시작점: 락을 보유한 PID
  SELECT pid, 0 AS depth, pid::text AS chain
  FROM pg_stat_activity
  WHERE pid NOT IN (
    SELECT UNNEST(pg_blocking_pids(pid)) FROM pg_stat_activity
  )
  AND cardinality(pg_blocking_pids(pid)) = 0

  UNION ALL

  SELECT a.pid, lc.depth + 1,
         lc.chain || ' → ' || a.pid::text
  FROM pg_stat_activity a
  JOIN lock_chain lc ON lc.pid = ANY(pg_blocking_pids(a.pid))
  WHERE lc.depth < 10
)
SELECT depth, chain, query
FROM lock_chain
JOIN pg_stat_activity ON pg_stat_activity.pid = lock_chain.pid
ORDER BY depth, chain;

-- 특정 PID 강제 종료 (긴급 상황 시)
-- 주의: 해당 트랜잭션 롤백 발생
SELECT pg_terminate_backend(pid)
WHERE pid = 12345;  -- 차단 중인 PID
```

### 4.4 Prisma에서 락 최소화 패턴

```typescript
// 락 최소화 패턴 — 트랜잭션 범위를 최소로 유지

// ❌ 안좋은 패턴: 트랜잭션 내에서 외부 API 호출
async function badPattern(userId: string) {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });

    // 외부 API 호출이 트랜잭션 내에 있음 → 락 점유 시간 증가
    const externalData = await fetch('https://external-api.example.com/data');  // 1~5초

    await tx.user.update({
      where: { id: userId },
      data: { lastSync: new Date() },
    });
  });
}

// ✅ 올바른 패턴: 외부 작업을 트랜잭션 밖으로 이동
async function goodPattern(userId: string) {
  // 1단계: 트랜잭션 외부에서 외부 데이터 수집
  const externalData = await fetch('https://external-api.example.com/data');  // 락 없음

  // 2단계: 짧은 트랜잭션으로 DB 업데이트만 처리
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { lastSync: new Date() },
    });
    await tx.auditLog.create({
      data: { actorId: userId, action: 'DATA_SYNC', /* ... */ },
    });
  }, { timeout: 3000 });  // 3초 타임아웃
}

// SELECT FOR UPDATE 최소화 (필요한 경우만 사용)
// SELECT FOR UPDATE는 RowShareLock 획득 → 동시성 감소
async function updateWithOptimisticLock(userId: string, expectedVersion: number) {
  // 낙관적 락: SELECT FOR UPDATE 대신 버전 컬럼 사용
  const updated = await prisma.user.updateMany({
    where: {
      id: userId,
      version: expectedVersion,  // 버전이 예상과 같을 때만 업데이트
    },
    data: {
      version: { increment: 1 },
      // ... 기타 업데이트 필드
    },
  });

  if (updated.count === 0) {
    throw new Error('동시 업데이트 충돌: 데이터가 변경되었습니다. 다시 시도하십시오.');
  }
}
```

---

## 5. 마이그레이션 실패 디버깅

### 5.1 마이그레이션 중단 후 상태 확인

```shell
# Prisma 마이그레이션 상태 확인
cd /data/ai-saas/platform/services/ai-service
npx prisma migrate status

# 출력 예시:
# Following migrations have not yet been applied:
# 20260412_add_index_audit_log

# 또는 실패한 경우:
# Database schema is not in sync with migration history.
# The following migration is in a failed state: 20260412_add_index_audit_log
# Status: Failed
# Drift detected: Your database schema is not in sync with your migration history.

# DB에서 직접 마이그레이션 히스토리 확인
kubectl exec -n saas-system postgresql-0 -- \
  psql -U postgres -d saas_db -c \
  "SELECT id, migration_name, finished_at, rolled_back_at, logs \
   FROM \"_prisma_migrations\" ORDER BY started_at DESC LIMIT 10;"

# 실패한 마이그레이션 상세 로그 확인
kubectl exec -n saas-system postgresql-0 -- \
  psql -U postgres -d saas_db -c \
  "SELECT migration_name, logs, applied_steps_count \
   FROM \"_prisma_migrations\" \
   WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;"
```

### 5.2 더티 상태(dirty state) 해결 방법

더티 상태는 마이그레이션이 중간에 실패하여 DB 상태와 마이그레이션 히스토리가 불일치할 때 발생합니다.

```shell
# 더티 상태 증상:
# "The migration was modified after it was applied"
# "Database schema is not in sync with migration history"

# 1단계: 현재 상태 파악
npx prisma migrate status

# 2단계: 실패한 마이그레이션 확인
kubectl exec -n saas-system postgresql-0 -- \
  psql -U postgres -d saas_db -c \
  "SELECT migration_name, applied_steps_count, logs
   FROM \"_prisma_migrations\"
   WHERE finished_at IS NULL;"

# 3단계: 마이그레이션 파일과 DB 상태 비교
# 파일에서 마이그레이션 SQL 확인
cat platform/services/ai-service/prisma/migrations/20260412_add_index/migration.sql

# 4단계: 더티 상태 해결 방법 선택

# 옵션 A: 마이그레이션 재적용 (실패한 마이그레이션이 부분 적용된 경우)
# 1. 부분 적용된 변경 수동 롤백
kubectl exec -n saas-system postgresql-0 -- \
  psql -U postgres -d saas_db -c "DROP INDEX IF EXISTS idx_audit_log_action;"

# 2. 마이그레이션 히스토리에서 실패 레코드 삭제
kubectl exec -n saas-system postgresql-0 -- \
  psql -U postgres -d saas_db -c \
  "DELETE FROM \"_prisma_migrations\" WHERE migration_name = '20260412_add_index';"

# 3. 마이그레이션 재실행
npx prisma migrate deploy

# 옵션 B: 더티 상태 기록만 초기화 (DB 변경은 이미 완료된 경우)
npx prisma migrate resolve --applied "20260412_add_index"

# 옵션 C: 마이그레이션 건너뛰기 (마이그레이션이 필요 없어진 경우)
npx prisma migrate resolve --rolled-back "20260412_add_index"
```

### 5.3 수동 롤백 절차

```sql
-- 마이그레이션 롤백 절차 (Prisma는 자동 롤백 지원 안 함)
-- 수동으로 역변환 SQL 실행 필요

-- 예시: ADD COLUMN 마이그레이션 롤백
-- 마이그레이션: ALTER TABLE "User" ADD COLUMN last_login_at TIMESTAMP;
-- 롤백: ALTER TABLE "User" DROP COLUMN last_login_at;

-- 1단계: 롤백 전 현재 상태 백업 (CSAP D-06: 작업 전 백업)
-- Velero 스냅샷 생성:
-- velero backup create pre-rollback-$(date +%Y%m%d%H%M%S) --include-namespaces saas-system

-- 2단계: 롤백 SQL 실행
BEGIN;
  -- 롤백 내용
  ALTER TABLE "User" DROP COLUMN IF EXISTS "last_login_at";

  -- 마이그레이션 히스토리 업데이트
  UPDATE "_prisma_migrations"
  SET rolled_back_at = now()
  WHERE migration_name = '20260412_add_last_login';

COMMIT;

-- 3단계: Prisma migrate status로 확인
-- 4단계: 애플리케이션 재시작 (스키마 변경 반영)
kubectl rollout restart deployment/ai-service -n saas-system
```

### 5.4 마이그레이션 로그 분석

```shell
# 마이그레이션 실행 중 상세 로그 출력
DATABASE_URL="postgresql://postgres:password@localhost:5432/saas_db" \
  npx prisma migrate deploy --schema=./prisma/schema.prisma 2>&1 | tee migration.log

# 로그에서 에러 패턴 탐지
grep -E "ERROR|FATAL|failed|duplicate|violates" migration.log

# 자주 나타나는 에러 메시지와 원인:
# "column already exists" → 이전 부분 적용된 마이그레이션이 남아있음
# "relation does not exist" → 의존하는 테이블/뷰가 없음
# "permission denied" → DB 사용자 권한 부족
# "lock timeout" → 다른 트랜잭션이 테이블 점유 중
# "duplicate key value violates unique constraint" → 데이터 중복 (마이그레이션 전 정리 필요)

# 마이그레이션 실패 원인이 락인 경우:
# 다른 서비스의 연결을 잠시 차단
kubectl scale deployment ai-service --replicas=0 -n saas-system
kubectl scale deployment auth-service --replicas=0 -n saas-system

# 마이그레이션 실행
npx prisma migrate deploy

# 서비스 복구
kubectl scale deployment ai-service --replicas=3 -n saas-system
kubectl scale deployment auth-service --replicas=2 -n saas-system
```

---

## 6. 멀티테넌시 DB 이슈

### 6.1 Row-level Security 정책 오류

우리 프로젝트는 `multitenant-rls.ts`로 구현된 RLS(Row Level Security) 정책으로 테넌트 데이터를 격리합니다.

```sql
-- RLS 정책 상태 확인
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 특정 테이블의 RLS 활성화 여부 확인
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname IN ('users', 'documents', 'audit_logs')
  AND relkind = 'r';

-- RLS 정책 없는 테이블 탐지 (보안 감사용)
SELECT relname AS table_without_rls
FROM pg_class
WHERE relkind = 'r'
  AND relnamespace = 'public'::regnamespace
  AND NOT relrowsecurity
  AND relname NOT IN ('_prisma_migrations', 'system_config', 'health_check');

-- 테넌트 컨텍스트 설정 확인 (RLS가 사용하는 세션 변수)
SHOW app.current_tenant_id;

-- 테넌트 컨텍스트 설정 및 RLS 테스트
SET app.current_tenant_id = 'tenant-001';

-- 이제 이 세션에서는 tenant-001 데이터만 보여야 함
SELECT count(*) FROM "User";  -- tenant-001 사용자만 카운트

-- RLS 정책 무시하고 전체 데이터 확인 (슈퍼유저 전용)
SET row_security = off;
SELECT count(*) FROM "User";  -- 전체 사용자 카운트
SET row_security = on;
```

**RLS 관련 Prisma 에러 해결**:

```typescript
// 에러: "new row violates row-level security policy for table User"
// 원인: RLS 정책 WITH CHECK 조건 위반 (다른 테넌트 데이터 삽입 시도)

// 진단: Prisma 미들웨어에서 tenantId가 올바르게 설정되는지 확인
// platform/services/ai-service/src/lib/multitenant-rls.ts 참조

// 해결: Prisma 미들웨어에서 tenantId 자동 주입 확인
prisma.$use(async (params, next) => {
  const tenantId = getCurrentTenantId();  // 요청 컨텍스트에서 가져옴

  // CREATE 작업에 tenantId 자동 추가
  if (params.action === 'create' && params.model !== 'SystemConfig') {
    params.args.data = {
      ...params.args.data,
      tenantId,
    };
  }

  return next(params);
});

// 에러: "ERROR: unrecognized configuration parameter app.current_tenant_id"
// 원인: PostgreSQL 설정에 custom.options가 없음
// 해결: postgresql.conf에 추가
// custom_variable_classes = 'app'
```

### 6.2 테넌트 데이터 누출 탐지 방법

```sql
-- 테넌트 데이터 격리 검증 쿼리
-- 각 테이블의 tenantId 분포 확인 (누출 탐지)

-- 사용자 수가 여러 테넌트에 정상 분포되어 있는지 확인
SELECT "tenantId", count(*) AS user_count
FROM "User"
GROUP BY "tenantId"
ORDER BY user_count DESC;

-- 특정 테넌트가 다른 테넌트 데이터를 볼 수 있는지 테스트
-- 1. 테스트 세션 시작
SET app.current_tenant_id = 'tenant-001';

-- 2. tenant-002 데이터가 보이면 안 됨
SELECT count(*) FROM "User" WHERE "tenantId" = 'tenant-002';
-- 기대값: 0 (RLS가 올바르면 0이 반환됨)

-- 3. 테스트 결과 해석:
-- 반환값 > 0: RLS 정책 오류 (테넌트 격리 실패)
-- 반환값 = 0: 정상 (RLS가 올바르게 필터링)

-- 교차 테넌트 접근 시도 감사 로그 확인
-- (multitenant-rls.ts의 detectRLSViolation 함수 기록)
SELECT actor, "tenantId", action, target, details, timestamp
FROM "AuditLog"
WHERE action = 'RLS_VIOLATION_DETECTED'
ORDER BY timestamp DESC
LIMIT 20;
```

### 6.3 스키마 격리 환경에서의 연결 관리

```sql
-- 스키마별 격리 환경에서 연결 관리 (스키마 격리 방식 사용 시)
-- 현재 연결이 사용 중인 search_path 확인
SHOW search_path;

-- 테넌트별 스키마 목록
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name LIKE 'tenant_%'
ORDER BY schema_name;

-- 특정 테넌트 스키마로 전환
SET search_path TO tenant_001, public;

-- 스키마 격리 모드에서 Prisma 연결 풀 관리
-- 각 테넌트마다 별도 커넥션 스트링 사용
const tenantPrismaMap = new Map<string, PrismaClient>();

function getPrismaForTenant(tenantId: string): PrismaClient {
  if (!tenantPrismaMap.has(tenantId)) {
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: `${process.env['DATABASE_URL']}?schema=${tenantId}`,
        },
      },
    });
    tenantPrismaMap.set(tenantId, prisma);
  }
  return tenantPrismaMap.get(tenantId)!;
}
```

---

## 7. CSAP 데이터 보존 관련 이슈

### 7.1 삭제 금지 데이터 실수 삭제 대응

CSAP D-06 요건에 따라 감사 로그는 삭제가 불가능한 append-only 구조입니다. 하지만 실수로 다른 데이터를 삭제했을 때의 대응 방법입니다.

```sql
-- 즉시 실행: 추가 삭제 방지 (트랜잭션 중이면 ROLLBACK 가능)
-- 트랜잭션 중인 경우:
ROLLBACK;  -- 아직 COMMIT 전이면 이것으로 복구 가능

-- 이미 COMMIT된 경우: PITR 복구 필요 (다음 섹션 참조)

-- 감사 로그의 append-only 구조 확인
-- audit-service/src/lib/append-only.ts 참조
-- AuditLog 테이블에는 DELETE 트리거로 삭제 방지:
SELECT trigger_name, event_manipulation
FROM information_schema.triggers
WHERE event_object_table = 'AuditLog';

-- 만약 삭제 방지 트리거가 없다면 추가
CREATE OR REPLACE FUNCTION prevent_audit_log_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog 레코드 삭제 금지 — CSAP D-06 요건 (감사 추적 무결성)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_delete_audit_log
  BEFORE DELETE ON "AuditLog"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_delete();

-- 실수로 삭제된 일반 데이터 복구는 PITR 사용 (다음 섹션)
```

### 7.2 PITR(Point-in-Time Recovery) 복구 절차

```
PITR 복구 전제 조건:
  - PostgreSQL WAL 아카이빙 활성화 (postgresql.conf)
    wal_level = replica
    archive_mode = on
    archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'

  - 또는 Velero + CloudNativePG PITR 기능 사용 (권장)

우리 프로젝트 PITR 절차 (Velero 기반):
```

```shell
# 1단계: 장애 발생 시각 확인
# 감사 로그에서 삭제 작업 발생 시각 파악
kubectl exec -n saas-system postgresql-0 -- \
  psql -U postgres -d saas_db -c \
  "SELECT * FROM \"AuditLog\"
   WHERE action LIKE '%DELETE%'
   ORDER BY created_at DESC LIMIT 10;"

# 2단계: 사용 가능한 Velero 백업 목록 확인
velero backup get

# 백업 예시 출력:
# NAME                          STATUS   CREATED                   EXPIRES
# saas-backup-20260412-090000   Completed 2026-04-12 09:00:00 +0000    29d
# saas-backup-20260412-030000   Completed 2026-04-12 03:00:00 +0000    29d

# 3단계: 삭제 발생 시각보다 직전 백업 선택
# 예: 삭제 발생 14:30, 09:00 백업 선택

# 4단계: 복구 전 현재 상태 백업 (현재 데이터 보존)
velero backup create pre-restore-backup-$(date +%Y%m%d%H%M%S) \
  --include-namespaces saas-system

# 5단계: 선택적 복구 (특정 리소스만)
velero restore create restore-$(date +%Y%m%d%H%M%S) \
  --from-backup saas-backup-20260412-090000 \
  --include-namespaces saas-system \
  --include-resources PersistentVolumeClaim  # DB 볼륨만 복구

# 6단계: 복구 상태 모니터링
velero restore describe restore-20260412-143000 --details

# 7단계: 데이터 검증
kubectl exec -n saas-system postgresql-0 -- \
  psql -U postgres -d saas_db -c \
  "SELECT count(*) FROM \"User\"; SELECT count(*) FROM \"AuditLog\";"

# 8단계: 복구 완료 후 감사 기록 (CSAP D-06)
# 복구 작업 자체도 감사 로그에 기록해야 함
```

### 7.3 백업 상태 확인 명령어

```shell
# Velero 백업 현황 확인
velero backup get --output json | jq '.items[] | {name: .metadata.name, status: .status.phase, created: .metadata.creationTimestamp}'

# 최신 백업이 성공인지 확인
LATEST_BACKUP=$(velero backup get --output json | jq -r '.items | sort_by(.metadata.creationTimestamp) | last | .metadata.name')
velero backup describe "$LATEST_BACKUP"

# PostgreSQL 내장 백업 상태 (WAL 아카이빙)
kubectl exec -n saas-system postgresql-0 -- \
  psql -U postgres -c \
  "SELECT pg_current_wal_lsn(), pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0')/1024/1024 AS wal_total_mb;"

# CloudNativePG 클러스터 상태 (CloudNativePG 사용 시)
kubectl get cluster -n saas-system
kubectl describe cluster postgresql-cluster -n saas-system | grep -A 5 "Backup"

# 백업 알림 확인 (Alertmanager에 백업 실패 알림 설정)
kubectl get prometheusrule backup-alerts -n monitoring -o yaml | grep -A 5 "alert: BackupFailed"
```

### 7.4 복구 시간 목표(RTO) 달성 확인

```
CSAP D-10 가용성 요건에 따른 RTO 목표:
  - 일반 서비스 데이터: RTO 4시간 이내 (중급 CSAP)
  - 감사 로그: RTO 24시간 이내 (비실시간 복구 허용)
  - 사용자 인증 데이터: RTO 1시간 이내 (우선 복구)

RTO 달성 확인 시나리오 (분기별 DR 훈련 시):
```

```shell
# DR 훈련: PITR 복구 시간 측정
DR_START=$(date +%s)

# 1. 백업에서 복구 시작
velero restore create dr-test-restore \
  --from-backup saas-backup-20260412-090000 \
  --include-namespaces saas-system-dr-test

# 2. 복구 완료 대기 및 시간 측정
while true; do
  STATUS=$(velero restore get dr-test-restore -o jsonpath='{.status.phase}')
  echo "복구 상태: $STATUS (경과: $(( $(date +%s) - DR_START ))초)"
  if [ "$STATUS" = "Completed" ] || [ "$STATUS" = "Failed" ]; then
    break
  fi
  sleep 30
done

DR_END=$(date +%s)
echo "총 복구 시간: $(( (DR_END - DR_START) / 60 ))분"

# 3. 복구된 데이터 검증
kubectl exec -n saas-system-dr-test postgresql-0 -- \
  psql -U postgres -d saas_db -c \
  "SELECT 'users' AS table_name, count(*) FROM \"User\"
   UNION ALL
   SELECT 'audit_logs', count(*) FROM \"AuditLog\";"

# 4. RTO 달성 여부 기록 (CSAP 증거 자료)
echo "DR 훈련 결과: $(date), 복구 시간: $(( (DR_END - DR_START) / 60 ))분, 목표 RTO: 240분" \
  >> /data/ai-saas/.claude/audit.jsonl
```

---

## 8. 실전 시나리오 3가지

### 시나리오 1: N+1 쿼리로 인한 API 타임아웃

**상황**: 오전 10시, 사용자 목록 API(`GET /api/v1/admin/users`)가 30초 타임아웃으로 500 에러 반환. 평소 200ms 이하였으나 갑자기 느려짐. 동시에 PostgreSQL CPU 사용률이 95%에 도달.

**진단 과정**:

```shell
# 1단계: 느린 API 엔드포인트 확인
kubectl logs -n saas-system deployment/api-gateway --since=10m \
  | grep -E "timeout|500|/admin/users" | head -20

# 2단계: 현재 실행 중인 쿼리 확인
kubectl exec -n saas-system postgresql-0 -- \
  psql -U postgres -d saas_db -c \
  "SELECT pid, query, now()-query_start AS dur, state
   FROM pg_stat_activity
   WHERE state = 'active'
   ORDER BY dur DESC LIMIT 20;"

# 출력에서 동일한 쿼리가 수백 개 실행 중인 것을 발견:
# SELECT * FROM "AuditLog" WHERE "actorId" = $1 ORDER BY created_at DESC
# (이 쿼리가 100개 사용자에 대해 100번 반복 실행됨)
```

```sql
-- 3단계: pg_stat_statements에서 패턴 확인
SELECT calls, round((total_exec_time/calls)::numeric, 2) AS avg_ms, query
FROM pg_stat_statements
WHERE query LIKE '%AuditLog%actorId%'
ORDER BY calls DESC LIMIT 5;

-- 출력: 이 쿼리가 짧은 시간에 5000번 호출됨
-- 원인: 사용자 목록 조회 후 각 사용자의 감사 로그를 별도로 조회하는 N+1 패턴
```

```typescript
// 4단계: 코드에서 N+1 패턴 확인
// user.service.ts
async listUsers(tenantId: string, options: ListOptions) {
  const users = await prisma.user.findMany({
    where: { tenantId },
    take: options.limit,
  });

  // ❌ N+1 쿼리 발생!
  const usersWithLogs = await Promise.all(
    users.map(async (user) => ({
      ...user,
      lastActivity: await prisma.auditLog.findFirst({
        where: { actorId: user.id },
        orderBy: { createdAt: 'desc' },
      }),
    })),
  );
  return usersWithLogs;
}

// ✅ 수정: include 또는 별도 배치 조회
async listUsers(tenantId: string, options: ListOptions) {
  const users = await prisma.user.findMany({
    where: { tenantId },
    take: options.limit,
    include: {
      _count: { select: { auditLogs: true } },
    },
  });

  // 마지막 활동 시간: 별도 배치 쿼리 (N번이 아닌 1번)
  const userIds = users.map((u) => u.id);
  const lastActivities = await prisma.auditLog.findMany({
    where: {
      actorId: { in: userIds },
    },
    orderBy: { createdAt: 'desc' },
    distinct: ['actorId'],  // 각 사용자당 최신 1개
    select: { actorId: true, createdAt: true },
  });

  const lastActivityMap = Object.fromEntries(
    lastActivities.map((a) => [a.actorId, a.createdAt]),
  );

  return users.map((u) => ({
    ...u,
    lastActivity: lastActivityMap[u.id],
  }));
}
```

**결과**: 수정 후 API 응답 시간 30초 → 85ms (350배 개선). PostgreSQL CPU 95% → 12%.

---

### 시나리오 2: 마이그레이션 후 404 응답 급증

**상황**: 오후 2시에 마이그레이션 배포 후 즉시 특정 API 엔드포인트에서 404 응답이 급증. 배포 전에는 정상이었음.

**진단 과정**:

```shell
# 1단계: 에러 로그 확인
kubectl logs -n saas-system deployment/user-service --since=30m \
  | grep -E "404|not found|PrismaClientValidationError" | head -20

# 출력에서 발견:
# PrismaClientValidationError: Unknown field `lastLoginAt` for select statement on model `User`

# 2단계: Prisma 스키마 vs DB 실제 구조 비교
# 현재 Prisma 스키마 확인
cat platform/services/user-service/prisma/schema.prisma | grep -A 20 "model User"

# DB 실제 컬럼 확인
kubectl exec -n saas-system postgresql-0 -- \
  psql -U postgres -d saas_db -c "\d \"User\""

# 발견: Prisma 스키마에는 lastLoginAt 컬럼이 있는데 DB에는 없음
# (마이그레이션이 완전히 적용되지 않은 상태)
```

```shell
# 3단계: 마이그레이션 상태 확인
cd platform/services/user-service
npx prisma migrate status

# 출력:
# - 20260412_add_last_login: Not applied (Failed)

# 4단계: 마이그레이션 실패 원인 확인
kubectl exec -n saas-system postgresql-0 -- \
  psql -U postgres -d saas_db -c \
  "SELECT migration_name, logs FROM \"_prisma_migrations\"
   WHERE migration_name = '20260412_add_last_login';"

# 로그에서 확인: "lock timeout detected" (다른 서비스가 테이블 점유 중)
```

```shell
# 5단계: 임시 대응 — 이전 버전으로 롤백
kubectl rollout undo deployment/user-service -n saas-system

# 6단계: 마이그레이션 재시도 (락 원인 제거 후)
# 다른 서비스 일시 중단
kubectl scale deployment api-gateway --replicas=0 -n saas-system

# 마이그레이션 실행
DATABASE_URL="..." npx prisma migrate deploy

# 서비스 복구
kubectl scale deployment api-gateway --replicas=3 -n saas-system
kubectl rollout restart deployment/user-service -n saas-system

# 7단계: 검증
kubectl logs -n saas-system deployment/user-service --since=5m \
  | grep -E "error|ERROR" | head -10
```

**근본 원인**: 마이그레이션 배포 절차에 "서비스 트래픽 차단 후 마이그레이션" 단계가 없었음. 개선: `prisma migrate deploy`를 `preStart` 훅이 아닌 별도 마이그레이션 Job으로 분리.

---

### 시나리오 3: 특정 테넌트 쿼리 응답 10배 지연

**상황**: 테넌트 B만 API 응답이 평균 5초, 다른 테넌트는 300ms. SLA 위반 직전. 테넌트 B 담당자 긴급 민원 접수.

**진단 과정**:

```sql
-- 1단계: 테넌트별 쿼리 성능 비교
SELECT "tenantId",
       count(*) AS queries,
       avg(extract(epoch from (now() - query_start)) * 1000) AS avg_ms_waiting
FROM pg_stat_activity
WHERE state = 'active'
  AND query NOT LIKE '%pg_%'
GROUP BY "tenantId";
-- 이 쿼리는 연결 수준 tenantId가 없으므로 로그로 분석

-- 2단계: 테넌트 B의 테이블 크기 확인
-- tenant-002가 테넌트 B라고 가정
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
       pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

```sql
-- 3단계: 테넌트별 데이터 분포 확인
SELECT "tenantId", count(*) AS row_count
FROM "AuditLog"
GROUP BY "tenantId"
ORDER BY row_count DESC
LIMIT 10;

-- 출력 발견:
-- tenant-002: 8,500,000 행 (전체의 85%!)
-- tenant-001: 300,000 행
-- tenant-003: 250,000 행

-- 테넌트 B가 비정상적으로 많은 데이터 보유
-- 원인: 테넌트 B가 배치 작업으로 대량 감사 로그 생성
```

```sql
-- 4단계: 인덱스 상태 확인 (대형 테이블에서 통계 오래됨)
SELECT relname, last_analyze, last_autoanalyze, n_live_tup, n_dead_tup
FROM pg_stat_user_tables
WHERE relname = 'AuditLog';

-- 출력: last_analyze가 2주 전! (대량 데이터 추가 후 통계 미갱신)

-- 5단계: 즉각 조치 — ANALYZE로 통계 갱신
ANALYZE "AuditLog";

-- 6단계: 테넌트별 파티셔닝 검토 (장기 해결책)
-- 현재 구조: 단일 AuditLog 테이블 (모든 테넌트 혼재)
-- 개선안: 테넌트별 파티션 또는 별도 스키마

-- 7단계: 테넌트 B의 데이터 정리 정책 적용
-- CSAP D-06: 보존 기간 초과 데이터 삭제 (1년 이상 된 로그)
DELETE FROM "AuditLog"
WHERE "tenantId" = 'tenant-002'
  AND created_at < now() - interval '1 year';

-- 삭제 후 VACUUM으로 공간 회수
VACUUM ANALYZE "AuditLog";
```

**결과**: ANALYZE 실행 후 즉시 테넌트 B 응답 시간 5초 → 320ms로 정상화. 장기 해결책으로 AuditLog 테이블에 월별 파티셔닝 도입 계획.

---

## 9. 학습 체크리스트

```
DB 디버깅 도구
[ ] psql에서 현재 실행 중인 쿼리를 조회하는 SQL을 작성할 수 있다
[ ] k9s 또는 kubectl로 PostgreSQL Pod에 직접 접속할 수 있다
[ ] pg_stat_statements에서 느린 쿼리 TOP 10을 찾을 수 있다
[ ] EXPLAIN ANALYZE 출력에서 Seq Scan, Index Scan을 구분할 수 있다
[ ] pg_activity로 실시간 쿼리를 모니터링할 수 있다

연결 문제
[ ] 커넥션 풀 고갈을 진단하는 SQL을 실행할 수 있다
[ ] idle in transaction 상태의 연결을 찾아 강제 종료할 수 있다
[ ] Prisma connection_limit 환경 변수를 올바르게 설정할 수 있다
[ ] 커넥션 타임아웃 원인 4가지를 설명할 수 있다

느린 쿼리 최적화
[ ] N+1 쿼리 패턴을 코드에서 발견하고 수정할 수 있다
[ ] EXPLAIN ANALYZE에서 cost와 actual time을 해석할 수 있다
[ ] 적절한 인덱스를 CONCURRENTLY 옵션으로 추가할 수 있다
[ ] Seq Scan이 반드시 문제가 아닌 상황을 설명할 수 있다

락 및 마이그레이션
[ ] 데드락 발생 원인과 방지 패턴을 설명할 수 있다
[ ] 락 대기 쿼리를 찾는 SQL을 실행할 수 있다
[ ] 마이그레이션 더티 상태를 해결하는 절차를 설명할 수 있다
[ ] prisma migrate resolve 명령어를 올바르게 사용할 수 있다

멀티테넌시 및 CSAP
[ ] RLS 정책 상태를 psql로 확인할 수 있다
[ ] 테넌트 데이터 누출을 탐지하는 SQL을 작성할 수 있다
[ ] PITR 복구 절차를 단계별로 설명할 수 있다
[ ] CSAP D-06 요건에 따른 감사 로그 보존 기간을 안다
```

---

## 10. 변경 이력

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|---------|--------|
| 1.0.0 | 2026-04-12 | 초안 작성 — PostgreSQL + Prisma 완전 트러블슈팅 가이드 | Implementer (Sonnet) |

---

*다음 문서*: `09-troubleshooting/07-cache-debugging.md` (Redis 캐시 디버깅)
*관련 파일*: `/data/ai-saas/platform/services/ai-service/src/lib/query-plan-analyzer.ts`, `/data/ai-saas/platform/services/ai-service/src/lib/multitenant-rls.ts`, `/data/ai-saas/platform/services/audit-service/src/handlers/audit.handler.ts`
