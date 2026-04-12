# 성능 최적화 FAQ

> **문서 ID**: ONBOARD-11-FAQ-06
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **대상**: 개발자, DevOps 엔지니어
> **선행 학습**: `09-troubleshooting/03-performance-guide.md`, `03-development/15-redis-patterns.md`, `05-monitoring/09-sre-practices.md`
> **CSAP**: D-07 (가용성), D-10 (과부하 방지), D-11 (가상화 보안)

---

## 목차

- [카테고리 1: API 응답 시간](#카테고리-1-api-응답-시간) (Q01~Q06)
- [카테고리 2: 데이터베이스](#카테고리-2-데이터베이스) (Q07~Q12)
- [카테고리 3: Redis 캐싱](#카테고리-3-redis-캐싱) (Q13~Q16)
- [카테고리 4: Kubernetes 리소스](#카테고리-4-kubernetes-리소스) (Q17~Q21)
- [카테고리 5: 모니터링 기반 성능 진단](#카테고리-5-모니터링-기반-성능-진단) (Q22~Q25)

---

## 성능 진단 의사결정 흐름도

```mermaid
flowchart TD
    START([성능 이슈 감지]) --> SYM["증상 파악\n- API 느림?\n- DB 느림?\n- 메모리/CPU?"]

    SYM --> Q1{"어느 계층?"}

    Q1 -->|"API 응답 느림\n(>500ms)"| API["카테고리 1\nAPI 응답 시간\nQ01~Q06"]
    Q1 -->|"DB 쿼리 느림\n(>100ms)"| DB["카테고리 2\n데이터베이스\nQ07~Q12"]
    Q1 -->|"캐시 미스 많음\n(<80% 히트율)"| CACHE["카테고리 3\nRedis 캐싱\nQ13~Q16"]
    Q1 -->|"k8s 리소스 부족\n(OOM/CPU 쓰로틀)"| K8S["카테고리 4\nKubernetes\nQ17~Q21"]
    Q1 -->|"SLO/메트릭 이상"| MON["카테고리 5\n모니터링 진단\nQ22~Q25"]

    API --> FIX["해결책 적용\n+ 성능 재측정"]
    DB --> FIX
    CACHE --> FIX
    K8S --> FIX
    MON --> FIX

    FIX --> OK{"개선됨?"}
    OK -->|"예"| DONE([완료 + 예방책 수립])
    OK -->|"아니오"| Q1

    style START fill:#F44336,color:#fff
    style DONE fill:#4CAF50,color:#fff
    style FIX fill:#FF9800,color:#fff
```

---

## 성능 지표 기준값 요약

```mermaid
graph LR
    subgraph API["API 응답 시간"]
        A1["P50 < 100ms ✅\nP99 < 500ms ✅\nP99 > 2000ms ⛔"]
    end

    subgraph DB["DB 쿼리"]
        D1["단순 조회 < 20ms ✅\n복잡 집계 < 100ms ✅\nN+1 감지 즉시 수정 ⛔"]
    end

    subgraph REDIS["Redis"]
        R1["히트율 > 80% ✅\nP99 < 10ms ✅\nmaxmemory 70% 미만 ✅"]
    end

    subgraph K8S["Kubernetes"]
        K1["CPU 쓰로틀 < 10% ✅\n메모리 limit 80% 미만 ✅\nHPA 정상 작동 ✅"]
    end

    subgraph SLO["SLO 에러 버짓"]
        S1["소진율 < 1 정상 ✅\n소진율 5~10 개발 중단 ⚠️\n소진율 > 10 즉시 롤백 ⛔"]
    end
```

---

## 카테고리 1: API 응답 시간

---

### Q01. API가 2초 이상 걸립니다. 어디서 병목인지 어떻게 찾나요?

**문제 상황**: 특정 API 엔드포인트의 응답 시간이 지속적으로 2초를 넘습니다. 무엇부터 봐야 할지 모르겠습니다.

**진단 방법 — 3단계 접근**

1단계: 레이턴시 측정 및 위치 특정

```bash
# curl로 전체 응답 시간 측정
curl -w "\n\nTime: %{time_total}s\nDNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTTFB: %{time_starttransfer}s\n" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/subscription/plans

# 반복 측정 (10회 평균)
for i in {1..10}; do
  curl -s -w "%{time_total}\n" -o /dev/null \
    http://localhost:3000/api/v1/subscription/plans
done | awk '{sum+=$1} END {print "평균: " sum/NR "초"}'
```

2단계: Grafana에서 P99 레이턴시 확인

```promql
# Grafana > Explore > Prometheus
# 서비스별 P99 응답 시간 (5분 이동 평균)
histogram_quantile(0.99,
  sum(rate(http_request_duration_seconds_bucket{service="subscription-service"}[5m]))
  by (le, route)
)
```

3단계: 병목 계층 판단

```
측정값 분석:
- TTFB(Time to First Byte) = API 처리 시간
  - TTFB가 길다 → 서버 사이드 처리 문제 (DB/비즈니스 로직)
  - Connect 시간이 길다 → 네트워크/DNS 문제
  - 총 시간 - TTFB가 길다 → 응답 크기(페이로드) 문제

kubectl logs -f deployment/subscription-service -n saas-platform | grep '"time"'
# Fastify 로그에서 응답 시간 확인
```

**해결 방법 (계층별)**

| 병목 위치 | 해결책 |
|---------|--------|
| DB 쿼리 느림 | Q07~Q09 참조 (인덱스, EXPLAIN ANALYZE) |
| N+1 쿼리 | Q10 참조 (Prisma include 최적화) |
| 캐시 미스 | Q13 참조 (Redis 캐싱 전략) |
| CPU 과부하 | 수평 스케일링 (HPA 조정) |
| 응답 페이로드 과대 | 필드 선택 (`select`) + 페이지네이션 |

**예방 방법**: SLO 에러 버짓 정책으로 P99 < 500ms 목표를 유지하면 2초 지점에 도달하기 전에 알림을 받습니다.

**관련 문서**: `09-troubleshooting/03-performance-guide.md` §2, `05-monitoring/09-sre-practices.md` §2

---

### Q02. Fastify 미들웨어가 느린 것 같습니다. 측정 방법은?

**문제 상황**: API 자체는 빠른 것 같은데, 미들웨어(인증, Rate Limiting 등)에서 시간이 걸리는 것 같습니다.

**진단 방법**

Fastify 훅 단계별 시간 측정:

```typescript
// 개발 환경에서 미들웨어 측정 (임시 코드)
// platform/services/api-gateway/src/index.ts 에 추가 (측정 후 제거)

app.addHook('onRequest', async (request, reply) => {
  request.startTime = Date.now()
})

app.addHook('preHandler', async (request, reply) => {
  const elapsed = Date.now() - request.startTime
  if (elapsed > 100) {  // 100ms 초과 시 경고
    request.log.warn({ elapsed, url: request.url }, 'Slow middleware detected')
  }
})

app.addHook('onSend', async (request, reply, payload) => {
  const total = Date.now() - request.startTime
  request.log.info({ total, url: request.url, statusCode: reply.statusCode })
  return payload
})
```

```bash
# Fastify 내장 요청 로그에서 responseTime 확인
kubectl logs deployment/api-gateway -n saas-platform | \
  jq '. | select(.responseTime > 100) | {url, responseTime, reqId}'
```

**공통 미들웨어 성능 기준**:

| 미들웨어 | 정상 | 느림 기준 | 해결책 |
|---------|------|---------|--------|
| JWT 검증 | <5ms | >20ms | 공개키 캐싱 |
| Redis Rate Limit | <10ms | >50ms | Redis 연결 풀 확인 |
| RBAC 권한 확인 | <5ms | >20ms | 권한 목록 메모리 캐싱 |
| DB 인증 조회 | <20ms | >100ms | 인덱스 확인 |

**해결 방법**:
- JWT 공개키: 메모리 캐싱 (매 요청마다 파일 읽기 방지)
- Rate Limit Redis 연결: 연결 풀 `maxRetriesPerRequest: 3` 설정
- 무거운 미들웨어: 특정 경로에만 적용 (`preHandler` 분리)

**관련 문서**: `03-development/12-api-design-guide.md` §2

---

### Q03. 특정 테넌트만 느립니다. 원인 분석 방법은?

**문제 상황**: 전체 시스템은 정상인데 특정 기관(테넌트)의 사용자만 느리다는 민원이 들어왔습니다.

**진단 방법**

```bash
# 테넌트별 응답 시간 분리 (Loki)
{service="api-gateway"} | json | tenantId="<문제 테넌트 ID>"
  | line_format "{{.responseTime}}ms {{.url}}"

# Prisma 쿼리 로그에서 테넌트별 느린 쿼리 확인
{service="subscription-service"} |= "SLOW_QUERY" | json
  | tenantId="<문제 테넌트 ID>"
```

```sql
-- PostgreSQL에서 특정 테넌트 쿼리 성능 확인
EXPLAIN ANALYZE
SELECT s.*, p.name as plan_name
FROM subscriptions s
JOIN plans p ON s.plan_id = p.id
WHERE s.tenant_id = '<문제 테넌트 ID>'
ORDER BY s.created_at DESC
LIMIT 100;
```

**일반적인 원인**:

1. **대용량 데이터 테넌트**: 구독/인보이스 레코드가 비정상적으로 많음
   ```sql
   -- 테넌트별 레코드 수 확인
   SELECT tenant_id, COUNT(*) as count
   FROM subscriptions
   GROUP BY tenant_id
   ORDER BY count DESC
   LIMIT 10;
   ```

2. **인덱스 미사용**: `tenant_id` 복합 인덱스 누락
   ```sql
   -- 인덱스 사용 여부 확인
   SELECT schemaname, tablename, indexname, indexdef
   FROM pg_indexes
   WHERE tablename = 'subscriptions';
   ```

3. **Rate Limit 미적용**: 특정 테넌트가 API를 과도하게 호출
   ```typescript
   // subscription-service/src/routes.ts 의 Rate Limiter 확인
   const readLimiter = createRateLimiter(100, 60, 'rl:sub:read')
   // 테넌트별 제한: 분당 100회
   ```

**해결 방법**:
- 인덱스 누락: `CREATE INDEX CONCURRENTLY` (온라인 인덱스 생성)
- 대용량 페이지네이션: `cursor` 기반 페이지네이션으로 전환
- Rate Limit: 테넌트별 버킷 키 설정

**관련 문서**: `03-development/14-database-design.md`, `03-development/15-redis-patterns.md` §3

---

### Q04. N+1 쿼리를 어떻게 자동으로 탐지하나요?

**문제 상황**: 코드 리뷰에서 N+1 쿼리를 놓쳤습니다. 운영 환경에서 100개의 구독을 조회할 때 101개의 쿼리가 발생하고 있습니다.

**N+1이란?**

```typescript
// ❌ N+1 발생 예시
const subscriptions = await prisma.subscription.findMany({ take: 100 })
// → 1번 쿼리

for (const sub of subscriptions) {
  const plan = await prisma.plan.findUnique({ where: { id: sub.planId } })
  // → N번 쿼리 (구독 100개 = 100번 추가 쿼리)
}
// 총 101번 쿼리!
```

**진단 방법**

```typescript
// 개발 환경에서 Prisma 쿼리 로깅 활성화
// platform/services/*/src/lib/prisma.ts

import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'warn' },
  ],
})

// N+1 탐지: 같은 테이블 쿼리가 반복되는지 확인
prisma.$on('query', (e) => {
  console.log(`Query: ${e.query}`)
  console.log(`Duration: ${e.duration}ms`)
})
```

```bash
# 운영 환경: slow_query_log 활성화 (PostgreSQL)
# postgresql.conf
log_min_duration_statement = 100  # 100ms 이상 쿼리 로그

# pg_stat_statements로 자주 실행되는 쿼리 확인
SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements
WHERE calls > 100
ORDER BY total_exec_time DESC
LIMIT 20;
```

**해결 방법**

```typescript
// ✅ Prisma include로 N+1 해결
const subscriptions = await prisma.subscription.findMany({
  where: { tenantId },
  include: {
    plan: {                          // JOIN으로 한 번에 가져옴
      select: { name: true, slug: true, price: true }
    },
  },
  orderBy: { createdAt: 'desc' },
  take: 100,
})
// → 단 1번 쿼리 (JOIN)
```

**예방 방법**: PR 코드 리뷰 체크리스트에 "반복문 안에 DB 쿼리 없는지" 항목 추가. Prisma의 `log: ['query']` 옵션으로 개발 중 쿼리 수 모니터링.

**관련 문서**: `03-development/13-prisma-advanced.md` §3

---

### Q05. Rate Limiting이 정상 사용자를 차단하고 있습니다. 설정 기준이 있나요?

**문제 상황**: 업무 처리 중인 정상 사용자가 429 Too Many Requests 오류를 받습니다. Rate Limit 기준을 어떻게 잡아야 하나요?

**이 프로젝트의 Rate Limit 기준**:

```typescript
// platform/services/subscription-service/src/routes.ts 실제 설정
const readLimiter = createRateLimiter(100, 60, 'rl:sub:read')   // 분당 100회
const writeLimiter = createRateLimiter(20, 60, 'rl:sub:write')  // 분당 20회
const cancelLimiter = createRateLimiter(5, 300, 'rl:sub:cancel')// 5분당 5회
```

**설정 기준 공식**:

```
정상 사용자 기준 = 실제 사용 패턴 × 2 (여유 계수)

예시:
- 사용자가 구독 목록을 1분에 최대 10번 조회 → 한도 20~30
- 배치 작업이 1분에 최대 50번 호출 → 한도 100~150
- 취소는 일반적으로 드물게 발생 → 5분당 3~5회
```

**진단: 현재 Rate Limit 히트율 확인**:

```bash
# Redis에서 Rate Limit 상태 확인
redis-cli KEYS "rl:sub:*" | head -20
redis-cli GET "rl:sub:read:<사용자IP>"

# Loki에서 429 에러 패턴 확인
{service="api-gateway"} |= "429" | json
  | line_format "{{.ip}} {{.url}} {{.ts}}"
  | count_over_time([1m])
```

**해결 방법**:
- 정당한 배치 작업: 별도 API 키 + 높은 한도 적용
- 특정 IP 화이트리스트: Rate Limit 미들웨어에서 IP 제외
- 동적 조정: 에러 버짓 여유분에 따라 한도 조정

**관련 문서**: `03-development/15-redis-patterns.md` §3

---

### Q06. API 응답 페이로드가 너무 큽니다. 어떻게 줄이나요?

**문제 상황**: 특정 API가 3MB 이상의 JSON을 반환하여 모바일/저속 네트워크에서 느립니다.

**진단 방법**:

```bash
# 응답 크기 측정
curl -s -o /dev/null -w "%{size_download}" \
  http://localhost:3000/api/v1/subscription/plans

# 응답 본문 크기 분석
curl http://localhost:3000/api/v1/subscription/stats | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(len(json.dumps(d)))"
```

**해결 방법**:

```typescript
// 1. 필드 선택 (SELECT 최소화)
const plans = await prisma.plan.findMany({
  select: {            // ✅ 필요한 필드만
    id: true,
    name: true,
    price: true,
    interval: true,
    // maxStorage: false — 클라이언트에 불필요한 필드 제외
  },
  where: { isActive: true },
  take: 100,
})

// 2. 페이지네이션 적용
const page = parseInt(request.query.page ?? '1', 10)
const pageSize = Math.min(parseInt(request.query.pageSize ?? '20', 10), 100)
const items = await prisma.subscription.findMany({
  skip: (page - 1) * pageSize,
  take: pageSize,
})

// 3. gzip 압축 (Fastify 플러그인)
await app.register(import('@fastify/compress'), {
  threshold: 1024,  // 1KB 이상만 압축
})
```

**예방 방법**: API 설계 시 기본 페이지 크기 20, 최대 100으로 제한. BigInt → toString() 변환 외 불필요한 필드 포함 방지.

---

## 카테고리 2: 데이터베이스

---

### Q07. PostgreSQL EXPLAIN ANALYZE를 어떻게 읽나요?

**문제 상황**: 느린 쿼리가 있어서 EXPLAIN ANALYZE를 실행했는데 결과를 해석하지 못하겠습니다.

**실행 방법**:

```bash
# Prisma에서 연결
npx prisma db execute --stdin << 'EOF'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT s.*, p.name
FROM subscriptions s
JOIN plans p ON s.plan_id = p.id
WHERE s.tenant_id = 'abc-123'
ORDER BY s.created_at DESC
LIMIT 20;
EOF
```

**출력 읽는 법**:

```
Limit  (cost=0.00..15.20 rows=20 width=218)
  (actual time=0.043..2.341 rows=20 loops=1)
  ->  Sort  (cost=0.00..45.60 rows=3000 width=218)
        (actual time=8.234..8.251 rows=20 loops=1)
        Sort Key: s.created_at DESC
        Sort Method: top-N heapsort  Memory: 32kB
        ->  Hash Join  (cost=10.00..33.40 rows=3000 width=218)
              (actual time=0.201..5.432 rows=3000 loops=1)
              Hash Cond: (s.plan_id = p.id)
              ->  Seq Scan on subscriptions s
                    (cost=0.00..18.30 rows=3000 width=180)
                    Filter: (tenant_id = 'abc-123')
                    Rows Removed by Filter: 50000       ← ⚠️ 50,000개 중 3,000개만 필요
              ->  Hash  (cost=5.00..5.00 rows=400 width=38)
                    (actual time=0.089..0.089 rows=10 loops=1)
                    ->  Seq Scan on plans p

Planning Time: 0.234 ms
Execution Time: 8.891 ms                              ← 총 실행 시간
```

**핵심 경고 신호**:

| 패턴 | 의미 | 해결책 |
|------|------|--------|
| `Seq Scan` + `Rows Removed by Filter: 큰 수` | 풀 스캔 + 대량 필터링 | 인덱스 추가 |
| `actual time >> cost` | 통계 오래됨 | `ANALYZE table_name` 실행 |
| `Sort Method: external merge Disk` | 정렬에 디스크 사용 | `work_mem` 증가 또는 인덱스 정렬 |
| `loops=N` (큰 N) | 반복 실행 | N+1 쿼리 의심, JOIN으로 전환 |

**위 예시의 문제 해결**:

```sql
-- tenant_id + created_at 복합 인덱스 생성
CREATE INDEX CONCURRENTLY idx_subscriptions_tenant_created
ON subscriptions (tenant_id, created_at DESC);

-- 재실행 후 확인 → Seq Scan이 Index Scan으로 변경되어야 함
```

**관련 문서**: `03-development/14-database-design.md` §4

---

### Q08. 인덱스를 추가했는데 왜 빠르지 않나요?

**문제 상황**: EXPLAIN ANALYZE에서 Seq Scan이 나와서 인덱스를 추가했는데 여전히 느립니다.

**진단 방법**:

```sql
-- 1. 인덱스가 실제로 생성되었는지 확인
SELECT indexname, indexdef, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE tablename = 'subscriptions';

-- 2. PostgreSQL이 왜 인덱스를 사용하지 않는지 확인
-- (인덱스가 있어도 옵티마이저가 Seq Scan을 선택할 수 있음)
SET enable_seqscan = off;  -- 강제로 인덱스 사용 후 시간 비교
EXPLAIN ANALYZE SELECT ...
SET enable_seqscan = on;
```

**인덱스를 사용하지 않는 일반적인 이유**:

```sql
-- 이유 1: 테이블이 너무 작음 (Seq Scan이 더 빠름)
-- 수천 건 미만은 Seq Scan이 유리

-- 이유 2: 통계 정보 오래됨 → ANALYZE 실행
ANALYZE subscriptions;

-- 이유 3: 함수 적용으로 인덱스 무력화
-- ❌ 인덱스 무력화
WHERE LOWER(name) = 'agency a'

-- ✅ 함수 인덱스 사용
CREATE INDEX idx_tenants_name_lower ON tenants (LOWER(name));

-- 이유 4: 선택도(selectivity)가 낮음 (전체의 30% 이상)
-- status = 'ACTIVE'가 전체의 70%라면 인덱스 효과 없음

-- 이유 5: 인덱스 컬럼 순서 불일치 (복합 인덱스)
-- 인덱스: (tenant_id, status)
-- 쿼리: WHERE status = 'ACTIVE' → tenant_id 없음 → 인덱스 미사용
```

**해결 방법**:

```sql
-- 통계 갱신
ANALYZE subscriptions;

-- 함수 인덱스 (LOWER 예시)
CREATE INDEX CONCURRENTLY idx_tenants_name_lower ON tenants (LOWER(name));

-- 부분 인덱스 (특정 조건에만 인덱스)
CREATE INDEX CONCURRENTLY idx_subscriptions_active
ON subscriptions (tenant_id, created_at DESC)
WHERE status = 'ACTIVE';  -- ACTIVE 구독만 인덱스 → 크기 감소, 효율 증가
```

---

### Q09. 커넥션 풀이 고갈되었습니다. 어떻게 확인하나요?

**문제 상황**: 갑자기 `Cannot connect to database` 에러가 발생합니다. Pod를 재시작하면 잠깐 좋아지지만 곧 다시 발생합니다.

**진단 방법**:

```bash
# 현재 DB 연결 상태 확인
kubectl exec -it deployment/subscription-service -n saas-platform -- \
  node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); p.\$connect().then(() => console.log('OK'))"

# PostgreSQL에서 연결 수 직접 확인
kubectl exec -it postgres-0 -n saas-platform -- \
  psql -U postgres -c "
    SELECT
      state,
      COUNT(*) as count,
      MAX(now() - state_change) as max_duration
    FROM pg_stat_activity
    WHERE datname = 'saasdb'
    GROUP BY state;
  "
```

```
예상 출력:
 state  | count | max_duration
--------+-------+-------------
 active |    12 | 00:00:02.341
 idle   |    85 | 00:30:15.432   ← idle 연결이 많으면 풀 낭비
 NULL   |     3 | 00:00:00.000
```

**Prisma 연결 풀 설정**:

```typescript
// platform/services/*/src/lib/prisma.ts
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Prisma 기본값: connection_limit = CPU 코어수 * 2 + 1
  // 명시적 설정 방법: DATABASE_URL에 ?connection_limit=10 추가
})

// 최적 연결 풀 크기 계산
// DB 최대 연결 수: pg_max_connections (기본 100)
// 권장 공식: (서비스 수) × (서비스당 연결 수) <= max_connections * 0.8
// 예: 10개 서비스 × 5연결 = 50 <= 80 (100 * 0.8)
```

**해결 방법**:

```bash
# 1. DATABASE_URL에 연결 풀 제한 추가
DATABASE_URL="postgresql://user:pass@postgres:5432/saasdb?connection_limit=5&pool_timeout=10"

# 2. idle 연결 정리
# postgresql.conf
idle_in_transaction_session_timeout = 30000  # 30초 후 idle 연결 종료

# 3. PgBouncer 도입 (커넥션 풀러)
# k3s에 PgBouncer 배포 후 각 서비스의 DATABASE_URL을 PgBouncer로 변경
```

---

### Q10. Prisma에서 대량 데이터를 효율적으로 처리하는 방법은?

**문제 상황**: 월말 정산 배치 작업에서 10만 건의 인보이스를 처리해야 합니다. 한 번에 가져오면 OOM이 발생합니다.

**진단 방법**:

```bash
# 처리 시간 및 메모리 사용량 측정
kubectl top pods -n saas-platform --containers | grep billing
# 배치 실행 중 메모리 증가 패턴 관찰
```

**해결 방법 — 커서 기반 배치 처리**:

```typescript
// ❌ 잘못된 방법: 전체 로드
const allInvoices = await prisma.invoice.findMany({
  where: { status: 'issued' },
  // 10만 건을 메모리에 한 번에 적재 → OOM
})

// ✅ 올바른 방법: 커서 기반 페이지네이션
async function processInvoicesInBatches(
  batchSize: number = 1000,
  processFn: (invoices: Invoice[]) => Promise<void>
): Promise<void> {
  let cursor: string | undefined = undefined
  let totalProcessed = 0

  while (true) {
    const invoices = await prisma.invoice.findMany({
      where: { status: 'issued' },
      take: batchSize,
      skip: cursor ? 1 : 0,       // 커서 이후부터
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: 'asc' },     // 커서 기반 정렬 필수
    })

    if (invoices.length === 0) break

    await processFn(invoices)     // 배치 단위 처리
    totalProcessed += invoices.length
    cursor = invoices[invoices.length - 1].id  // 다음 커서

    // 메모리 해제를 위한 명시적 GC 힌트 (Node.js)
    if (global.gc) global.gc()
  }

  console.log(`총 ${totalProcessed}건 처리 완료`)
}

// 사용
await processInvoicesInBatches(1000, async (invoices) => {
  for (const invoice of invoices) {
    await generateTaxInvoice(invoice)
  }
})
```

**대량 삽입 최적화**:

```typescript
// ❌ 개별 삽입 (N번 쿼리)
for (const item of largeArray) {
  await prisma.payment.create({ data: item })
}

// ✅ createMany (단일 쿼리)
await prisma.payment.createMany({
  data: largeArray,
  skipDuplicates: true,  // 중복 건너뜀
})
```

---

### Q11. 트랜잭션이 오래 걸려서 Lock 경합이 발생합니다. 어떻게 해결하나요?

**문제 상황**: 결제 처리 중 `deadlock detected` 또는 `could not serialize access` 오류가 간헐적으로 발생합니다.

**진단 방법**:

```sql
-- 현재 Lock 대기 중인 쿼리 확인
SELECT
  blocked_locks.pid AS blocked_pid,
  blocked_activity.query AS blocked_statement,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity
  ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.relation = blocked_locks.relation
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity
  ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

**해결 방법 — 트랜잭션 최소화**:

```typescript
// platform/services/billing-service/src/handlers/billing.handler.ts
// 실제 TOCTOU 방어 패턴

// ❌ 긴 트랜잭션 (Lock 보유 시간 ↑)
const payment = await prisma.$transaction(async (tx) => {
  const invoice = await tx.invoice.findUnique(...)  // Lock 획득
  await someExternalApiCall()                        // ← 여기서 Lock 유지 (위험!)
  const created = await tx.payment.create(...)
  return created
})

// ✅ 짧은 트랜잭션 (Lock 보유 시간 최소화)
// 외부 API 호출은 트랜잭션 밖에서 미리 실행
const externalResult = await someExternalApiCall()  // 트랜잭션 전

const payment = await prisma.$transaction(async (tx) => {
  // 재확인 + 원자적 처리만 트랜잭션 안에서
  const latestInvoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: { status: true },
  })
  if (latestInvoice?.status === 'paid') return null

  return await tx.payment.create({ data: { ...externalResult } })
})
```

---

### Q12. Prisma 마이그레이션이 운영 중 DB를 잠그나요?

**문제 상황**: 운영 환경에 새 컬럼을 추가하는 마이그레이션을 실행해야 합니다. 서비스 중단 없이 가능한지 걱정됩니다.

**안전한 마이그레이션 순서**:

```bash
# 1. 마이그레이션 파일 확인 (Lock 유발 여부 체크)
cat prisma/migrations/20260412_add_column/migration.sql

# 위험한 DDL (테이블 Lock 유발):
# ALTER TABLE ... ADD COLUMN (nullable 아닌 경우)
# ALTER TABLE ... ALTER COLUMN TYPE
# CREATE INDEX (CONCURRENTLY 없는 경우)

# 안전한 DDL:
# ALTER TABLE ... ADD COLUMN ... DEFAULT NULL  ← nullable 컬럼 추가 = Lock 없음
# CREATE INDEX CONCURRENTLY  ← 온라인 인덱스
# ALTER TABLE ... ADD COLUMN ... DEFAULT <value>  ← PG 11+ = Lock 없음
```

**무중단 컬럼 추가 패턴**:

```sql
-- ✅ 안전: nullable 컬럼 추가 (즉시 완료, Lock 없음)
ALTER TABLE subscriptions ADD COLUMN notes TEXT;

-- ✅ 안전: PG 11+ Default 값 있는 컬럼 추가 (즉시 완료)
ALTER TABLE subscriptions ADD COLUMN is_trial BOOLEAN DEFAULT false NOT NULL;

-- ⚠️ 주의: 타입 변경은 테이블 재작성 유발 (Long Lock)
-- 대신 새 컬럼 추가 → 데이터 마이그레이션 → 기존 컬럼 삭제 3단계로 진행
```

---

## 카테고리 3: Redis 캐싱

---

### Q13. 캐시 히트율이 낮습니다. 어떻게 개선하나요?

**문제 상황**: Redis INFO 통계를 보니 keyspace_hits / keyspace_misses 비율이 낮습니다 (히트율 60% 미만).

**진단 방법**:

```bash
# Redis 히트율 확인
redis-cli INFO stats | grep -E "keyspace_hits|keyspace_misses"
# keyspace_hits:1234
# keyspace_misses:890

# 히트율 계산
echo "scale=2; 1234 / (1234 + 890) * 100" | bc
# 58.09%

# 어떤 키가 자주 미스되는지 확인
redis-cli MONITOR | grep "MISS" | head -20
# (MONITOR는 성능 영향 있으므로 짧게만 실행)

# TTL이 너무 짧은지 확인
redis-cli TTL "saas:sub:plans:tenant-abc"
```

**히트율이 낮은 원인과 해결책**:

| 원인 | 진단 | 해결책 |
|------|------|--------|
| TTL이 너무 짧음 | `TTL key` 명령으로 확인 | TTL 증가 (변경이 드문 데이터는 1시간+) |
| 키 설계 잘못됨 | 캐시 키 일관성 없음 | 키 네이밍 표준화 |
| 캐시 대상 선정 오류 | 자주 변경되는 데이터 캐싱 | write-through 패턴 적용 |
| Cold start | 서비스 재시작 직후 | 워밍업 스크립트 추가 |

**캐시 키 네이밍 표준** (이 프로젝트):

```typescript
// platform/services/*/src/lib/cache.ts
const CACHE_KEYS = {
  subscriptionPlans: () => 'saas:sub:plans:all',
  tenantSubscriptions: (tenantId: string) => `saas:sub:tenant:${tenantId}`,
  tenantConfig: (tenantId: string) => `saas:tenant:config:${tenantId}`,
}

// TTL 기준
const TTL = {
  plans: 600,          // 10분 (변경 드묾)
  tenantConfig: 300,   // 5분 (변경 가능)
  userPermissions: 60, // 1분 (즉각 반영 필요)
}
```

**관련 문서**: `03-development/15-redis-patterns.md` §2

---

### Q14. Redis 메모리가 가득 찼습니다. 어떻게 하나요?

**문제 상황**: `OOM command not allowed when used memory > maxmemory` 에러가 발생합니다. 새 데이터를 쓸 수 없습니다.

**즉시 대응**:

```bash
# 현재 메모리 사용량 확인
redis-cli INFO memory | grep -E "used_memory_human|maxmemory_human|mem_fragmentation_ratio"

# 가장 큰 키 확인 (상위 10개)
redis-cli --bigkeys 2>/dev/null | tail -20

# 특정 패턴 키 수 확인
redis-cli DBSIZE
redis-cli KEYS "saas:*" | wc -l

# 임시: 불필요한 키 삭제 (TTL 만료된 키 명시 삭제)
redis-cli KEYS "saas:cache:*" | xargs redis-cli DEL
```

**Eviction 정책 확인 및 설정**:

```bash
# 현재 정책 확인
redis-cli CONFIG GET maxmemory-policy

# 권장 정책: allkeys-lru (LRU 기반 전체 키 제거)
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# k3s Redis ConfigMap에 영구 설정
# platform/k8s/redis/configmap.yaml
```

```yaml
# Redis ConfigMap (k3s)
apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-config
data:
  redis.conf: |
    maxmemory 512mb
    maxmemory-policy allkeys-lru
    maxmemory-samples 5
```

**근본 해결**:
1. TTL 미설정 키 점검 → 모든 캐시 키에 TTL 필수
2. Redis 메모리 증설 (k3s 리소스 조정)
3. 대용량 값 → 별도 스토리지 (S3/MinIO) + Redis에는 메타데이터만

**관련 문서**: `03-development/15-redis-patterns.md` §6

---

### Q15. 캐시 스탬피드(Thundering Herd)가 발생했습니다. 해결책은?

**문제 상황**: 자주 조회되는 구독 플랜 캐시가 만료되는 순간, 수백 개의 요청이 동시에 DB에 쏟아집니다. DB가 일시적으로 과부하 상태가 됩니다.

**문제 설명**:

```
타임라인:
09:00:00  구독 플랜 캐시 TTL 만료
09:00:00  요청 #1: 캐시 미스 → DB 쿼리 시작
09:00:00  요청 #2: 캐시 미스 → DB 쿼리 시작 (중복!)
09:00:00  요청 #3~500: 모두 캐시 미스 → 모두 DB 쿼리 (스탬피드!)
09:00:01  DB 과부하, 응답 지연 발생
09:00:02  요청 #1 완료, 캐시 갱신 (너무 늦음)
```

**해결 방법 — 캐시 락 (분산 락)**:

```typescript
// platform/services/subscription-service/src/lib/cache.ts
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)

async function getWithLock<T>(
  cacheKey: string,
  lockKey: string,
  ttl: number,
  fetchFn: () => Promise<T>,
  lockTtl: number = 5000,  // 락 최대 유지 시간 (ms)
): Promise<T> {
  // 1. 캐시 확인
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached)

  // 2. 분산 락 획득 시도 (SET NX EX)
  const lockAcquired = await redis.set(lockKey, '1', 'PX', lockTtl, 'NX')

  if (lockAcquired) {
    try {
      // 락 획득 성공: DB 조회 후 캐시 갱신
      const data = await fetchFn()
      await redis.setex(cacheKey, ttl, JSON.stringify(data))
      return data
    } finally {
      await redis.del(lockKey)  // 락 해제
    }
  } else {
    // 락 획득 실패: 다른 요청이 갱신 중 → 잠시 대기 후 캐시 재확인
    await new Promise(resolve => setTimeout(resolve, 100))
    const refreshed = await redis.get(cacheKey)
    if (refreshed) return JSON.parse(refreshed)
    // 여전히 없으면 직접 조회 (fallback)
    return await fetchFn()
  }
}

// 사용 예: 구독 플랜 목록 조회
const plans = await getWithLock(
  'saas:sub:plans:all',
  'lock:sub:plans:all',
  600,  // 10분 캐시
  () => prisma.plan.findMany({ where: { isActive: true }, take: 100 }),
)
```

**예방 방법 — Stale-while-revalidate**:

```typescript
// 만료 직전에 미리 갱신 (Proactive Refresh)
async function getWithEarlyRefresh<T>(
  cacheKey: string,
  ttl: number,
  earlyRefreshSeconds: number,  // 만료 N초 전 미리 갱신
  fetchFn: () => Promise<T>,
): Promise<T> {
  const cached = await redis.get(cacheKey)
  const remainingTtl = await redis.ttl(cacheKey)

  if (cached) {
    // 만료 임박 시 백그라운드에서 미리 갱신
    if (remainingTtl < earlyRefreshSeconds) {
      fetchFn().then(data => redis.setex(cacheKey, ttl, JSON.stringify(data))).catch(() => {})
    }
    return JSON.parse(cached)
  }

  const data = await fetchFn()
  await redis.setex(cacheKey, ttl, JSON.stringify(data))
  return data
}
```

---

### Q16. Redis 연결이 간헐적으로 끊깁니다. 어떻게 진단하나요?

**문제 상황**: `Error: Connection is closed` 에러가 간헐적으로 발생합니다. 재시작하면 잠깐 좋아집니다.

**진단 방법**:

```bash
# Redis 연결 상태 확인
redis-cli INFO clients | grep -E "connected_clients|blocked_clients|maxclients"
redis-cli INFO stats | grep -E "total_connections_received|rejected_connections"

# k3s에서 Redis Pod 로그 확인
kubectl logs -n saas-platform deployment/redis --tail=100 | grep -i "error\|warn"

# 네트워크 연결 테스트
kubectl exec -it deployment/subscription-service -n saas-platform -- \
  nc -zv redis-service 6379
```

**일반적인 원인과 해결책**:

| 원인 | 증상 | 해결책 |
|------|------|--------|
| `maxclients` 초과 | `rejected_connections` 증가 | `CONFIG SET maxclients 1000` |
| ioredis 재연결 설정 누락 | 연결 끊김 후 복구 안 됨 | `retryStrategy` 설정 |
| TCP keepalive 없음 | 유휴 연결 네트워크 단절 | `keepAlive: 30000` 설정 |

```typescript
// ✅ 견고한 Redis 클라이언트 설정
const redis = new Redis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: 6379,
  retryStrategy: (times: number) => {
    if (times > 10) return null  // 10번 실패 시 포기
    return Math.min(times * 100, 3000)  // 지수 백오프
  },
  reconnectOnError: (err) => {
    const targetError = 'READONLY'
    return err.message.includes(targetError)
  },
  keepAlive: 30000,    // 30초마다 keepalive
  connectTimeout: 10000,
  commandTimeout: 5000,
})
```

---

## 카테고리 4: Kubernetes 리소스

---

### Q17. HPA가 제대로 스케일하지 않습니다. 원인은?

**문제 상황**: CPU 사용률이 높은데 HPA(수평 파드 자동 스케일러)가 파드를 늘리지 않습니다.

**진단 방법**:

```bash
# HPA 상태 확인
kubectl get hpa -n saas-platform
# NAME                   MINPODS  MAXPODS  REPLICAS  CPU    MEMORY
# subscription-service   2        10       2         78%    45%   ← 78%인데 스케일 안 됨?

