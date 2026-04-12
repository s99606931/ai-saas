# 데이터베이스 설계 가이드

> **문서 ID**: ONBOARD-03-14
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **선행 학습**: `03-development/05-prisma-guide.md`, `03-development/13-prisma-advanced.md`
> **소요 시간**: 약 5~6시간 (실습 포함)
> **CSAP**: D-06 (감사 로그), D-09 (암호화), D-10 (데이터 보존)

---

## 목차

1. [이 프로젝트의 DB 설계 원칙](#1-이-프로젝트의-db-설계-원칙)
2. [핵심 테이블 ERD](#2-핵심-테이블-erd)
3. [스키마 설계 패턴](#3-스키마-설계-패턴)
4. [멀티테넌시 구현](#4-멀티테넌시-구현)
5. [인덱스 설계 원칙](#5-인덱스-설계-원칙)
6. [데이터 마이그레이션 전략](#6-데이터-마이그레이션-전략)
7. [데이터 보존 정책 (CSAP D-10)](#7-데이터-보존-정책-csap-d-10)
8. [성능을 위한 DB 설계](#8-성능을-위한-db-설계)
9. [변경 이력](#9-변경-이력)

---

## 1. 이 프로젝트의 DB 설계 원칙

### 1.1 모든 설계 결정의 출발점

이 프로젝트의 데이터베이스는 공공기관 SaaS 요건을 충족해야 합니다. 단순한 CRUD 앱이 아닙니다. 설계 전에 반드시 다음 제약을 이해하십시오.

```
[CSAP D-06] 감사 로그 5년 보존 + append-only (수정/삭제 불가)
[CSAP D-09] 민감 데이터 AES-256 암호화 저장
[CSAP D-10] 개인정보 목적 달성 후 즉시 삭제
[N2SF N-03] 테넌트 간 데이터 완전 격리 (논리적 격리)
```

이 제약들이 아래의 모든 설계 원칙을 만들어냈습니다.

### 1.2 필수 컬럼 규칙 — 모든 테이블에 반드시 포함

실제 `prisma/schema.prisma`를 보면 모든 테이블이 공통 패턴을 따릅니다.

```prisma
// ✅ 이 프로젝트의 표준 테이블 구조
model ExampleEntity {
  id        String   @id @default(cuid())  // 1. 기본 키: CUID (UUID보다 짧고 정렬 가능)
  tenantId  String                          // 2. 멀티테넌시: 모든 데이터에 테넌트 소속 명시
  createdAt DateTime @default(now())        // 3. 감사: 생성 시각 (CSAP D-06)
  updatedAt DateTime @updatedAt             // 4. 감사: 수정 시각 (자동 갱신)

  // 비즈니스 필드들...

  @@index([tenantId])  // 5. 테넌트 조회 인덱스 필수
}
```

**각 컬럼의 존재 이유**:

| 컬럼 | 타입 | 이유 |
|------|------|------|
| `id` | `String @id @default(cuid())` | 전역 고유 식별자. UUID 대신 CUID 사용 — URL-safe, 시간순 정렬 가능 |
| `tenantId` | `String` | N2SF N-03 테넌트 격리. 이 컬럼 없이 멀티테넌시 불가능 |
| `createdAt` | `DateTime @default(now())` | CSAP D-06 감사 요건. 언제 만들어졌는지 추적 |
| `updatedAt` | `DateTime @updatedAt` | Prisma가 자동 관리. 마지막 수정 시각 |

### 1.3 소프트 삭제 vs 하드 삭제 — 언제 무엇을 쓰는가

💡 **공공기관 SaaS에서 이 선택은 법적 의무와 연결됩니다.**

```
소프트 삭제 (deletedAt): 데이터가 DB에 남아있지만 조회에서 제외
하드 삭제 (DB에서 완전 제거): 데이터가 물리적으로 사라짐
```

**이 프로젝트의 선택 기준**:

```prisma
// ✅ 소프트 삭제 사용 케이스: 감사 추적이 필요한 비즈니스 데이터
model Contract {
  id        String    @id @default(cuid())
  tenantId  String
  title     String
  deletedAt DateTime? // null = 활성, 날짜 = 삭제됨
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

// 소프트 삭제 쿼리 — Prisma에서 반드시 필터 추가
const activeContracts = await prisma.contract.findMany({
  where: {
    tenantId: tenantId,
    deletedAt: null,  // ← 이 필터를 빠트리면 삭제된 데이터가 노출됨!
  }
})

// 소프트 삭제 실행
await prisma.contract.update({
  where: { id: contractId },
  data: { deletedAt: new Date() }
})
```

```typescript
// ✅ 하드 삭제 사용 케이스: 개인정보보호법 삭제 요청
// CSAP D-10: 목적 달성 후 개인정보 즉시 삭제
// 개인이 탈퇴하거나 개인정보 삭제를 요청한 경우

async function deleteUserPersonalData(userId: string): Promise<void> {
  // 트랜잭션으로 원자적 삭제
  await prisma.$transaction([
    // 1. 세션 완전 삭제 (개인정보)
    prisma.session.deleteMany({ where: { userId } }),

    // 2. 사용자 개인정보 익명화 (감사 로그는 보존)
    prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@anon.invalid`,  // 이메일 익명화
        name: '(삭제된 사용자)',
        passwordHash: 'DELETED',
        deletedAt: new Date(),
      }
    }),
  ])
}
```

**선택 가이드**:

| 데이터 유형 | 삭제 방식 | 이유 |
|------------|---------|------|
| 계약, 구독, 청구서 | 소프트 삭제 | 감사 추적, 법적 보존 요건 |
| 개인 식별 정보 (이름, 이메일) | 익명화 후 소프트 삭제 | 개인정보보호법 준수 |
| 세션, 임시 토큰 | 하드 삭제 | 민감 정보, 보존 가치 없음 |
| 감사 로그 | 삭제 불가 (append-only) | CSAP D-06 강제 |

### 1.4 CSAP D-10 데이터 보존 기간

```
감사 로그:       최소 5년 (CSAP D-06)
계약/청구 데이터: 최소 5년 (국세기본법)
개인정보:        목적 달성 후 즉시 삭제 (개인정보보호법 제21조)
세션 토큰:       15분 ~ 7일 (CSAP D-08)
백업:           30일 PITR (Point-in-Time Recovery)
```

---

## 2. 핵심 테이블 ERD

### 2.1 전체 시스템 ERD

실제 `prisma/schema.prisma`를 기반으로 한 핵심 엔티티 관계도입니다.

```mermaid
erDiagram
    Tenant {
        string id PK
        string name
        string slug UK
        TenantStatus status
        int maxUsers
        bigint maxStorage
        json config
        datetime createdAt
        datetime updatedAt
    }

    User {
        string id PK
        string tenantId FK
        string email
        string name
        string passwordHash
        UserRole role
        boolean mfaEnabled
        string mfaSecret
        datetime lastLoginAt
        int failedLogins
        datetime lockedUntil
        datetime createdAt
        datetime updatedAt
    }

    Session {
        string id PK
        string userId FK
        string token UK
        datetime expiresAt
        string refreshToken UK
        datetime refreshExpiresAt
        string ip
        string userAgent
        datetime createdAt
    }

    Permission {
        string id PK
        string name UK
        string description
    }

    RolePermission {
        string id PK
        UserRole role
        string permissionId FK
    }

    Subscription {
        string id PK
        string tenantId FK
        string planId FK
        SubscriptionStatus status
        datetime currentPeriodStart
        datetime currentPeriodEnd
        datetime canceledAt
        datetime createdAt
        datetime updatedAt
    }

    Plan {
        string id PK
        string name
        string slug UK
        decimal price
        string currency
        string interval
        int maxUsers
        bigint maxStorage
        boolean isActive
        datetime createdAt
    }

    AuditLog {
        string id PK
        string tenantId FK
        string actorId FK
        string action
        string target
        string targetType
        string ip
        string userAgent
        json metadata
        string hash
        string previousHash
        datetime createdAt
    }

    AiKnowledgeDocument {
        string id PK
        string tenantId
        string title
        string sourceUrl
        boolean isActive
        json metadata
        datetime createdAt
        datetime updatedAt
    }

    AiKnowledgeChunk {
        string id PK
        string tenantId
        string documentId FK
        int chunkIndex
        string content
        string embeddingJson
        int tokenCount
        datetime createdAt
    }

    Tenant ||--o{ User : "has"
    Tenant ||--o{ Subscription : "has"
    Tenant ||--o{ AuditLog : "records"
    User ||--o{ Session : "has"
    User ||--o{ AuditLog : "actor"
    Plan ||--o{ Subscription : "used by"
    Subscription ||--o{ Invoice : "generates"
    Permission ||--o{ RolePermission : "assigned to"
    AiKnowledgeDocument ||--o{ AiKnowledgeChunk : "split into"
```

### 2.2 RBAC 권한 구조 ERD

```mermaid
erDiagram
    UserRole {
        string SUPER_ADMIN
        string TENANT_ADMIN
        string USER
        string VIEWER
        string AUDITOR
    }

    Permission {
        string id PK
        string name "resource:action 형식"
        string description
    }

    RolePermission {
        string id PK
        UserRole role
        string permissionId FK
    }

    User {
        string id PK
        string tenantId FK
        UserRole role
    }

    UserRole ||--o{ RolePermission : "has"
    Permission ||--o{ RolePermission : "granted via"
    User }o--|| UserRole : "assigned"
```

**권한 이름 규칙 (`resource:action` 형식)**:

```
user:read       — 사용자 조회
user:write      — 사용자 생성/수정
user:delete     — 사용자 삭제
tenant:read     — 테넌트 조회
audit:read      — 감사 로그 조회
ai:invoke       — AI 서비스 호출
subscription:manage — 구독 관리
```

### 2.3 감사 로그 해시 체인

감사 로그는 단순 로그가 아닙니다. 각 레코드가 이전 레코드의 해시를 포함하여 위변조를 탐지합니다.

```mermaid
graph LR
    A["AuditLog #1\nhash: SHA256(data1)\npreviousHash: 0000..."] -->|previousHash| B["AuditLog #2\nhash: SHA256(data2+hash1)\npreviousHash: hash1"]
    B -->|previousHash| C["AuditLog #3\nhash: SHA256(data3+hash2)\npreviousHash: hash2"]

    style A fill:#2d6a4f,color:#fff
    style B fill:#2d6a4f,color:#fff
    style C fill:#2d6a4f,color:#fff
```

```prisma
// prisma/schema.prisma — 실제 AuditLog 모델
model AuditLog {
  id           String   @id @default(cuid())
  tenantId     String?
  actorId      String?
  action       String   // 예: "USER_DELETE", "LOGIN_SUCCESS"
  target       String?  // 예: 대상 리소스 ID
  targetType   String?  // 예: "User", "Contract"
  ip           String?
  userAgent    String?
  metadata     Json?    // 추가 컨텍스트 (자유 형식)
  hash         String   // SHA-256(현재 레코드 데이터 + previousHash)
  previousHash String   // 직전 로그의 hash (무결성 검증용)
  createdAt    DateTime @default(now())

  tenant Tenant? @relation(fields: [tenantId], references: [id])
  actor  User?   @relation(fields: [actorId], references: [id])

  @@index([tenantId, createdAt])  // 테넌트별 시간순 조회
  @@index([actorId])
  @@index([action])
  @@index([createdAt])
}
```

---

## 3. 스키마 설계 패턴

### 3.1 외래 키 vs 애플리케이션 레벨 관계

💡 **이 프로젝트의 선택**: 두 방식을 혼용합니다.

```prisma
// ✅ DB 수준 외래 키: 참조 무결성이 절대적으로 중요한 경우
model User {
  tenantId String
  tenant   Tenant @relation(fields: [tenantId], references: [id])
  // PostgreSQL이 직접 tenantId → Tenant.id 연결을 강제
  // 존재하지 않는 tenantId로 User 생성 → DB 자체가 에러 반환
}

// ✅ 애플리케이션 레벨 관계: 유연성이 필요한 경우
model AuditLog {
  tenantId String?  // 외래 키 선언은 하지만
  tenant   Tenant? @relation(fields: [tenantId], references: [id])
  // null 허용: 시스템 레벨 감사 로그는 특정 테넌트에 속하지 않을 수 있음
}

// ✅ 순수 애플리케이션 레벨 (외래 키 없음): 성능이 중요한 경우
model AiKnowledgeChunk {
  tenantId String
  // tenantId에 대한 DB 외래 키 없음
  // 이유: 청크 수가 수백만 개일 때 외래 키 검증 오버헤드 제거
  // 대신: 애플리케이션 코드에서 tenantId 일치를 보장
}
```

**선택 기준 요약**:

| 상황 | 권장 방식 | 이유 |
|------|---------|------|
| 핵심 비즈니스 관계 (User→Tenant) | DB 외래 키 | 데이터 무결성 절대 보장 |
| 감사/로그 관계 | nullable 외래 키 | 시스템 레코드 허용 |
| 대용량 데이터 (청크, 이벤트) | 애플리케이션 레벨 | 쓰기 성능 우선 |

### 3.2 JSON 컬럼 사용 패턴

```prisma
model Tenant {
  config Json?  // 테넌트별 유연한 설정
  theme  Json?  // UI 테마 설정
}

model AuditLog {
  metadata Json?  // 이벤트별 추가 정보
}
```

```typescript
// JSON 컬럼 타입 안전하게 다루기
interface TenantConfig {
  features: string[];
  maxApiCallsPerMinute: number;
  allowedIpRanges: string[];
}

// Prisma는 Json 타입을 any로 반환 — 런타임 검증 필수
const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })

// ✅ Zod로 런타임 검증
import { z } from 'zod'

const TenantConfigSchema = z.object({
  features: z.array(z.string()),
  maxApiCallsPerMinute: z.number().int().positive(),
  allowedIpRanges: z.array(z.string()),
})

const config = TenantConfigSchema.parse(tenant?.config ?? {})
// config는 이제 TenantConfig 타입으로 안전하게 사용 가능
```

⚠️ **JSON 컬럼 주의사항**:
- JSON 컬럼 내부 필드로 WHERE 검색은 인덱스가 없어 풀 스캔 발생
- 자주 검색하는 필드는 별도 컬럼으로 분리하는 것이 원칙
- 스키마가 없으므로 반드시 Zod 등으로 런타임 검증

### 3.3 Enum 설계

```prisma
// ✅ 이 프로젝트의 Enum 사용 패턴
enum UserRole {
  SUPER_ADMIN   // 전체 시스템 관리자
  TENANT_ADMIN  // 테넌트 관리자
  USER          // 일반 사용자
  VIEWER        // 읽기 전용
  AUDITOR       // 감사 전용 (CSAP D-06)
}

enum TenantStatus {
  ACTIVE    // 정상 운영
  SUSPENDED // 정지 (미납 등)
  TRIAL     // 체험판
  ARCHIVED  // 삭제 예정
}

enum SubscriptionStatus {
  ACTIVE    // 활성 구독
  PAST_DUE  // 미납
  CANCELED  // 해지
  TRIALING  // 체험
}
```

**PostgreSQL Enum의 장점**:
- 잘못된 값 입력 시 DB 레벨에서 차단
- 인덱스 효율이 문자열보다 우수
- 허용 값 목록이 스키마에 문서화됨

**PostgreSQL Enum의 단점**:
- 값 추가: `ALTER TYPE ... ADD VALUE` (롤백 불가)
- 값 제거/이름 변경: 마이그레이션 복잡
- ⚠️ 값이 자주 바뀌는 경우는 `String` 컬럼 + 애플리케이션 레벨 검증 권장

---

## 4. 멀티테넌시 구현

### 4.1 이 프로젝트의 멀티테넌시 전략

```mermaid
graph TB
    subgraph APPROACH["이 프로젝트: 행 수준 격리 (Row-Level Isolation)"]
        direction TB
        DB["단일 PostgreSQL DB\n단일 스키마"]
        T1["Tenant A 데이터\ntenantId = 'ten-001'"]
        T2["Tenant B 데이터\ntenantId = 'ten-002'"]
        T3["Tenant C 데이터\ntenantId = 'ten-003'"]
        DB --> T1
        DB --> T2
        DB --> T3
    end

    subgraph ISOLATION["격리 메커니즘"]
        API["API 레이어\n모든 쿼리에\ntenantId 필터"]
        CACHE["Redis 캐시\ntenantId 포함\n키 격리"]
    end

    API --> DB
    CACHE --> DB
```

**세 가지 멀티테넌시 전략 비교**:

| 전략 | 격리 수준 | 비용 | 이 프로젝트 선택? |
|------|---------|------|---------------|
| DB 분리 (각 테넌트별 DB) | 완전 격리 | 높음 | 아니요 |
| 스키마 분리 (PostgreSQL schema) | 높은 격리 | 중간 | 아니요 |
| **행 수준 격리 (tenantId 컬럼)** | **논리적 격리** | **낮음** | **예** |

💡 이 프로젝트는 공공기관 SaaS로 **수십 개의 기관이 테넌트**가 됩니다. 기관별로 DB를 분리하면 관리 비용이 폭발적으로 증가하므로 행 수준 격리를 선택했습니다. N2SF N-03 요건은 논리적 격리로 충족 가능합니다.

### 4.2 tenantId 필터 강제 패턴

⚠️ **행 수준 격리의 가장 큰 위험**: 개발자가 tenantId 필터를 빠트리면 다른 테넌트 데이터가 노출됩니다.

```typescript
// ❌ 위험한 코드 — tenantId 필터 누락
async function getUsers(): Promise<User[]> {
  return prisma.user.findMany()  // 전체 테넌트 사용자가 반환됨!
}

// ✅ 올바른 코드 — tenantId 항상 포함
async function getUsers(tenantId: string): Promise<User[]> {
  return prisma.user.findMany({
    where: { tenantId }  // 반드시 포함
  })
}
```

**강제 패턴 — Prisma 미들웨어**:

```typescript
// platform/services/*/src/lib/prisma.ts
// Design Ref: §4 — 멀티테넌시 격리 보장

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Prisma 미들웨어로 tenantId 자동 주입
// Plan SC: FR-P00.6
prisma.$use(async (params, next) => {
  const TENANT_MODELS = ['User', 'AuditLog', 'MenuItem', 'AiKnowledgeDocument']

  // SELECT 쿼리에 tenantId 자동 필터
  if (params.action === 'findMany' || params.action === 'findFirst') {
    if (TENANT_MODELS.includes(params.model ?? '')) {
      const tenantId = getCurrentTenantId()  // 요청 컨텍스트에서 추출
      if (tenantId) {
        params.args = params.args ?? {}
        params.args.where = {
          ...params.args.where,
          tenantId,
        }
      }
    }
  }

  return next(params)
})
```

### 4.3 PostgreSQL Row Level Security (RLS) — 심화

운영 환경에서는 PostgreSQL의 RLS를 추가 방어선으로 적용할 수 있습니다.

```sql
-- PostgreSQL RLS 적용 예시 (고급 옵션)
-- Design Ref: §4 — DB 수준 격리 강화

-- 1. 테이블에 RLS 활성화
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

-- 2. 현재 테넌트만 볼 수 있는 정책
CREATE POLICY tenant_isolation ON "User"
  USING (
    "tenantId" = current_setting('app.current_tenant_id', true)
  );

-- 3. 애플리케이션에서 세션 변수 설정
-- Prisma 미들웨어에서:
await prisma.$executeRaw`
  SELECT set_config('app.current_tenant_id', ${tenantId}, true)
`
```

⚠️ **주의**: 이 프로젝트는 현재 RLS를 사용하지 않습니다. 애플리케이션 레벨 tenantId 필터로 관리합니다. RLS는 추가적인 보호막이지만 성능 오버헤드가 있으며 Prisma 설정이 복잡해집니다.

---

## 5. 인덱스 설계 원칙

### 5.1 이 프로젝트의 인덱스 전략

```mermaid
graph TD
    A["인덱스 설계 결정"] --> B{"자주 쿼리하는 필드?"}
    B -->|예| C{"카디널리티가 높은가?\n(고유 값이 많은가?)"}
    B -->|아니오| D["인덱스 불필요"]
    C -->|높음| E["단일 인덱스\n@@index([field])"]
    C -->|낮음| F{"다른 컬럼과 함께\n조회하는가?"}
    F -->|예| G["복합 인덱스\n@@index([tenantId, field])"]
    F -->|아니오| H["인덱스 불필요\n(풀 스캔이 나을 수도)"]
```

### 5.2 실제 스키마의 인덱스 분석

```prisma
// ✅ 복합 인덱스: 항상 tenantId와 함께 조회되는 패턴
model User {
  @@unique([tenantId, email])  // 테넌트 내 이메일 중복 방지 + 인덱스 역할
  @@index([tenantId])          // 테넌트 전체 사용자 조회
  @@index([email])             // 이메일로 사용자 조회 (로그인)
}

// 복합 인덱스의 핵심 원칙: 선택도가 높은 컬럼을 앞에
model AuditLog {
  @@index([tenantId, createdAt])  // 테넌트의 최신 로그 조회에 최적
  // tenantId로 먼저 필터링 → 결과 집합 축소 → createdAt으로 정렬
  @@index([actorId])
  @@index([action])
  @@index([createdAt])  // 전체 최신 로그 조회 (CSAP 감사용)
}
```

### 5.3 복합 인덱스 작성 규칙

```sql
-- ✅ 올바른 복합 인덱스 순서
-- 규칙: 등호(=) 조건 먼저, 범위 조건 나중
CREATE INDEX ON "AuditLog" ("tenantId", "createdAt");
-- WHERE tenantId = 'abc' AND createdAt > '2026-01-01' → 효율적

-- ❌ 잘못된 순서
CREATE INDEX ON "AuditLog" ("createdAt", "tenantId");
-- WHERE tenantId = 'abc' AND createdAt > '2026-01-01' → 비효율적
-- createdAt이 범위 조건이라 tenantId 인덱스를 활용 못함
```

**인덱스 추가 판단 기준**:

```sql
-- EXPLAIN ANALYZE로 실행 계획 확인
EXPLAIN ANALYZE
SELECT * FROM "AuditLog"
WHERE "tenantId" = 'ten-001'
AND "createdAt" > NOW() - INTERVAL '30 days'
ORDER BY "createdAt" DESC
LIMIT 100;

-- 결과에서 확인할 것:
-- Seq Scan → 풀 스캔, 인덱스 없음 (느림)
-- Index Scan → 인덱스 사용 (빠름)
-- Bitmap Index Scan → 인덱스 사용 + 정렬 (중간)
```

### 5.4 부분 인덱스 (Partial Index)

```sql
-- ✅ 부분 인덱스: 특정 조건의 행만 인덱싱
-- 예: 활성 구독만 빠르게 조회
CREATE INDEX subscription_active_idx ON "Subscription" ("tenantId")
WHERE "status" = 'ACTIVE';

-- 예: 잠긴 사용자만 조회 (lockedUntil이 있는 경우)
CREATE INDEX user_locked_idx ON "User" ("tenantId", "lockedUntil")
WHERE "lockedUntil" IS NOT NULL;
```

**부분 인덱스 사용 조건**:
- 대부분의 데이터가 특정 상태를 갖는 경우 (예: 90%가 CANCELED)
- 활성 데이터만 자주 조회하는 경우
- 인덱스 크기를 줄여 메모리 효율 향상

---

## 6. 데이터 마이그레이션 전략

### 6.1 Prisma 마이그레이션 기본

```bash
# 개발 환경: 스키마 변경 후 마이그레이션 생성
prisma migrate dev --name "add_user_profile_fields"

# 운영 환경: 미리 생성된 마이그레이션 적용
prisma migrate deploy

# 현재 DB 상태 확인
prisma migrate status
```

```
prisma/
├── schema.prisma                    ← 스키마 정의
└── migrations/
    ├── 20260101000000_init/
    │   └── migration.sql            ← 초기 스키마 생성
    ├── 20260201000000_add_mfa/
    │   └── migration.sql            ← MFA 컬럼 추가
    └── migration_lock.toml          ← 마이그레이션 잠금 파일
```

### 6.2 Expand-Contract 패턴 — 무중단 컬럼 추가

운영 중인 서비스에서 스키마를 변경할 때 서비스 중단 없이 하는 방법입니다.

```mermaid
flowchart LR
    subgraph EXPAND["1단계: Expand"]
        E1["새 컬럼 추가\n(nullable)"]
        E2["코드: 새 컬럼에도\n값 쓰기 시작"]
        E1 --> E2
    end

    subgraph MIGRATE["2단계: Migrate"]
        M1["기존 데이터를\n새 컬럼으로 복사"]
        M2["새 컬럼을\nnot null로 변경"]
        M1 --> M2
    end

    subgraph CONTRACT["3단계: Contract"]
        C1["구 컬럼 참조\n코드 제거"]
        C2["구 컬럼 삭제"]
        C1 --> C2
    end

    EXPAND --> MIGRATE --> CONTRACT
```

**실제 예시 — `phoneNumber` 컬럼 추가**:

```sql
-- 1단계: Expand — 새 컬럼 nullable로 추가 (서비스 무중단)
ALTER TABLE "User" ADD COLUMN "phoneNumber" TEXT;
-- ✅ 즉시 적용 가능, 기존 데이터 영향 없음
```

```typescript
// 1단계: 코드 변경 — 새 컬럼에도 쓰기 시작
// 구 컬럼(phone)과 새 컬럼(phoneNumber) 모두 채움
await prisma.user.update({
  where: { id: userId },
  data: {
    phone: formattedPhone,        // 기존 (호환성)
    phoneNumber: formattedPhone,  // 신규
  }
})
```

```sql
-- 2단계: Migrate — 기존 데이터 마이그레이션 (배치 처리)
-- 대용량: CURSOR로 배치 처리 (아래 배치 처리 섹션 참조)
UPDATE "User"
SET "phoneNumber" = "phone"
WHERE "phoneNumber" IS NULL
AND "phone" IS NOT NULL;

-- 2단계: not null 제약 추가 (모든 데이터 채워진 후)
ALTER TABLE "User"
ALTER COLUMN "phoneNumber" SET NOT NULL;
```

```typescript
// 3단계: Contract — 구 컬럼 참조 제거
await prisma.user.update({
  where: { id: userId },
  data: {
    phoneNumber: formattedPhone,  // 신규만
    // phone: 제거됨
  }
})
```

```sql
-- 3단계: 구 컬럼 삭제
ALTER TABLE "User" DROP COLUMN "phone";
```

### 6.3 대용량 데이터 배치 처리 (PostgreSQL CURSOR)

운영 DB에서 수백만 건을 한 번에 UPDATE하면 테이블 락이 걸려 서비스가 중단됩니다.

```sql
-- ✅ CURSOR를 사용한 배치 처리 — 서비스 무중단
DO $$
DECLARE
  batch_size INT := 1000;
  offset_val INT := 0;
  rows_updated INT;
BEGIN
  LOOP
    -- 1000건씩 처리
    UPDATE "User"
    SET "phoneNumber" = "phone"
    WHERE "id" IN (
      SELECT "id" FROM "User"
      WHERE "phoneNumber" IS NULL
        AND "phone" IS NOT NULL
      LIMIT batch_size
    );

    GET DIAGNOSTICS rows_updated = ROW_COUNT;

    -- 더 이상 업데이트할 데이터 없음
    EXIT WHEN rows_updated = 0;

    -- 배치 간 1초 대기 (DB 부하 분산)
    PERFORM pg_sleep(1);

    RAISE NOTICE '처리 완료: % 건', rows_updated;
  END LOOP;
END $$;
```

**TypeScript에서 배치 마이그레이션**:

```typescript
// scripts/migrations/migrate-phone-numbers.ts
// Design Ref: §6 — 대용량 데이터 마이그레이션

async function migratePhoneNumbers(): Promise<void> {
  const BATCH_SIZE = 1000
  let processed = 0

  console.log('전화번호 마이그레이션 시작...')

  while (true) {
    // 미처리 배치 조회
    const batch = await prisma.user.findMany({
      where: {
        phoneNumber: null,
        phone: { not: null },
      },
      select: { id: true, phone: true },
      take: BATCH_SIZE,
    })

    if (batch.length === 0) break

    // 트랜잭션으로 배치 업데이트
    await prisma.$transaction(
      batch.map((user) =>
        prisma.user.update({
          where: { id: user.id },
          data: { phoneNumber: user.phone },
        })
      )
    )

    processed += batch.length
    console.log(`진행: ${processed}건 처리됨`)

    // 부하 분산: 100ms 대기
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  console.log(`마이그레이션 완료: 총 ${processed}건`)
}

migratePhoneNumbers().catch(console.error)
```

### 6.4 마이그레이션 테스트 방법

```bash
# 1. 테스트 DB에 마이그레이션 적용 확인
DATABASE_URL="postgresql://test:test@localhost:5432/test_migration" \
  npx prisma migrate deploy

# 2. 마이그레이션 롤백 시뮬레이션
# (Prisma는 자동 롤백 미지원 — SQL 파일에서 DOWN 마이그레이션 수동 작성)

# 3. 대용량 테스트: pgbench로 1000만 건 삽입 후 배치 마이그레이션 시간 측정
pgbench -i -s 1000 postgresql://localhost/test_db
time psql postgresql://localhost/test_db -f scripts/migrate-batch.sql
```

---

## 7. 데이터 보존 정책 (CSAP D-10)

### 7.1 데이터 유형별 보존 정책

```mermaid
graph TD
    subgraph RETENTION["데이터 보존 정책"]
        A["감사 로그\nAuditLog"] -->|보존| R1["5년 이상 보존\nappend-only\nCSAP D-06"]
        B["계약/청구\nInvoice, Contract"] -->|보존| R2["5년 이상 보존\n소프트 삭제\n국세기본법"]
        C["개인정보\nUser.email, name"] -->|삭제| R3["목적 달성 후 즉시 익명화\n개인정보보호법 제21조"]
        D["세션/토큰\nSession"] -->|자동 만료| R4["15분 ~ 7일\nTTL 자동 삭제\nCSAP D-08"]
        E["AI 사용 로그\nAiUsage"] -->|보존| R5["1년 보존\nN2SF N-05"]
    end
```

### 7.2 감사 로그 append-only 보장

```typescript
// platform/services/compliance-service/src/lib/audit.ts
// Design Ref: §7 — CSAP D-06 감사 로그 무결성
// Plan SC: FR-P00.6

import { createHash } from 'crypto'

export async function appendAuditLog(params: {
  tenantId?: string
  actorId?: string
  action: string
  target?: string
  targetType?: string
  ip?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  // 직전 로그의 해시를 가져와 체인 연결
  const lastLog = await prisma.auditLog.findFirst({
    orderBy: { createdAt: 'desc' },
    where: params.tenantId ? { tenantId: params.tenantId } : {},
    select: { hash: true },
  })

  const previousHash = lastLog?.hash ?? '0'.repeat(64)

  // 현재 레코드 해시 생성
  const content = JSON.stringify({ ...params, previousHash })
  const hash = createHash('sha256').update(content).digest('hex')

  // append-only: CREATE만 허용, UPDATE/DELETE 금지
  await prisma.auditLog.create({
    data: {
      ...params,
      hash,
      previousHash,
    },
  })
}

// ❌ 이 함수는 구현하지 않음 — CSAP D-06 위반
// async function updateAuditLog() { ... }  // 금지
// async function deleteAuditLog() { ... }  // 금지
```

### 7.3 자동 데이터 정리 정책

```sql
-- PostgreSQL pg_cron을 사용한 자동 정리 (운영 환경)
-- 만료된 세션 자동 삭제 (매 시간)
SELECT cron.schedule(
  'delete-expired-sessions',
  '0 * * * *',  -- 매 시간 정각
  $$
    DELETE FROM "Session"
    WHERE "expiresAt" < NOW()
    AND "expiresAt" < NOW() - INTERVAL '1 day';
    -- 만료 후 1일이 지난 세션만 삭제 (즉시 삭제하면 디버깅 어려움)
  $$
);

-- 5년 이상 된 감사 로그를 콜드 스토리지로 이동 (매월 1일)
-- 실제 삭제가 아닌 아카이빙 (CSAP D-06 준수)
SELECT cron.schedule(
  'archive-old-audit-logs',
  '0 2 1 * *',  -- 매월 1일 02:00
  $$
    INSERT INTO "AuditLogArchive"
    SELECT * FROM "AuditLog"
    WHERE "createdAt" < NOW() - INTERVAL '5 years';
    -- 아카이브 후 원본 유지 (하드 삭제 금지)
  $$
);
```

### 7.4 개인정보 삭제 절차

```typescript
// 개인정보보호법 제21조: 목적 달성 후 개인정보 즉시 처리 정지
// Plan SC: FR-P00.PRIVACY

async function processUserDeletionRequest(
  userId: string,
  requestedBy: string  // 감사 추적용
): Promise<void> {
  const timestamp = new Date()

  await prisma.$transaction(async (tx) => {
    // 1. 감사 로그 기록 (삭제 전)
    await appendAuditLog({
      actorId: requestedBy,
      action: 'GDPR_USER_DELETE',
      target: userId,
      targetType: 'User',
      metadata: { reason: 'user_request', timestamp: timestamp.toISOString() }
    })

    // 2. 세션 완전 삭제 (활성 세션 무효화)
    await tx.session.deleteMany({ where: { userId } })

    // 3. 개인 식별 정보 익명화
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@anon.invalid`,
        name: '삭제된 사용자',
        passwordHash: 'DELETED',
        mfaSecret: null,
        deletedAt: timestamp,
      }
    })

    // 4. 알림 데이터 익명화
    await tx.notification.updateMany({
      where: { userId },
      data: { userId: null }  // 연결 끊기
    })
  })
}
```

---

## 8. 성능을 위한 DB 설계

### 8.1 EXPLAIN ANALYZE 기반 인덱스 추가

```sql
-- 실행 계획 분석 예시
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT u."id", u."name", u."email"
FROM "User" u
WHERE u."tenantId" = 'ten-001'
  AND u."role" = 'TENANT_ADMIN'
ORDER BY u."createdAt" DESC
LIMIT 20;

-- 결과 해석:
-- "Seq Scan" → 풀 스캔, 인덱스 없음
--   actual rows=10000, actual time=500ms → 인덱스 필요!
--
-- "Index Scan using user_tenant_idx" → 인덱스 사용
--   actual rows=3, actual time=0.5ms → 빠름
```

**인덱스 추가 후 성능 비교**:

```prisma
// Prisma 스키마에 복합 인덱스 추가
model User {
  // 기존
  @@index([tenantId])

  // 추가: role과 함께 조회하는 패턴이 많은 경우
  @@index([tenantId, role, createdAt(sort: Desc)])
}
```

### 8.2 N+1 쿼리 방지

```typescript
// ❌ N+1 쿼리 — 구독별로 플랜을 별도 조회 (구독 100개 → 쿼리 101번)
const subscriptions = await prisma.subscription.findMany({
  where: { tenantId }
})
for (const sub of subscriptions) {
  const plan = await prisma.plan.findUnique({ where: { id: sub.planId } })
  // 매 반복마다 DB 조회!
}

// ✅ 해결: include로 한 번에 JOIN
const subscriptions = await prisma.subscription.findMany({
  where: { tenantId },
  include: {
    plan: true,     // 1번의 JOIN 쿼리로 해결
    invoices: {
      take: 5,      // 최근 5개만 (과도한 데이터 로드 방지)
      orderBy: { createdAt: 'desc' }
    }
  }
})
```

### 8.3 감사 로그 월별 파티셔닝

감사 로그는 5년 보존이 의무이므로 수천만 건이 쌓입니다. 파티셔닝으로 쿼리 성능을 유지합니다.

```sql
-- 월별 파티셔닝 설정 (PostgreSQL 네이티브)
-- Prisma와 함께 사용 시 migration.sql에 수동 추가

-- 파티셔닝된 부모 테이블
CREATE TABLE "AuditLog" (
  "id"           TEXT NOT NULL,
  "tenantId"     TEXT,
  "actorId"      TEXT,
  "action"       TEXT NOT NULL,
  "target"       TEXT,
  "targetType"   TEXT,
  "ip"           TEXT,
  "userAgent"    TEXT,
  "metadata"     JSONB,
  "hash"         TEXT NOT NULL,
  "previousHash" TEXT NOT NULL,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE ("createdAt");

-- 월별 파티션 생성 (자동화 필요)
CREATE TABLE "AuditLog_2026_04" PARTITION OF "AuditLog"
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE "AuditLog_2026_05" PARTITION OF "AuditLog"
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- 파티션별 인덱스 (각 파티션에 자동 적용됨)
CREATE INDEX ON "AuditLog" ("tenantId", "createdAt");
```

```sql
-- 파티션 자동 생성 함수 (pg_cron으로 매월 실행)
CREATE OR REPLACE FUNCTION create_audit_partition(target_month DATE)
RETURNS void AS $$
DECLARE
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  partition_name := 'AuditLog_' || to_char(target_month, 'YYYY_MM');
  start_date := date_trunc('month', target_month);
  end_date := start_date + INTERVAL '1 month';

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF "AuditLog"
     FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_date, end_date
  );
END;
$$ LANGUAGE plpgsql;
```

### 8.4 Connection Pooling

```mermaid
graph LR
    subgraph SERVICES["마이크로서비스 (각 100 연결)"]
        A["auth-service\n(3 Pods × 10 연결)"]
        B["user-service\n(3 Pods × 10 연결)"]
        C["ai-service\n(2 Pods × 10 연결)"]
    end

    subgraph POOL["PgBouncer / Prisma Pool"]
        P["Connection Pool\n(총 20개 연결)"]
    end

    subgraph DB["PostgreSQL"]
        D["max_connections = 100"]
    end

    A --> P
    B --> P
    C --> P
    P --> D
```

```typescript
// platform/services/*/src/lib/prisma.ts
// Prisma Connection Pool 설정

import { PrismaClient } from '@prisma/client'

// 연결 풀 크기: CPU 코어 수 × 2 권장
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env['DATABASE_URL'],
      // ?connection_limit=10&pool_timeout=20
      // 환경 변수 URL에 포함하거나 직접 지정
    }
  },
  log: process.env['NODE_ENV'] === 'development'
    ? ['query', 'warn', 'error']
    : ['warn', 'error'],
})

// 싱글톤 패턴 (서비스 재시작 시 연결 재사용)
let instance: PrismaClient | null = null

export function getPrismaClient(): PrismaClient {
  if (!instance) {
    instance = prisma
  }
  return instance
}
```

**DATABASE_URL에서 연결 풀 설정**:

```bash
# .env (절대 커밋 금지)
DATABASE_URL="postgresql://saas:password@localhost:5432/saas_db?connection_limit=10&pool_timeout=20"

# 파라미터 설명:
# connection_limit=10  → 이 프로세스가 사용할 최대 연결 수
# pool_timeout=20      → 연결 대기 최대 20초 (초과 시 에러)
```

---

## 9. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 — 실제 스키마 기반 DB 설계 가이드 | Implementer (Sonnet) |

---

## 학습 체크리스트

학습을 마친 항목에 체크하십시오.

**기본 원칙**
- [ ] 모든 테이블의 필수 컬럼 4가지(`id`, `tenantId`, `createdAt`, `updatedAt`)와 이유를 설명할 수 있다
- [ ] 소프트 삭제와 하드 삭제를 언제 쓰는지 구분할 수 있다
- [ ] CSAP D-10 데이터 보존 기간 요건을 암기하고 있다

**ERD 이해**
- [ ] User → Tenant → Subscription → Plan 관계를 그림으로 그릴 수 있다
- [ ] 감사 로그의 해시 체인이 왜 필요한지 설명할 수 있다
- [ ] RBAC (UserRole → RolePermission → Permission)이 어떻게 동작하는지 설명할 수 있다

**스키마 설계**
- [ ] tenantId 필터를 빠트리면 어떤 보안 문제가 생기는지 설명할 수 있다
- [ ] 복합 인덱스에서 컬럼 순서가 왜 중요한지 설명할 수 있다
- [ ] JSON 컬럼의 장단점을 설명하고 적절한 사용 사례를 들 수 있다

**마이그레이션**
- [ ] Expand-Contract 패턴의 3단계를 순서대로 설명할 수 있다
- [ ] 대용량 마이그레이션에서 배치 처리가 필요한 이유를 설명할 수 있다
- [ ] `prisma migrate dev`와 `prisma migrate deploy`의 차이를 설명할 수 있다

**성능**
- [ ] EXPLAIN ANALYZE 결과에서 Seq Scan과 Index Scan을 구분할 수 있다
- [ ] N+1 쿼리 문제를 Prisma `include`로 해결할 수 있다
- [ ] 파티셔닝이 필요한 상황을 설명할 수 있다

---

## 다음 단계

- `03-development/15-redis-patterns.md` — Redis 고급 패턴 (캐싱, Rate Limit, 분산 락)
- `04-infrastructure/components/04-postgresql.md` — PostgreSQL 운영 관리
- `04-infrastructure/components/05-redis.md` — Redis 기본 설정
