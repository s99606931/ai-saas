# Prisma 고급 가이드

> **문서 ID**: ONBOARD-03-13
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **선행 학습**: `03-development/05-prisma-guide.md` (Prisma 기초 필수 완료)
> **소요 시간**: 약 5~7시간 (실습 포함)
> **Design Ref**: D-P00.6 DB 스키마, DESIGN-MTU-P00 §DB 접근

---

## 목차

1. [Prisma 고급 쿼리](#1-prisma-고급-쿼리)
2. [마이그레이션 전략 심화](#2-마이그레이션-전략-심화)
3. [멀티테넌시 Prisma 패턴](#3-멀티테넌시-prisma-패턴)
4. [성능 최적화 심화](#4-성능-최적화-심화)
5. [트랜잭션 심화](#5-트랜잭션-심화)
6. [모니터링](#6-모니터링)
7. [학습 체크리스트](#7-학습-체크리스트)
8. [다음 단계](#8-다음-단계)
9. [변경 이력](#9-변경-이력)

---

## 1. Prisma 고급 쿼리

### 1.1 `$queryRaw` vs `$executeRaw` — 언제 어떻게 쓰나

Prisma ORM은 대부분의 쿼리를 타입 안전하게 처리합니다. 하지만 PostgreSQL 고유 기능(tsvector, 집계 함수 등)은 Raw SQL이 필요합니다.

**두 가지 Raw SQL 메서드의 차이**:

| 메서드 | 반환값 | 사용 시점 |
|--------|--------|---------|
| `$queryRaw` | 결과 행 배열 (`SELECT` 용) | 데이터를 읽어올 때 |
| `$executeRaw` | 영향 받은 행 수 (`number`) | INSERT/UPDATE/DELETE 할 때 |

✅ **올바른 `$queryRaw` 사용 — 파라미터화 필수**:

```typescript
// CSAP D-12: 매개변수화 쿼리 — SQL 주입 방지
// Prisma.sql 태그드 템플릿을 반드시 사용
import { Prisma } from '@prisma/client';

const tenantId = request.params.tenantId; // 외부 입력값

// ✅ Prisma.sql 사용 → 자동 파라미터화 ($1, $2 변환)
const result = await prisma.$queryRaw<Array<{ action: string; count: bigint }>>(
  Prisma.sql`
    SELECT action, COUNT(*) as count
    FROM "AuditLog"
    WHERE "tenantId" = ${tenantId}
      AND "createdAt" > NOW() - INTERVAL '30 days'
    GROUP BY action
    ORDER BY count DESC
  `
);

// BigInt를 Number로 변환 (JSON.stringify BigInt 직렬화 불가)
const stats = result.map(r => ({
  action: r.action,
  count: Number(r.count),
}));
```

❌ **절대 하면 안 되는 방식**:

```typescript
// ❌ SQL 직접 결합 — SQL 주입 취약점 (CSAP D-12 위반)
const result = await prisma.$queryRawUnsafe(
  `SELECT * FROM "AuditLog" WHERE "tenantId" = '${tenantId}'`
  // tenantId에 '; DROP TABLE "AuditLog"; --' 입력 시 테이블 삭제 가능
);
```

✅ **올바른 `$executeRaw` 사용**:

```typescript
// PostgreSQL tsvector 인덱스 갱신 (Prisma ORM으로 표현 불가한 작업)
const affected = await prisma.$executeRaw(
  Prisma.sql`
    UPDATE "AiKnowledgeDocument"
    SET search_vector = to_tsvector('korean', ${title} || ' ' || ${content})
    WHERE id = ${documentId}
  `
);
console.log(`${affected}개 행 업데이트됨`);
```

### 1.2 Full-text Search (PostgreSQL tsvector)

이 프로젝트의 AI 지식베이스(`AiKnowledgeDocument`)처럼 자연어 검색이 필요한 경우 PostgreSQL의 Full-text Search를 활용합니다.

**마이그레이션으로 tsvector 컬럼 추가**:

```sql
-- 새 마이그레이션 파일에 추가 (--create-only 후 수동 편집)
ALTER TABLE "AiKnowledgeDocument" ADD COLUMN search_vector tsvector;

-- GIN 인덱스 생성 (Full-text Search 성능 최적화)
CREATE INDEX "AiKnowledgeDocument_search_vector_idx"
  ON "AiKnowledgeDocument" USING GIN(search_vector);

-- 기존 데이터 초기화
UPDATE "AiKnowledgeDocument"
SET search_vector = to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(content, ''));
```

**Prisma에서 Full-text Search 쿼리**:

```typescript
// lib/knowledge-search.ts
// Design Ref: SVC-AI-2026 DESIGN §RAG 검색
import { Prisma } from '@prisma/client';

interface SearchResult {
  id: string;
  title: string;
  rank: number;
}

export async function searchKnowledgeBase(
  tenantId: string,
  query: string,
  limit = 10,
): Promise<SearchResult[]> {
  // 1. 검색어를 tsquery 형식으로 변환 (공백 → & 연산자)
  const tsQuery = query.trim().split(/\s+/).join(' & ');

  const results = await prisma.$queryRaw<SearchResult[]>(
    Prisma.sql`
      SELECT
        id,
        title,
        ts_rank(search_vector, to_tsquery('simple', ${tsQuery})) AS rank
      FROM "AiKnowledgeDocument"
      WHERE "tenantId" = ${tenantId}
        AND "isActive" = true
        AND search_vector @@ to_tsquery('simple', ${tsQuery})
      ORDER BY rank DESC
      LIMIT ${limit}
    `
  );

  return results.map(r => ({ ...r, rank: Number(r.rank) }));
}
```

### 1.3 집계 쿼리: `groupBy`, `_count`, `_sum`

Prisma의 타입 안전 집계 쿼리를 사용합니다. Raw SQL보다 안전하고 타입 추론이 됩니다.

**`_count` — 그룹별 개수**:

```typescript
// 역할별 사용자 수 집계
const usersByRole = await prisma.user.groupBy({
  by: ['role'],
  where: { tenantId },
  _count: { _all: true },
  orderBy: { _count: { id: 'desc' } },
});
// 결과: [{ role: 'USER', _count: { _all: 15 } }, { role: 'TENANT_ADMIN', _count: { _all: 2 } }]
```

**`_sum` — 합계**:

```typescript
// 테넌트별 청구 금액 합계
const billingTotal = await prisma.invoice.groupBy({
  by: ['subscriptionId'],
  where: {
    subscription: { tenantId },
    status: 'paid',
  },
  _sum: { amount: true },
  _count: { _all: true },
});
```

**`having` — 집계 결과 필터링**:

```typescript
// 사용자가 10명 이상인 테넌트만 조회
const activeTenantsWithManyUsers = await prisma.tenant.groupBy({
  by: ['id', 'name'],
  _count: { users: true },
  having: {
    users: { _count: { gt: 10 } },
  },
});
```

**`aggregate` — 단일 집계값**:

```typescript
// 전체 사용자 수, 평균 세션 수
const stats = await prisma.user.aggregate({
  where: { tenantId },
  _count: { _all: true },
  _max: { createdAt: true },
  _min: { createdAt: true },
});
console.log(`총 ${stats._count._all}명, 최초 가입: ${stats._min.createdAt}`);
```

### 1.4 `include` 중첩 3레벨 vs `select` 최적화

```mermaid
graph LR
  subgraph Include["include — 관계 전체 포함"]
    I1["include: { users: true }"]
    I2["→ User의 모든 필드 로드\n(passwordHash 포함!)"]
    I3["→ 네트워크 전송량 증가"]
    I1 --> I2 --> I3
  end

  subgraph Select["select — 필드 지정"]
    S1["select: { users: { select: { id, name } } }"]
    S2["→ 필요한 필드만 로드"]
    S3["→ DB → App 전송량 최소화"]
    S1 --> S2 --> S3
  end

  style Include fill:#ffebee
  style Select fill:#e8f5e9
```

**`include` 중첩 3레벨 — 피해야 할 패턴**:

```typescript
// ❌ 너무 깊은 include — N+1 문제 + 과도한 데이터 로드
const tenants = await prisma.tenant.findMany({
  include: {
    users: {
      include: {
        sessions: {
          include: {
            // 여기서 더 깊어지면 심각한 성능 저하
          }
        }
      }
    }
  }
});
// users 1000명이면 sessions 쿼리도 1000번 실행 (N+1)
```

**`select` 최적화 — 권장 패턴**:

```typescript
// ✅ 필요한 필드만 select
const tenants = await prisma.tenant.findMany({
  select: {
    id: true,
    name: true,
    status: true,
    _count: {
      select: { users: true }  // JOIN 없이 COUNT만
    },
    users: {
      select: {
        id: true,
        name: true,
        role: true,
        // passwordHash, mfaSecret 등 민감 필드 제외!
      },
      take: 5,    // 최대 5명만
      orderBy: { createdAt: 'desc' },
    },
  },
  where: { status: 'ACTIVE' },
  take: 20,
});
```

**언제 `include`, 언제 `select`?**

| 상황 | 권장 방법 | 이유 |
|------|---------|------|
| 모든 필드가 필요한 경우 | `include` | 단순함, 타입 추론 완전 |
| 일부 필드만 필요한 경우 | `select` | 네트워크/메모리 절약 |
| API 응답으로 반환하는 경우 | `select` 필수 | 민감 필드 노출 방지 |
| 내부 계산에만 사용하는 경우 | `include` 허용 | 코드 단순성 우선 |

---

## 2. 마이그레이션 전략 심화

### 2.1 마이그레이션 실행 흐름

```mermaid
flowchart TD
  A["schema.prisma 수정"] --> B["prisma migrate dev --name {name}"]
  B --> C{개발 환경?}
  C -->|Yes| D["마이그레이션 파일 생성\n+ DB 즉시 적용\n+ Prisma Client 재생성"]
  C -->|No 대용량/복잡| E["prisma migrate dev --create-only\n마이그레이션 파일만 생성"]
  E --> F["SQL 파일 수동 검토 및 수정"]
  F --> G["prisma migrate dev"]
  D --> H["prisma generate\nClient 타입 재생성"]
  G --> H

  style E fill:#FF9800,color:#fff
  style F fill:#FF9800,color:#fff
```

### 2.2 `--create-only` 후 수동 편집

대용량 테이블이나 복잡한 변경은 Prisma가 생성한 SQL을 그대로 쓰면 안 됩니다.

```bash
# 1단계: 스키마 변경 후 마이그레이션 파일만 생성 (DB 미적용)
npx prisma migrate dev --create-only --name add_search_vector

# 생성된 파일: prisma/migrations/0003_add_search_vector/migration.sql
```

**Prisma 자동 생성 SQL (수정 전)**:

```sql
-- 자동 생성됨 (대용량 테이블에서 위험!)
ALTER TABLE "AiKnowledgeDocument" ADD COLUMN "searchVector" TEXT;
UPDATE "AiKnowledgeDocument" SET "searchVector" = title;  -- 전체 테이블 락!
```

**수동 수정 후 (무중단 적용)**:

```sql
-- 수동 수정: 무중단 마이그레이션 패턴
-- 1. 컬럼 추가 (빠름 — 테이블 락 없음)
ALTER TABLE "AiKnowledgeDocument" ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2. GIN 인덱스 동시 생성 (CONCURRENTLY — 서비스 중단 없음)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AiKnowledgeDocument_search_vector_idx"
  ON "AiKnowledgeDocument" USING GIN(search_vector);

-- 3. 배치 업데이트 (전체 락 방지 — 애플리케이션 레벨에서 처리)
-- (실제 데이터 업데이트는 배경 작업으로 처리)
```

```bash
# 2단계: 수정된 SQL 파일 적용
npx prisma migrate dev
```

### 2.3 대용량 테이블 무중단 마이그레이션

이 프로젝트의 실제 마이그레이션 패턴 (`0002_ai_knowledge_base/migration.sql` 참고):

```sql
-- ✅ 무중단 마이그레이션 원칙
-- 1. 새 테이블 생성 (기존 테이블과 독립)
CREATE TABLE "AiKnowledgeChunk" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    -- ...
    CONSTRAINT "AiKnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- 2. 인덱스 생성 (테이블 생성 직후, 데이터 없을 때)
CREATE INDEX "AiKnowledgeChunk_tenantId_idx" ON "AiKnowledgeChunk"("tenantId");

-- 3. FK 추가 (마지막 — 데이터 정합성 보장)
ALTER TABLE "AiKnowledgeChunk"
  ADD CONSTRAINT "AiKnowledgeChunk_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "AiKnowledgeDocument"("id") ON DELETE CASCADE;
```

**대용량 테이블 컬럼 추가 시 피해야 할 패턴**:

```sql
-- ❌ NOT NULL + DEFAULT 조합 — 전체 테이블 재작성 (PostgreSQL 11 미만)
ALTER TABLE "AuditLog" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- ✅ 두 단계로 나누기 (PostgreSQL 11+에서는 개선되었으나 관습적으로 유지)
-- Step 1: Nullable로 추가 (빠름)
ALTER TABLE "AuditLog" ADD COLUMN "version" INTEGER;
-- Step 2: 배경 작업으로 업데이트 후 NOT NULL 적용
-- (다음 마이그레이션에서)
ALTER TABLE "AuditLog" ALTER COLUMN "version" SET NOT NULL;
```

### 2.4 마이그레이션 실패 시 롤백

```bash
# 현재 마이그레이션 상태 확인
npx prisma migrate status

# 실패한 마이그레이션 표시:
# ✗ 0003_add_search_vector  (failed)

# 실패 마이그레이션 해결 옵션 1: 수동으로 SQL 정리 후 재시도
npx prisma migrate resolve --rolled-back 0003_add_search_vector

# 실패 마이그레이션 해결 옵션 2: 부분 적용된 변경 수동 롤백
# psql 접속 후 수동 DDL 실행
psql $DATABASE_URL -c "DROP TABLE IF EXISTS new_table_that_failed;"
# 그 후 마이그레이션 재시도
npx prisma migrate dev
```

⚠️ **주의**: 프로덕션 환경에서는 `prisma migrate dev` 대신 `prisma migrate deploy`를 사용합니다.
`migrate dev`는 마이그레이션 파일을 변경할 수 있어 프로덕션에서 위험합니다.

### 2.5 스테이징 → 프로덕션 순서 적용

```bash
# 개발 환경
npx prisma migrate dev --name add_usage_stats

# CI/CD 파이프라인 (스테이징)
npx prisma migrate deploy  # --create-only 없이, 파일만 적용

# 프로덕션 배포 전 체크리스트
# [  ] 스테이징에서 마이그레이션 성공 확인
# [  ] 롤백 SQL 작성 완료
# [  ] 대용량 테이블 CONCURRENTLY 인덱스 사용 여부 확인
# [  ] DBA 검토 완료 (CSAP 요건)

# 프로덕션
npx prisma migrate deploy
```

---

## 3. 멀티테넌시 Prisma 패턴

### 3.1 이 프로젝트의 멀티테넌시 구조

이 프로젝트는 **공유 DB, 행 수준 격리** 방식을 사용합니다.

```mermaid
erDiagram
  Tenant {
    String id PK
    String slug UK
    TenantStatus status
  }

  User {
    String id PK
    String tenantId FK "N2SF N-03: 격리 키"
    String email
    UserRole role
  }

  AuditLog {
    String id PK
    String tenantId FK "모든 민감 모델에 tenantId 필수"
    String action
  }

  Tenant ||--o{ User : ""
  Tenant ||--o{ AuditLog : ""
```

**핵심 원칙**: 테넌트별 데이터가 있는 모든 테이블은 `tenantId` 컬럼을 가지고, 모든 쿼리에 `where: { tenantId }` 조건이 포함되어야 합니다.

### 3.2 `$extends`로 테넌트 필터 자동 적용

Prisma Client Extension을 사용하면 모든 쿼리에 자동으로 `tenantId` 조건이 추가됩니다.
Human error(tenantId 조건 누락)를 원천 방지합니다.

```typescript
// lib/prisma-tenant.ts
// Design Ref: N2SF N-03 격리 영역
// Plan SC: FR-TENANT.1

import { PrismaClient } from '@prisma/client';

/**
 * 테넌트 격리 Prisma Client 팩토리
 * 모든 쿼리에 자동으로 tenantId 조건 추가
 */
export function createTenantPrismaClient(tenantId: string) {
  const basePrisma = new PrismaClient();

  return basePrisma.$extends({
    query: {
      // User 모델에 자동 tenantId 필터 적용
      user: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async count({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async create({ args, query }) {
          // 생성 시 tenantId 자동 주입
          args.data = { ...args.data, tenantId };
          return query(args);
        },
      },

      // AuditLog도 동일하게 적용
      auditLog: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
      },
    },
  });
}

// 타입 추출 (핸들러에서 타입 힌트용)
export type TenantPrismaClient = ReturnType<typeof createTenantPrismaClient>;
```

**핸들러에서 사용**:

```typescript
// handlers/user-list.handler.ts
import { createTenantPrismaClient } from '../lib/prisma-tenant.js';

export async function listUsersHandler(request, reply) {
  const tenantId = request.headers['x-user-tenant-id'] as string;

  // 테넌트 격리 Client 생성
  const tenantPrisma = createTenantPrismaClient(tenantId);

  // ✅ tenantId 조건 자동 포함 — 다른 테넌트 데이터 접근 불가
  const users = await tenantPrisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
  });
  // 실제 실행 SQL: WHERE tenantId = '{tenantId}'가 자동으로 추가됨

  await reply.send({ success: true, data: users });
}
```

### 3.3 테넌트별 PrismaClient 인스턴스 관리

테넌트마다 새 `PrismaClient`를 생성하면 커넥션 풀이 고갈됩니다.

```typescript
// lib/prisma-pool.ts
// 테넌트별 커넥션을 재사용하는 풀 관리

import { PrismaClient } from '@prisma/client';

// 최대 동시 테넌트 수 (커넥션 풀 크기 관리)
const MAX_TENANT_CLIENTS = parseInt(process.env['MAX_TENANT_DB_CLIENTS'] ?? '10', 10);

class TenantPrismaPool {
  private pool = new Map<string, PrismaClient>();
  private accessOrder: string[] = [];  // LRU 추적

  get(tenantId: string): PrismaClient {
    if (this.pool.has(tenantId)) {
      // LRU: 최근 접근 순서 업데이트
      this.accessOrder = [tenantId, ...this.accessOrder.filter(id => id !== tenantId)];
      return this.pool.get(tenantId)!;
    }

    // 최대 크기 초과 시 가장 오래 접근 안 한 클라이언트 제거
    if (this.pool.size >= MAX_TENANT_CLIENTS) {
      const lruTenantId = this.accessOrder.pop()!;
      const lruClient = this.pool.get(lruTenantId);
      lruClient?.$disconnect();
      this.pool.delete(lruTenantId);
    }

    // 새 클라이언트 생성
    const client = new PrismaClient({
      log: process.env['NODE_ENV'] === 'development' ? ['warn', 'error'] : ['error'],
    });
    this.pool.set(tenantId, client);
    this.accessOrder.unshift(tenantId);
    return client;
  }

  async disconnectAll(): Promise<void> {
    await Promise.all([...this.pool.values()].map(c => c.$disconnect()));
    this.pool.clear();
  }
}

export const tenantPrismaPool = new TenantPrismaPool();
```

### 3.4 커넥션 풀 최적화

```typescript
// 환경 변수로 PostgreSQL 커넥션 풀 크기 설정
// DATABASE_URL에 ?connection_limit=5 추가
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env['DATABASE_URL'],
      // connection_limit: URL 파라미터로 설정
      // 예: postgresql://user:pass@host:5432/db?connection_limit=5&pool_timeout=10
    },
  },
});

// 또는 환경 변수 분리 설정
// DATABASE_URL=postgresql://user:pass@host:5432/db
// DATABASE_CONNECTION_LIMIT=5
```

**커넥션 풀 크기 가이드**:

| 환경 | 권장 크기 | 이유 |
|------|---------|------|
| 개발 | 2~5 | 로컬 머신 리소스 절약 |
| 스테이징 | 5~10 | 프로덕션 유사 테스트 |
| 프로덕션 | 10~20 | k3s 파드 수 × PostgreSQL 최대 연결 수 고려 |

---

## 4. 성능 최적화 심화

### 4.1 `findUnique` vs `findFirst` 성능 차이

```typescript
// findUnique: 고유 필드(PK, @unique)로만 조회 가능
// 내부적으로 = 조건 + LIMIT 1 → 항상 인덱스 사용
const userById = await prisma.user.findUnique({
  where: { id: userId },  // @id 필드
});

const userByEmail = await prisma.user.findUnique({
  where: { tenantId_email: { tenantId, email } },  // @@unique 복합 키
});

// findFirst: 모든 조건으로 조회 가능, 조건이 인덱스 없으면 Full Scan 가능
const anyUser = await prisma.user.findFirst({
  where: {
    role: 'TENANT_ADMIN',   // @index 없으면 Full Scan!
    tenantId,
  },
});
```

**성능 비교**:

| 메서드 | 조건 | 내부 동작 | 성능 |
|--------|------|---------|------|
| `findUnique` | PK, @unique 필드 | `= $1` + 인덱스 보장 | 빠름 (O(log n)) |
| `findFirst` | 모든 조건 가능 | 인덱스 여부에 따라 다름 | 인덱스 없으면 느림 |

**규칙**: ID나 unique 필드로 단건 조회할 때는 항상 `findUnique` 사용.

### 4.2 `select` vs `include` 트레이드오프

```typescript
// 상황별 선택 기준

// ① API 응답으로 반환 → select 필수 (민감 필드 제외)
const userProfile = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    name: true,
    email: true,
    role: true,
    // passwordHash ❌ 절대 선택 금지
    // mfaSecret   ❌ 절대 선택 금지
  },
});

// ② 내부 로직에서 비밀번호 검증 → include 허용 (passwordHash 필요)
const userForAuth = await prisma.user.findUnique({
  where: { id: userId },
  // passwordHash가 필요하므로 select 없이 전체 로드
});

// ③ 관계까지 로드할 때 select로 필요한 것만
const tenantWithActiveUsers = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: {
    name: true,
    status: true,
    users: {
      where: { role: { not: 'VIEWER' } },  // 필터링
      select: { id: true, name: true, role: true },  // 필요한 필드만
      take: 10,  // 최대 10명
    },
  },
});
```

### 4.3 인덱스 설계: 복합 인덱스, 부분 인덱스

실제 `prisma/schema.prisma`에서 사용하는 인덱스 패턴:

```prisma
model User {
  id        String   @id
  tenantId  String
  email     String
  role      UserRole

  // 복합 유니크 인덱스 (같은 테넌트 내 이메일 중복 방지)
  @@unique([tenantId, email])

  // 단순 인덱스 (자주 필터링하는 컬럼)
  @@index([tenantId])
  @@index([email])
}

model Session {
  id        String   @id
  userId    String
  expiresAt DateTime

  // 만료된 세션 정리 배치에서 expiresAt 기반 삭제 성능 향상
  @@index([expiresAt])
  @@index([userId])
}
```

**SQL 마이그레이션에서 부분 인덱스** (Prisma 스키마로 표현 불가 — Raw SQL 필요):

```sql
-- 활성 상태인 테넌트만 인덱스 (비활성은 조회 거의 없음)
CREATE INDEX CONCURRENTLY "Tenant_active_slug_idx"
  ON "Tenant"(slug)
  WHERE status = 'ACTIVE';

-- 만료되지 않은 세션만 인덱스
CREATE INDEX CONCURRENTLY "Session_active_idx"
  ON "Session"("userId", "expiresAt")
  WHERE "expiresAt" > NOW();
```

**복합 인덱스 설계 원칙** — "Selectivity 높은 컬럼을 앞에":

```prisma
// ✅ tenantId 먼저, createdAt 나중
// tenantId는 분리도가 높음 (1 tenantId당 적은 데이터)
@@index([tenantId, createdAt])

// ❌ createdAt 먼저 — 전체 날짜 범위 스캔 후 tenantId 필터
@@index([createdAt, tenantId])
```

### 4.4 슬로우 쿼리 탐지 설정

```typescript
// prisma.ts — 개발 환경에서 슬로우 쿼리 탐지
const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'error' },
    { emit: 'stdout', level: 'warn' },
  ],
});

// 100ms 이상 걸리는 쿼리 경고
prisma.$on('query', (event) => {
  if (event.duration > 100) {
    console.warn(`[SLOW QUERY] ${event.duration}ms: ${event.query}`);
  }
});
```

---

## 5. 트랜잭션 심화

### 5.1 두 가지 트랜잭션 방식 비교

```mermaid
graph TB
  subgraph Batch["$transaction([]) — 배치 방식"]
    B1["const [result1, result2] = await prisma.$transaction([op1, op2])"]
    B2["모든 쿼리를 미리 정의\n조건 분기 불가\n단순 배치에 적합"]
    B1 --- B2
  end

  subgraph Interactive["$transaction(async tx =>) — 인터랙티브 방식"]
    I1["await prisma.$transaction(async (tx) => { ... })"]
    I2["쿼리 결과를 다음 쿼리에 사용 가능\n조건 분기, 예외 처리 가능\n복잡한 비즈니스 로직에 적합"]
    I1 --- I2
  end

  style Batch fill:#e3f2fd
  style Interactive fill:#e8f5e9
```

**배치 방식 — 단순한 경우**:

```typescript
// 두 작업을 원자적으로 실행 (둘 다 성공 or 둘 다 실패)
const [newUser, auditEntry] = await prisma.$transaction([
  prisma.user.create({ data: { tenantId, email, name, passwordHash, role } }),
  prisma.auditLog.create({ data: { tenantId, action: 'USER_CREATE', actorId, target: email } }),
]);
```

**인터랙티브 방식 — 복잡한 로직**:

```typescript
// Design Ref: CSAP D-06 감사 로그 + 비즈니스 로직 원자성
// Plan SC: FR-AUTH.1

async function createUserWithAudit(input: CreateUserInput): Promise<User> {
  return prisma.$transaction(async (tx) => {
    // Step 1: 이메일 중복 확인 (트랜잭션 내에서)
    const existing = await tx.user.findFirst({
      where: { tenantId: input.tenantId, email: input.email },
    });
    if (existing) {
      throw new Error('EMAIL_ALREADY_EXISTS');  // 트랜잭션 자동 롤백
    }

    // Step 2: 테넌트 사용자 한도 확인
    const tenant = await tx.tenant.findUnique({
      where: { id: input.tenantId },
      select: { maxUsers: true },
    });
    const currentCount = await tx.user.count({ where: { tenantId: input.tenantId } });

    if (currentCount >= (tenant?.maxUsers ?? 10)) {
      throw new Error('USER_LIMIT_EXCEEDED');  // 트랜잭션 자동 롤백
    }

    // Step 3: 사용자 생성
    const user = await tx.user.create({
      data: {
        tenantId: input.tenantId,
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
        role: input.role,
      },
    });

    // Step 4: 감사 로그 (CSAP D-06)
    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        action: 'USER_CREATE',
        target: user.id,
        ip: input.ip,
        metadata: { email: input.email, role: input.role },
        hash: '',         // 실제: SHA-256 해시 계산
        previousHash: '', // 실제: 이전 로그의 hash
      },
    });

    return user;  // 트랜잭션 커밋
  }, {
    // 격리 수준 설정 (기본: ReadCommitted)
    isolationLevel: 'Serializable',  // 동시성 충돌 방지
    timeout: 5000,                   // 5초 타임아웃
  });
}
```

### 5.2 Saga 패턴에서 트랜잭션 경계 설계

마이크로서비스 환경에서는 하나의 DB 트랜잭션으로 처리할 수 없는 경우가 있습니다.
**Saga 패턴**은 각 서비스에서 로컬 트랜잭션을 실행하고, 실패 시 보상 트랜잭션으로 롤백합니다.

```mermaid
sequenceDiagram
  participant O as 오케스트레이터
  participant TS as tenant-service
  participant SS as subscription-service
  participant BS as billing-service

  O->>TS: 1. 테넌트 상태 ACTIVE로 변경
  TS-->>O: 성공 (로컬 TX 커밋)

  O->>SS: 2. 구독 생성
  SS-->>O: 성공 (로컬 TX 커밋)

  O->>BS: 3. 첫 번째 인보이스 생성
  BS-->>O: 실패!

  Note over O: Saga 보상 트랜잭션 실행
  O->>SS: 보상: 구독 취소
  O->>TS: 보상: 테넌트 상태 TRIAL로 롤백
```

**코드 예시 — 보상 트랜잭션**:

```typescript
// lib/tenant-activation.saga.ts

async function activateTenantSaga(tenantId: string, planId: string) {
  // Step 1: 테넌트 활성화
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { status: 'ACTIVE' },
  });

  let subscriptionId: string | null = null;

  try {
    // Step 2: 구독 생성
    const subscription = await prisma.subscription.create({
      data: {
        tenantId,
        planId,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: addMonths(new Date(), 1),
      },
    });
    subscriptionId = subscription.id;

    // Step 3: 인보이스 생성 (다른 서비스 API 호출 등)
    await createFirstInvoice(subscriptionId);

  } catch (error) {
    // 보상 트랜잭션: 이미 완료된 작업 롤백
    if (subscriptionId) {
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: 'CANCELED', canceledAt: new Date() },
      });
    }
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'TRIAL' },  // 원상 복구
    });

    throw error;  // 오류 재전파
  }
}
```

### 5.3 낙관적 락 (Optimistic Locking) 구현

동시에 같은 레코드를 수정하는 충돌을 방지합니다.

```prisma
// schema.prisma에 version 필드 추가
model Tenant {
  id      String @id
  name    String
  version Int    @default(0)  // 낙관적 락 버전 필드
  // ...
}
```

```typescript
// lib/optimistic-lock.ts

interface UpdateWithVersion<T> {
  id: string;
  version: number;  // 클라이언트가 읽은 시점의 버전
  data: Partial<T>;
}

async function updateTenantOptimistic(input: UpdateWithVersion<Tenant>) {
  // version이 일치하는 경우만 업데이트 (Prisma 낙관적 락)
  const result = await prisma.tenant.updateMany({
    where: {
      id: input.id,
      version: input.version,  // 버전 불일치 시 업데이트 0건
    },
    data: {
      ...input.data,
      version: { increment: 1 },  // 버전 증가
    },
  });

  if (result.count === 0) {
    // 다른 사용자가 먼저 수정함
    throw new Error('OPTIMISTIC_LOCK_CONFLICT');
    // 클라이언트는 최신 데이터를 다시 읽어서 재시도
  }

  return prisma.tenant.findUnique({ where: { id: input.id } });
}
```

---

## 6. 모니터링

### 6.1 Prisma Query Events로 슬로우 쿼리 탐지

```typescript
// platform/services/tenant-service/src/lib/prisma.ts 확장 버전
// Design Ref: DESIGN-MTU-P00 §DB 접근 모니터링

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'warn' },
      { emit: 'stdout', level: 'error' },
    ],
  });

// 슬로우 쿼리 임계값 (ms)
const SLOW_QUERY_THRESHOLD = parseInt(
  process.env['SLOW_QUERY_THRESHOLD_MS'] ?? '200',
  10,
);

// 쿼리 이벤트 구독
prisma.$on('query', (event) => {
  const durationMs = event.duration;

  if (durationMs > SLOW_QUERY_THRESHOLD) {
    // 구조화된 로그 (ELK/Loki로 수집)
    console.warn(JSON.stringify({
      level: 'warn',
      type: 'SLOW_QUERY',
      duration: durationMs,
      query: event.query,
      params: event.params,   // 민감 데이터 포함 가능 — 프로덕션에서 제거
      target: event.target,
      timestamp: new Date().toISOString(),
    }));
  }
});

// 경고 이벤트 구독
prisma.$on('warn', (event) => {
  console.warn(JSON.stringify({
    level: 'warn',
    type: 'PRISMA_WARN',
    message: event.message,
    timestamp: new Date().toISOString(),
  }));
});

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

### 6.2 OpenTelemetry 통합 (Prisma → Tempo)

```typescript
// 1. 의존성 추가
// pnpm add @prisma/instrumentation @opentelemetry/sdk-node

// 2. tracing.ts — OTel 초기화
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PrismaInstrumentation } from '@prisma/instrumentation';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://tempo:4318/v1/traces',
  }),
  instrumentations: [
    new PrismaInstrumentation({
      // 각 Prisma 쿼리를 개별 Span으로 추적
      middleware: true,
    }),
  ],
  serviceName: 'tenant-service',
});

await sdk.start();

// 3. 앱 시작 시 tracing.ts를 가장 먼저 import
// src/index.ts
// import './tracing.js';  // 반드시 최상단
// import Fastify from 'fastify';
```

**Grafana Tempo에서 슬로우 쿼리 확인**:

```
# TraceQL 쿼리 예시 (Tempo)
{ span.db.system="postgresql" && duration > 200ms }
| select(span.db.statement, span.db.operation.name, duration)
```

### 6.3 주요 모니터링 지표

```typescript
// 애플리케이션 레벨 메트릭 (Prometheus 포맷)
// packages/dora-exporter 또는 커스텀 수집기 활용

const metrics = {
  // DB 쿼리 지연 시간 히스토그램
  dbQueryDuration: {
    p50: '<50ms',   // 중간값
    p95: '<200ms',  // 95퍼센타일
    p99: '<500ms',  // 99퍼센타일 (알림 기준)
  },
  // 커넥션 풀 사용률
  dbConnectionPool: {
    active: '< pool_size의 80%',
    idle: '> pool_size의 20%',
  },
  // 트랜잭션 성공률
  txSuccessRate: '> 99.9%',
};
```

---

## 7. 학습 체크리스트

### Raw SQL & 집계

- [ ] `$queryRaw`와 `$executeRaw`의 차이를 설명할 수 있다
- [ ] `Prisma.sql` 태그드 템플릿을 사용하지 않으면 SQL 주입이 왜 발생하는지 안다
- [ ] `groupBy`로 역할별 사용자 수를 집계하는 쿼리를 작성할 수 있다
- [ ] `include` 3단계 중첩의 문제점을 설명하고 `select`로 대체할 수 있다

### 마이그레이션

- [ ] `--create-only` 플래그를 언제 쓰는지 알고 있다
- [ ] 대용량 테이블에 `CREATE INDEX CONCURRENTLY`를 써야 하는 이유를 안다
- [ ] `migrate dev` vs `migrate deploy`의 차이를 설명할 수 있다
- [ ] 마이그레이션 실패 시 `migrate resolve`로 복구하는 방법을 안다

### 멀티테넌시

- [ ] `$extends`로 자동 테넌트 필터를 적용하는 코드를 작성할 수 있다
- [ ] 커넥션 풀이 고갈되는 상황을 방지하는 방법을 설명할 수 있다
- [ ] `tenantId` 조건이 모든 쿼리에 없을 때 생기는 보안 문제를 설명할 수 있다

### 성능 최적화

- [ ] `findUnique`와 `findFirst`를 적절하게 구분해서 사용할 수 있다
- [ ] 복합 인덱스에서 컬럼 순서가 성능에 미치는 영향을 안다
- [ ] 슬로우 쿼리 탐지 설정을 prisma.ts에 추가할 수 있다

### 트랜잭션

- [ ] `$transaction([])`과 `$transaction(async tx =>)` 중 언제 무엇을 쓰는지 안다
- [ ] Saga 패턴에서 보상 트랜잭션을 구현할 수 있다
- [ ] 낙관적 락으로 동시 업데이트 충돌을 방지하는 코드를 작성할 수 있다

---

## 8. 다음 단계

- `12-api-design-guide.md` — API 설계 원칙, Fastify 스키마, Rate Limiting
- `04-advanced-patterns.md` — Circuit Breaker, CQRS, Event Sourcing
- `08-ai-development-guide.md` — AI 서비스 통합, N2SF 데이터 등급 관리

---

## 9. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 — 실제 schema.prisma, 마이그레이션 SQL 기반 | Implementer (Sonnet) |