# 상세 이벤트 확인 (스케일링 실패 원인)
kubectl describe hpa subscription-service -n saas-platform
# 이벤트 섹션에서 실패 원인 확인

# Metrics Server 정상 작동 확인
kubectl top pods -n saas-platform
# 오류 발생 시: Metrics Server 미설치 또는 오류
```

**일반적인 원인**:

```yaml
# 1. CPU request가 설정 안 됨 (HPA는 request 대비 비율로 계산)
# ❌ request 없음 → HPA 계산 불가
resources:
  limits:
    cpu: "500m"
  # request 없음 → HPA 작동 안 함

# ✅ request + limits 모두 설정
resources:
  requests:
    cpu: "200m"
    memory: "256Mi"
  limits:
    cpu: "500m"
    memory: "512Mi"
```

```bash
# 2. 스케일 쿨다운 대기 중
kubectl describe hpa subscription-service -n saas-platform | grep "Last Scale"
# Last Scale Time: 2026-04-12 09:00:00  ← 최근 스케일 후 쿨다운 중

# 3. 파드 수가 maxReplicas에 도달
kubectl get hpa -n saas-platform
# REPLICAS=10, MAXPODS=10 → 이미 최대치

# 4. 리소스 부족으로 파드 스케줄링 실패
kubectl get events -n saas-platform | grep "Insufficient"
```

**해결 방법**:

```yaml
# HPA 설정 개선 예시 (k3s)
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: subscription-service
  namespace: saas-platform
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: subscription-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70   # 70% 초과 시 스케일 아웃
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60   # 1분 관찰 후 스케일 업
    scaleDown:
      stabilizationWindowSeconds: 300  # 5분 안정 후 스케일 다운
