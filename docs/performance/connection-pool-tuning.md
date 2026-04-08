# 연결 풀(DB/Redis) 최적화 가이드

> Plan SC: FR-N19.5
> Design Ref: D-N19.5
> CSAP: D-07 가용성 (연결 고갈 방지)

| 항목 | 내용 |
|------|------|
| 버전 | 1.0.0 |
| 작성일 | 2026-04-08 |
| 대상 | Prisma (PostgreSQL), ioredis (Redis) |

---

## 1. Prisma 연결 풀 설정

### DATABASE_URL 파라미터

```
DATABASE_URL="postgresql://user:password@host:5432/db?connection_limit=N&pool_timeout=10&connect_timeout=5"
```

| 파라미터 | 설명 | 기본값 |
|---------|------|--------|
| `connection_limit` | 최대 연결 수 | num_cpus * 2 + 1 |
| `pool_timeout` | 연결 대기 타임아웃 (초) | 10 |
| `connect_timeout` | 초기 연결 타임아웃 (초) | 5 |

### 환경별 권장값

| 환경 | connection_limit | 서비스 수 | 총 연결 | PostgreSQL max_connections |
|------|-----------------|----------|---------|--------------------------|
| 개발 (로컬) | 5 | 1~3 | 5~15 | 50 |
| 스테이징 (WSL2) | 3 | 17 | 51 | 100 |
| 프로덕션 | 10 | 17 | 170 | 200 |

### PostgreSQL max_connections 설정

```sql
-- 현재 값 확인
SHOW max_connections;

-- postgresql.conf 변경
-- 스테이징: max_connections = 100
-- 프로덕션: max_connections = 200
```

**계산 공식**:
```
max_connections >= (서비스 수 * connection_limit) + 예비(20)
예: 17 * 3 + 20 = 71 -> max_connections = 100 (스테이징)
```

### 연결 누수 방지

```typescript
// Prisma Client 싱글톤 패턴 (필수)
// Design Ref: D-P00.6

let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
    });
  }
  return prisma;
}

// Graceful Shutdown 시 연결 해제
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
```

---

## 2. Redis 연결 설정

### ioredis 권장 설정

```typescript
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 0,

  // 연결 안정성
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,

  // 재연결 전략
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },

  // 명령 타임아웃
  commandTimeout: 5000,
});
```

### Redis 메모리 설정

```conf
# redis.conf
maxmemory 100mb           # WSL2 환경 기준
maxmemory-policy allkeys-lru  # LRU 퇴거 정책
```

### 연결 상태 모니터링

```typescript
redis.on('connect', () => console.log('Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err));
redis.on('close', () => console.warn('Redis connection closed'));
```

---

## 3. 연결 풀 모니터링

### Prisma 메트릭 (활성화 시)

```typescript
const prisma = new PrismaClient({
  // Prisma 메트릭 활성화 (v5+)
  // __internal: { engine: { metrics: true } }
});

// Prometheus 메트릭 노출
// prisma_pool_connections_open
// prisma_pool_connections_busy
// prisma_pool_connections_idle
```

### PostgreSQL 연결 상태 확인

```sql
-- 현재 연결 수 확인
SELECT count(*) FROM pg_stat_activity;

-- 서비스별 연결 수
SELECT application_name, count(*)
FROM pg_stat_activity
GROUP BY application_name
ORDER BY count DESC;

-- 유휴 연결 확인
SELECT pid, state, query_start, application_name
FROM pg_stat_activity
WHERE state = 'idle'
ORDER BY query_start;
```

---

## 4. 연결 풀 체크리스트

- [ ] 모든 서비스 DATABASE_URL에 connection_limit 명시
- [ ] PostgreSQL max_connections >= (서비스 수 * connection_limit) + 20
- [ ] Prisma Client 싱글톤 패턴 적용 확인
- [ ] Graceful Shutdown 시 prisma.$disconnect() 호출
- [ ] Redis maxmemory 및 퇴거 정책 설정
- [ ] 분기별 pg_stat_activity 유휴 연결 점검

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초안 작성 | PM Lead Agent |