```

---

### Q18. Pod OOMKilled가 반복됩니다. 메모리 설정을 어떻게 하나요?

**문제 상황**: `kubectl describe pod`에서 `OOMKilled` (Out of Memory Killed)가 보입니다. 메모리 limit을 올렸는데도 반복됩니다.

**진단 방법**:

```bash
# OOMKill 확인
kubectl describe pod <pod-name> -n saas-platform | grep -A5 "Last State"
# Last State:     Terminated
#   Reason:       OOMKilled   ← 메모리 부족으로 종료
#   Exit Code:    137

# 메모리 사용량 추이 확인 (Grafana PromQL)
container_memory_working_set_bytes{pod=~"subscription-service-.*", namespace="saas-platform"}

# 급증 패턴? 느린 증가? 구분
kubectl top pod --containers -n saas-platform | grep subscription
```

**메모리 설정 기준**:

```yaml
# 메모리 설정 공식
# requests = 평균 사용량 × 1.2
# limits = 최대 사용량 × 1.5 (스파이크 여유)

# 측정 방법:
# 1. 7일간 container_memory_working_set_bytes 최댓값 확인
# 2. 부하 테스트 시 최대 메모리 측정

resources:
  requests:
    memory: "256Mi"   # 평균 200MB → 256MB
  limits:
    memory: "512Mi"   # 최대 350MB → 512MB (여유 50%)
```

**Node.js 메모리 누수 탐지**:

```bash
# Node.js 힙 스냅샷 수집
kubectl exec -it <pod-name> -n saas-platform -- \
  node --expose-gc -e "global.gc(); process.memoryUsage()"

# 힙 사용량 지속 증가 확인 (cron으로 주기적 체크)
kubectl exec <pod-name> -n saas-platform -- \
  node -e "setInterval(() => console.log(JSON.stringify(process.memoryUsage())), 5000)"
```

**일반적인 메모리 누수 원인**:
1. 이벤트 리스너 미해제 (Fastify 훅에서 누적)
2. 클로저에 대규모 배열 캡처
3. Prisma 연결 미반환 (트랜잭션 abort 시)
4. Redis 구독(subscribe) 채널 미해제

---

### Q19. CPU Throttling이 발생합니다. limit 설정은 어떻게 하나요?

**문제 상황**: 서비스 응답은 정상인데 CPU throttling 메트릭이 높습니다. limit을 얼마로 설정해야 할지 모르겠습니다.

**진단 방법**:

```bash
# CPU Throttling 비율 확인 (PromQL)
rate(container_cpu_throttled_seconds_total{
  namespace="saas-platform",
  container="subscription-service"
}[5m])
/
rate(container_cpu_usage_seconds_total{
  namespace="saas-platform",
  container="subscription-service"
}[5m])

# 25% 이상이면 성능 영향 있음
```

**CPU 설정 전략**:

```
CPU 설정 원칙:
- requests: 보장되어야 할 최소 CPU (스케줄러가 이 기준으로 배치)
- limits: 최대 허용 CPU (초과 시 throttling 발생)

잘못된 패턴:
- requests = limits (너무 보수적 → 리소스 낭비)
- limits 없음 (한 파드가 노드 CPU 독점 가능)
- limits << requests (불가능한 설정)

권장 패턴:
- requests = 평균 사용량
- limits = 평균 × 2~3 (스파이크 허용)
```

```yaml
# 예시: auth-service (CPU 집약적인 bcrypt 연산 포함)
resources:
  requests:
    cpu: "100m"     # 평균 0.1 코어
  limits:
    cpu: "500m"     # 최대 0.5 코어 (bcrypt 스파이크 허용)
```

**Throttling 해결책 (limits 조정 전)**:
1. bcrypt 비용 파라미터 확인 (12 → 10으로 낮추면 CPU 30% 감소)
2. 비동기 CPU 집약 작업 → Worker Thread 분리
3. HPA로 수평 확장 (limits 높이는 것보다 효과적)

---

### Q20. KEDA 스케일다운이 트래픽 중에 발생합니다. 설정 방법은?

**문제 상황**: KEDA(Kubernetes Event Driven Autoscaler)가 메시지 큐가 비어 있을 때 파드를 0으로 줄이는데, 이 과정에서 처리 중인 요청이 끊깁니다.

**진단 방법**:

```bash
# KEDA ScaledObject 상태 확인
kubectl get scaledobjects -n saas-platform
kubectl describe scaledobject <name> -n saas-platform | grep -A10 "Status"

# 스케일다운 로그
kubectl get events -n saas-platform | grep "scale down"
```

**Graceful Shutdown 설정**:

```yaml
# Deployment에 terminationGracePeriodSeconds 설정
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 30  # 30초 동안 기존 요청 처리 후 종료
      containers:
      - name: subscription-service
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 5"]  # 로드밸런서 해제 대기
```

```typescript
// Fastify graceful shutdown 구현
// platform/services/subscription-service/src/index.ts
const shutdown = async (signal: string) => {
  app.log.info(`${signal} received, shutting down gracefully`)

  // 새 요청 차단, 기존 요청 완료 대기
  await app.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
```

**KEDA 스케일다운 보호**:

```yaml
# ScaledObject에 cooldownPeriod 설정
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
spec:
  scaleTargetRef:
    name: subscription-service
  minReplicaCount: 1    # 0이 아닌 1로 설정 (트래픽 중 완전 중단 방지)
  maxReplicaCount: 10
  cooldownPeriod: 300   # 스케일다운 전 5분 안정화 대기
  pollingInterval: 30
```

---

### Q21. 파드 재시작이 반복됩니다. CrashLoopBackOff 원인 분석 방법은?

**문제 상황**: `kubectl get pods`에서 `CrashLoopBackOff` 상태가 보입니다. 무엇이 문제인지 알 수 없습니다.

**단계별 진단**:

```bash
# 1. 최근 로그 확인
kubectl logs <pod-name> -n saas-platform --previous | tail -50
# --previous: 이전 컨테이너 (현재 재시작된 컨테이너 이전 것)

# 2. 파드 상세 이벤트 확인
kubectl describe pod <pod-name> -n saas-platform | tail -30

# 3. 재시작 횟수 및 패턴
kubectl get pod <pod-name> -n saas-platform -o jsonpath='{.status.containerStatuses[0].restartCount}'

# 4. Liveness/Readiness 프로브 실패 확인
kubectl describe pod <pod-name> | grep -A5 "Liveness\|Readiness"
```

**일반적인 CrashLoopBackOff 원인**:

| 원인 | 로그 패턴 | 해결책 |
|------|---------|--------|
| 환경 변수 누락 | `[SECURITY] DATABASE_URL 환경변수가 설정되지 않았습니다` | Secret/ConfigMap 확인 |
| DB 연결 실패 | `Cannot connect to database` | DB 서비스 상태 확인 |
| 포트 충돌 | `Error: listen EADDRINUSE` | 같은 포트 사용하는 프로세스 확인 |
| OOMKilled | Exit Code 137 | 메모리 limit 증가 |
| Startup 프로브 실패 | `startupProbe failed` | 초기화 시간 부족, `failureThreshold` 증가 |

```bash
# 환경 변수 디버깅
kubectl exec <pod-name> -n saas-platform -- env | grep DATABASE
# DATABASE_URL이 없으면 Secret 확인

kubectl get secret subscription-service-secret -n saas-platform -o jsonpath='{.data}' | \
  base64 -d
```

---

## 카테고리 5: 모니터링 기반 성능 진단

---

### Q22. Grafana에서 99th percentile 레이턴시를 보는 방법은?

**문제 상황**: 평균 응답 시간은 100ms인데 사용자 민원이 들어옵니다. P99 레이턴시를 어떻게 확인하나요?

**PromQL로 P99 레이턴시 조회**:

```promql
# Grafana > Explore > Prometheus 에서 실행

# 전체 서비스 P99 (최근 5분)
histogram_quantile(0.99,
  sum(rate(http_request_duration_seconds_bucket[5m]))
  by (service, le)
)

# 특정 서비스 + 경로별 P99
histogram_quantile(0.99,
  sum(rate(http_request_duration_seconds_bucket{
    service="subscription-service",
    route="/subscription/plans"
  }[5m]))
  by (route, le)
)

# P50, P95, P99 비교 (분포 파악)
histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket{service="auth-service"}[5m])) by (le))
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service="auth-service"}[5m])) by (le))
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{service="auth-service"}[5m])) by (le))
```

**Grafana 대시보드 패널 설정**:

```
패널 타입: Time series
Title: API P99 Latency
Query: [위 PromQL]
Unit: seconds (s)
Thresholds:
  - Green: 0~0.3 (300ms 미만)
  - Yellow: 0.3~0.5 (500ms 미만)
  - Red: 0.5+ (SLO 위반)
```

**P50 vs P99 해석**:

```
P50 = 50ms, P99 = 2000ms인 경우:
→ 대부분의 요청은 빠르지만 상위 1%가 매우 느림
→ 특정 테넌트, 특정 쿼리에서 이상 발생 의심
→ 꼬리 지연(tail latency) 문제 → 분산 추적으로 원인 파악
```

**관련 문서**: `05-monitoring/09-sre-practices.md` §2, `09-troubleshooting/03-performance-guide.md` §9

---

### Q23. Pyroscope에서 CPU 병목을 찾는 방법은?

**문제 상황**: CPU 사용률이 높은데 어떤 함수가 원인인지 코드 레벨로 찾고 싶습니다.

**Pyroscope 접속 및 분석**:

```bash
# Pyroscope UI 접속 (포트 포워딩)
kubectl port-forward svc/pyroscope -n monitoring 4040:4040
# 브라우저: http://localhost:4040
```

**프로파일 읽는 법**:

```
Flame Graph 해석:
┌────────────────────────────────────────────┐
│              HTTP Request Handler          │ ← 전체 CPU 시간 (100%)
├──────────────┬─────────────────────────────┤
│  JWT Verify  │      DB Query (60%)          │ ← 자식 함수들
│    (5%)      ├──────────┬──────────────────┤
│              │ Prisma   │   Plan.findMany  │
│              │ (40%)    │   (20%)          │
└──────────────┴──────────┴──────────────────┘

→ DB Query가 60% 차지 → 쿼리 최적화 우선
→ Prisma 오버헤드 40% → connection pool 확인
```

**Node.js CPU 프로파일링 (개발 환경)**:

```bash
# Node.js 내장 CPU 프로파일러
node --cpu-prof --cpu-prof-interval=100 dist/index.js

# 생성된 .cpuprofile 파일을 Chrome DevTools에서 분석
# chrome://inspect → Load profile
```

**관련 문서**: `05-monitoring/09-sre-practices.md` §5

---

### Q24. SLO 에러 버짓이 빠르게 소진됩니다. 긴급 조치는?

**문제 상황**: 에러 버짓 소진율이 300%를 초과하는 경보가 왔습니다. 월말까지 버짓이 고갈될 것 같습니다.

**에러 버짓 소진율 확인**:

```promql
# 에러 버짓 소진율 (Grafana)
# 현재 에러율
sum(rate(http_requests_total{status=~"5.."}[5m]))
/
sum(rate(http_requests_total[5m]))

# 에러 버짓 소진율 (목표 대비 배수)
# SLO = 99.9% 가용성 → 에러 버짓 = 0.1%
(
  sum(rate(http_requests_total{status=~"5.."}[1h]))
  /
  sum(rate(http_requests_total[1h]))
) / 0.001  # 에러 버짓 비율
# 결과가 1이면 정상, 10이면 10배 빠르게 소진
```

**긴급 대응 매트릭스** (CSAP D-07 가용성 요건):

| 소진율 | 의미 | 즉시 조치 |
|--------|------|---------|
| < 1 | 정상 | 모니터링 유지 |
| 1~5 | 주의 | 원인 파악 + 계획 수립 |
| 5~10 | 경보 | 개발 중단, 안정화 집중 |
| > 10 | 위기 | 즉시 롤백 + 인시던트 선언 |

**긴급 조치 절차**:

```bash
# Step 1: 최근 배포가 원인인지 확인
kubectl rollout history deployment/subscription-service -n saas-platform
kubectl rollout undo deployment/subscription-service -n saas-platform  # 롤백

# Step 2: 현재 에러 원인 파악 (Loki)
{namespace="saas-platform"} |= "level=error" | json | last 100

# Step 3: 트래픽 일시 감소 (Rate Limit 강화)
# Redis에서 Rate Limit 임시 낮춤
redis-cli SET "rl:sub:write:global_limit" "5"  # 임시 전역 제한

# Step 4: 에스컬레이션 (slo-escalation-controller 참조)
# L3 이상 → 관리자 호출
```

**관련 문서**: `05-monitoring/09-sre-practices.md` §2, §4

---

### Q25. Jaeger/분산 추적으로 느린 요청의 원인을 찾는 방법은?

**문제 상황**: Grafana에서 P99 레이턴시가 높은 것은 확인했는데, 어떤 서비스, 어떤 DB 쿼리가 느린지까지는 알 수 없습니다.

**Jaeger 접속 및 추적 조회**:

```bash
# Jaeger UI 접속
kubectl port-forward svc/jaeger-query -n monitoring 16686:16686
# 브라우저: http://localhost:16686
```

**분산 추적 흐름 이해**:

```
Trace ID: abc123-def456 (x-request-id 헤더로 전파)

┌─ API Gateway (총 2340ms) ────────────────────────────────┐
│  ├─ JWT 검증 (auth-service) ─── 15ms                     │
│  ├─ Rate Limit 확인 (Redis) ─── 8ms                      │
│  └─ subscription-service ──────────────────── 2317ms ──┐ │
│     ├─ Zod 검증 ─── 2ms                                │ │
│     ├─ DB: tenant 조회 ─── 5ms                         │ │
│     ├─ DB: subscription.findMany ───────────── 2300ms  │ │  ← ⚠️ 여기!
│     └─ 감사 로그 ─── 3ms                               │ │
└──────────────────────────────────────────────────────────┘
```

**Trace ID로 특정 요청 추적**:

```bash
# 응답 헤더에서 Trace ID 추출
curl -I http://localhost:3000/api/v1/subscription/plans | grep "x-trace-id"

# Jaeger에서 해당 Trace 조회
# Service: api-gateway
# Operation: GET /api/v1/subscription/plans
# Tags: http.status_code=200, latency>2000ms
```

**OpenTelemetry 계측 추가** (새 서비스 추가 시):

```typescript
// src/instrumentation.ts (서비스 진입점 전에 import)
import { NodeSDK } from '@opentelemetry/sdk-node'
import { JaegerExporter } from '@opentelemetry/exporter-jaeger'
import { PrismaInstrumentation } from '@prisma/instrumentation'

const sdk = new NodeSDK({
  traceExporter: new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT ?? 'http://jaeger:14268/api/traces',
  }),
  instrumentations: [
    new PrismaInstrumentation(),  // Prisma 쿼리 자동 계측
  ],
})

sdk.start()
```

**예방 방법**: 새 서비스 추가 시 OpenTelemetry 계측을 필수 항목으로 체크리스트에 포함. 모든 Fastify 라우트에 `x-request-id` 헤더 전파 설정.

**관련 문서**: `05-monitoring/08-observability-deep-dive.md`, `09-troubleshooting/02-debugging-guide.md`

---

## 빠른 참조 — 성능 진단 명령어 모음

```bash
# API 레이턴시 즉시 측정
curl -w "\nTime: %{time_total}s\n" -o /dev/null -s http://localhost:3000/api/v1/health

# k3s 파드 리소스 사용량
kubectl top pods -n saas-platform --sort-by=cpu
kubectl top pods -n saas-platform --sort-by=memory

# PostgreSQL 느린 쿼리
kubectl exec -it postgres-0 -n saas-platform -- psql -U postgres -c \
  "SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Redis 메모리 및 히트율
redis-cli INFO memory | grep used_memory_human
redis-cli INFO stats | grep -E "keyspace_hits|keyspace_misses"

# Grafana 에러율 (PromQL)
# rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# Loki 최근 에러 (LogQL)
# {namespace="saas-platform"} |= "level=error" | json | last 50
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 — 성능 FAQ 25개, API/DB/Redis/k8s/모니터링 카테고리 | Implementer (Sonnet) |

---

*관련 문서: `09-troubleshooting/03-performance-guide.md` (성능 가이드 전체), `05-monitoring/09-sre-practices.md` (SRE 실천 가이드)*
