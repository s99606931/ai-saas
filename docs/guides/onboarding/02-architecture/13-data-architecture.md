# 데이터 아키텍처 — OLTP vs OLAP, 데이터 흐름, CSAP 데이터 보존

> **문서 ID**: ONBOARD-02-13
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **대상**: 백엔드 개발자, 데이터 엔지니어, 아키텍트
> **전제 조건**: `02-architecture/01-system-overview.md`, `02-architecture/03-data-flow.md`
> **소요 시간**: 약 4시간
> **CSAP**: D-06 (감사 로그 보존), D-09 (암호화), D-10 (데이터 보존), D-11 (가상화 보안)
> **Design Ref**: DESIGN-MTU-P13 (감사 로그), DESIGN-MTU-P14 (컴플라이언스)
> **Plan SC**: FR-P13.1~FR-P13.4

---

## 목차

1. [우리 프로젝트의 데이터 아키텍처 개요](#1-우리-프로젝트의-데이터-아키텍처-개요)
2. [OLTP 운영 데이터 구조](#2-oltp-운영-데이터-구조)
3. [감사 데이터 아키텍처](#3-감사-데이터-아키텍처)
4. [이벤트 데이터 아키텍처](#4-이벤트-데이터-아키텍처)
5. [캐시 데이터 아키텍처](#5-캐시-데이터-아키텍처)
6. [CSAP 데이터 보존 요건 충족](#6-csap-데이터-보존-요건-충족)
7. [미래 데이터 아키텍처 계획](#7-미래-데이터-아키텍처-계획)
8. [변경 이력](#8-변경-이력)

---

## 1. 우리 프로젝트의 데이터 아키텍처 개요

### 1.1 현재 단일 PostgreSQL 구조 — 이유와 한계

현재 이 프로젝트는 **각 서비스별 독립 PostgreSQL 인스턴스** 구조를 사용합니다. "모든 서비스가 하나의 DB를 공유한다"는 뜻이 아니라, 각 마이크로서비스가 자신만의 PostgreSQL 스키마(또는 인스턴스)를 소유하는 구조입니다.

**이 구조를 선택한 이유**:

```
[마이크로서비스 원칙]
각 서비스는 자신의 데이터 저장소를 소유한다.
다른 서비스의 DB에 직접 접근하지 않는다.
서비스 간 데이터 공유는 API 호출로만 한다.

[CSAP 요건]
N2SF N-03: 테넌트 간 완전한 데이터 격리
D-09: 민감 데이터 암호화 저장
→ PostgreSQL RLS (Row-Level Security)로 구현
```

**현재 한계**:

```
한계 1: 복잡한 쿼리의 어려움
  → 여러 서비스의 데이터를 합쳐서 분석하려면?
  → 예: "이번 달 테넌트별 API 사용량 + 청구 금액 + 사용자 수" 조회
  → 각 서비스를 따로 쿼리 후 애플리케이션에서 조인 필요 (비효율)

한계 2: 리포팅의 어려움
  → 운영 DB에서 복잡한 집계 쿼리 실행 시 서비스 성능 저하
  → 예: "지난 1년간 일별 사용자 가입 추이" 쿼리 시 auth-service DB 부하

한계 3: 장기 데이터 분석 불가
  → 운영 DB는 최신 데이터 위주 (오래된 데이터는 아카이빙)
  → 추세 분석, 패턴 탐지 등 OLAP 워크로드에 부적합
```

**현재 구조가 적합한 이유 (Phase 1~2)**:

```
1. 개발 복잡도 낮음
   → 별도 OLAP 시스템 없이 PostgreSQL 하나로 운영

2. 비용 효율
   → 추가 데이터 웨어하우스 비용 없음

3. 데이터 일관성 보장
   → 단일 데이터 소스(운영 DB) = 항상 최신 데이터

4. CSAP 준수 단순화
   → 데이터 저장 위치가 명확, 보안 통제 집중 가능
```

### 1.2 향후 OLAP 도입 계획 (Phase 3 로드맵)

Phase 3에서는 분석용 데이터 계층을 분리할 계획입니다.

| 단계 | 시기 | 내용 |
|------|------|------|
| Phase 1 (현재) | 2026 Q1~Q2 | PostgreSQL 단일 구조, 기본 운영 |
| Phase 2 | 2026 Q3~Q4 | Redis 캐시 최적화, 읽기 레플리카 도입 |
| Phase 3 | 2027 Q1 | OLAP(ClickHouse) 도입, ETL 파이프라인 구축 |
| Phase 4 | 2027 Q3 | 실시간 분석 (Kafka 스트리밍) 도입 |

### 1.3 현재 데이터 아키텍처 전체 지도

```mermaid
graph TB
    subgraph "클라이언트 계층"
        UI["포털 (Next.js)"]
        API_CLIENT["외부 API 클라이언트"]
    end

    subgraph "API 계층"
        GW["API Gateway<br/>(인증·인가·라우팅)"]
    end

    subgraph "서비스 계층 (OLTP)"
        AUTH["auth-service<br/>PostgreSQL DB"]
        TENANT["tenant-service<br/>PostgreSQL DB"]
        USER["user-service<br/>PostgreSQL DB"]
        BILLING["billing-service<br/>PostgreSQL DB"]
        AUDIT["audit-service<br/>PostgreSQL DB<br/>(append-only)"]
        COMPLIANCE["compliance-service<br/>PostgreSQL DB"]
        AI["ai-service<br/>벡터 스토어"]
        OTHER["기타 서비스 (11개)<br/>각각 PostgreSQL DB"]
    end

    subgraph "캐시 계층"
        REDIS["Redis<br/>(세션·캐시·이벤트)"]
    end

    subgraph "데이터 보안"
        RLS["PostgreSQL RLS<br/>(Row-Level Security)"]
        ENC["AES-256 암호화<br/>(민감 컬럼)"]
        CHAIN["SHA-256 해시 체인<br/>(감사 로그 무결성)"]
    end

    subgraph "백업·복구"
        VELERO["Velero<br/>(k8s 백업)"]
        PITR["PostgreSQL PITR<br/>(포인트인타임 복구)"]
    end

    UI --> GW
    API_CLIENT --> GW
    GW --> AUTH
    GW --> TENANT
    GW --> USER
    GW --> BILLING
    GW --> OTHER

    AUTH --> REDIS
    TENANT --> REDIS
    USER --> REDIS

    AUTH --> AUDIT
    TENANT --> AUDIT
    USER --> AUDIT
    BILLING --> AUDIT

    TENANT -.-> RLS
    USER -.-> RLS
    BILLING -.-> ENC
    AUDIT -.-> CHAIN

    AUTH --> VELERO
    AUDIT --> VELERO
    AUTH --> PITR

    style AUDIT fill:#ffe0b2,stroke:#ff9800
    style CHAIN fill:#ffe0b2,stroke:#ff9800
    style RLS fill:#e8f5e9,stroke:#4caf50
    style ENC fill:#e8f5e9,stroke:#4caf50
```

---

## 2. OLTP 운영 데이터 구조

### 2.1 OLTP란 무엇인가

OLTP(Online Transaction Processing)는 일상적인 업무 처리를 위한 데이터베이스 패턴입니다.

```
OLTP 특성:
  - 짧은 트랜잭션 (밀리초 단위)
  - 많은 동시 사용자
  - 읽기/쓰기 혼합
  - 최신 데이터 위주
  - 예: 사용자 로그인, 주문 생성, 권한 확인

OLAP 특성 (우리가 아직 없는 것):
  - 복잡한 집계 쿼리 (몇 초~몇 분)
  - 적은 동시 사용자 (분석가)
  - 주로 읽기
  - 대용량 과거 데이터
  - 예: 분기별 매출 분석, 사용자 행동 패턴 분석
```

### 2.2 서비스별 PostgreSQL 스키마

각 서비스는 독립된 데이터 저장소를 가집니다.

**주요 서비스 데이터 모델 요약**:

```
auth-service DB:
  users          → 사용자 계정 (bcrypt 비밀번호)
  refresh_tokens → 리프레시 토큰 (블랙리스트 포함)
  login_attempts → 로그인 시도 (D-08 계정 잠금용)

tenant-service DB:
  tenants        → 테넌트 기본 정보
  tenant_configs → 테넌트별 설정 (암호화)

user-service DB:
  user_profiles  → 사용자 프로필 (PII, 일부 암호화)
  user_roles     → 사용자-역할 매핑 (RBAC)

billing-service DB:
  subscriptions  → 구독 정보
  invoices       → 청구서 (암호화)
  payment_logs   → 결제 이력 (PCI DSS 관련)

audit-service DB:
  audit_logs     → 감사 로그 (append-only, SHA-256 체인)
```

**공통 스키마 패턴** (모든 테이블 적용):

```typescript
// Design Ref: DESIGN-MTU-P13
// 이 프로젝트의 모든 Prisma 모델이 따르는 패턴

model ExampleEntity {
  // 1. 기본 키: CUID (UUID보다 짧고 사전 정렬 가능)
  id        String   @id @default(cuid())

  // 2. 멀티테넌시: 모든 데이터에 테넌트 소속 명시 (N2SF N-03)
  tenantId  String

  // 3. 감사 타임스탬프 (CSAP D-06)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // 비즈니스 필드들...

  // 4. 테넌트별 조회 인덱스 (필수)
  @@index([tenantId])

  // 5. 복합 인덱스 (테넌트 + 자주 쓰는 필드)
  @@index([tenantId, createdAt(sort: Desc)])
}
```

### 2.3 멀티테넌시 데이터 격리 (Row-level Security)

N2SF N-03 요건: "테넌트 간 데이터는 완전히 격리되어야 한다."

**PostgreSQL RLS 구현**:

```sql
-- Row-Level Security 활성화
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 테넌트 격리 정책: 현재 테넌트의 데이터만 접근 가능
CREATE POLICY tenant_isolation_policy ON user_profiles
  USING (tenant_id = current_setting('app.current_tenant_id')::text);

-- 애플리케이션에서 쿼리 전 테넌트 ID 설정
-- (Prisma 미들웨어에서 자동 설정)
SET app.current_tenant_id = 'tenant-123';
SELECT * FROM user_profiles;
-- → tenant-123의 데이터만 반환됨
```

**Prisma 미들웨어를 통한 자동 격리**:

```typescript
// Design Ref: DESIGN-MTU-P04
// Plan SC: FR-P04.1 — 테넌트 데이터 격리

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 모든 쿼리에 tenantId 자동 주입
prisma.$use(async (params, next) => {
  // 쓰기 작업: tenantId 자동 설정
  if (params.action === 'create' || params.action === 'createMany') {
    if (params.args.data) {
      params.args.data.tenantId = getCurrentTenantId()
    }
  }

  // 읽기 작업: tenantId 필터 자동 추가
  if (['findFirst', 'findMany', 'findUnique'].includes(params.action)) {
    if (!params.args.where) {
      params.args.where = {}
    }
    params.args.where.tenantId = getCurrentTenantId()
  }

  return next(params)
})

// 사용 예시: tenantId 수동 지정 불필요
const users = await prisma.userProfile.findMany()
// → 자동으로 현재 테넌트의 사용자만 반환
```

### 2.4 읽기/쓰기 분리 설계 (Primary/Replica)

현재는 단일 PostgreSQL 인스턴스를 사용하지만, Phase 2에서 읽기/쓰기 분리를 도입합니다.

```
현재 (Phase 1):
  쓰기 → PostgreSQL Primary
  읽기 → PostgreSQL Primary (동일)
  문제: 읽기 쿼리가 많아질수록 Primary에 부하 집중

Phase 2 목표:
  쓰기 → PostgreSQL Primary (단독 처리)
  읽기 → PostgreSQL Replica (부하 분산)
  효과: Primary 부하 50~70% 감소 (읽기:쓰기 = 7:3 일반적)
```

**Prisma 읽기 레플리카 설정** (Phase 2 준비):

```typescript
// prisma/client.ts (Phase 2 예정)
import { PrismaClient } from '@prisma/client'
import { readReplicas } from '@prisma/extension-read-replicas'

export const prisma = new PrismaClient().$extends(
  readReplicas({
    url: process.env.DATABASE_REPLICA_URL,  // 레플리카 URL
  })
)

// 사용:
// 읽기 쿼리는 자동으로 레플리카로 라우팅됨
const users = await prisma.userProfile.findMany()  // → Replica

// 쓰기 쿼리는 Primary로 라우팅됨
await prisma.userProfile.create({ data: { ... } })  // → Primary

// 강제로 Primary에서 읽기 (복제 지연 문제 방지)
const user = await prisma.$primary().userProfile.findFirst({ ... })
```

### 2.5 커넥션 풀 전략 (Prisma + PgBouncer)

PostgreSQL은 커넥션 수에 제한이 있습니다. 마이크로서비스가 많아질수록 커넥션 고갈 문제가 발생합니다.

```
문제:
  17개 서비스 × 각 10개 커넥션 = 170개 커넥션
  PostgreSQL 기본 max_connections = 100
  → 커넥션 고갈 발생!

해결: PgBouncer (커넥션 풀러)
  17개 서비스 → PgBouncer → PostgreSQL (20~30개 커넥션만 사용)
  효과: PostgreSQL 부하 80% 감소
```

**현재 Prisma 커넥션 풀 설정**:

```typescript
// prisma/client.ts
// Design Ref: DESIGN-MTU-P05

const prisma = new PrismaClient({
  datasources: {
    db: {
      // PgBouncer 사용 시 pgbouncer=true 파라미터 필수
      url: process.env.DATABASE_URL
      // 예: postgresql://user:pass@pgbouncer:5432/db?pgbouncer=true&connection_limit=5
    }
  },
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
    // { level: 'query', emit: 'event' }  // 개발 시에만 활성화
  ]
})

// 커넥션 풀 크기 설정 (환경 변수로 관리)
// DATABASE_URL에서 connection_limit=N으로 설정
// 서비스당 권장: 5~10개 (PgBouncer 사용 시 줄일 수 있음)
```

### 2.6 CSAP 데이터 분류별 저장 정책

```
N2SF 데이터 등급:

C등급 (기밀):
  - 대상: 개인식별정보(이름, 주민번호), 결제 정보, 비밀번호 해시
  - 저장: AES-256 컬럼 암호화 + 별도 암호화 테이블
  - 접근: 최소 권한 원칙, 모든 접근 감사 로그
  - AI 전송: 절대 금지 (N2SF N-05)

S등급 (민감):
  - 대상: 이메일, 전화번호, 사용자 활동 로그
  - 저장: 일반 저장 + 필드 수준 암호화 권장
  - 접근: RBAC 검사 필수
  - AI 전송: PII 마스킹 후 전송 가능

O등급 (일반):
  - 대상: 메뉴 정보, 공개 카탈로그, 시스템 설정
  - 저장: 일반 저장
  - 접근: 인증 후 접근
  - AI 전송: 마스킹 후 전송 가능
```

---

## 3. 감사 데이터 아키텍처

### 3.1 감사 로그 append-only 구조 분석

감사 로그는 일반 데이터와 다른 특별한 저장 구조가 필요합니다.

**CSAP D-06 요건**:
- 기록된 로그는 수정/삭제 불가 (append-only)
- 무결성 보장 (변조 탐지)
- 최소 1년 보존

**실제 구현 코드** (`platform/services/audit-service/src/lib/append-only.ts`):

```typescript
// Design Ref: DESIGN-MTU-P13
// Plan SC: FR-P13.1
// CSAP: D-06 — 감사 로그 수정/삭제 불가

import { createHash } from 'node:crypto'
import { prisma } from './prisma.js'

export async function appendAuditLog(entry: {
  tenantId?: string
  actorId?: string
  action: string
  target?: string
  targetType?: string
  ip?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  // 1. 이전 로그의 해시 조회 (체인 연결)
  const lastLog = await prisma.auditLog.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { hash: true },
  })

  const previousHash = lastLog?.hash ?? '0'.repeat(64)

  // 2. SHA-256 해시 계산 (체인 구조)
  const hashData = [
    entry.actorId ?? 'system',
    entry.action,
    entry.target ?? '',
    entry.targetType ?? '',
    entry.tenantId ?? 'system',
    new Date().toISOString(),
    previousHash,           // ← 이전 해시 포함 = 체인 구조
  ].join('|')

  const hash = createHash('sha256').update(hashData).digest('hex')

  // 3. INSERT만 사용 (UPDATE/DELETE 없음 = append-only)
  await prisma.auditLog.create({
    data: {
      ...entry,
      hash,
      previousHash,
    }
  })
}
```

**왜 이 구조가 안전한가**:

```
Bitcoin과 동일한 원리 (블록체인):
  각 로그 = 이전 로그의 해시를 포함
  → 중간 로그를 변조하면 그 이후 모든 해시가 달라짐
  → 변조를 즉시 탐지 가능

예시:
  로그1: hash = SHA256("actor1|LOGIN|...|000...0")
  로그2: hash = SHA256("actor2|LOGOUT|...|로그1의hash")
  로그3: hash = SHA256("actor3|DELETE|...|로그2의hash")

  로그2를 변조하면:
    로그2의 hash가 달라짐
    → 로그3의 previousHash와 불일치
    → 무결성 검증 실패!
```

### 3.2 SHA-256 체인 무결성 보장 방식

실제 무결성 검증 코드 (`platform/services/audit-service/src/lib/integrity.ts`):

```typescript
// Design Ref: DESIGN-MTU-P13
// Plan SC: FR-P13.2, FR-P13.4
// CSAP: D-06 — 감사 로그 무결성

export async function verifyAuditLogIntegrity(
  tenantId?: string,
  fromDate?: Date,
  toDate?: Date,
): Promise<IntegrityResult> {

  // CSAP D-10: 단일 검증 요청 최대 100,000건 제한 (OOM 방지)
  const logs = await prisma.auditLog.findMany({
    where: { tenantId, createdAt: { gte: fromDate, lte: toDate } },
    orderBy: { createdAt: 'asc' },
    take: 100000,
  })

  let previousHash = '0'.repeat(64)

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i]

    // 체인 연결 검증
    if (i > 0 && log.previousHash !== previousHash) {
      return {
        valid: false,
        brokenAt: log.createdAt.toISOString(),
        brokenLogId: log.id,
      }
    }

    // 해시 재계산 및 비교
    const hashData = [
      log.actorId ?? 'system',
      log.action,
      log.target ?? '',
      log.targetType ?? '',
      log.tenantId ?? 'system',
      log.createdAt.toISOString(),
      log.previousHash,
    ].join('|')

    const recomputedHash = createHash('sha256').update(hashData).digest('hex')

    if (log.hash !== recomputedHash) {
      return { valid: false, brokenLogId: log.id }
    }

    previousHash = log.hash
  }

  return { valid: true, totalEntries: logs.length }
}
```

**무결성 검증 API 호출**:

```bash
# 전체 감사 로그 무결성 검증
curl -X POST https://api.saas.local/audit/verify-integrity \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant-123",
    "fromDate": "2026-01-01T00:00:00Z",
    "toDate": "2026-04-12T23:59:59Z"
  }'

# 응답 (성공):
# {
#   "valid": true,
#   "totalEntries": 12453,
#   "checkedEntries": 12453
# }

# 응답 (변조 탐지):
# {
#   "valid": false,
#   "brokenAt": "2026-03-15T14:23:11Z",
#   "brokenLogId": "clxxx..."
# }
```

### 3.3 1년 이상 보존 전략 (CSAP D-06)

```
CSAP D-06 요건: 감사 로그 최소 1년 보존

현재 구현:
  운영 DB: 최근 1년 (빠른 조회)
  아카이브: 1~5년 (저비용 스토리지)

PostgreSQL 파티셔닝으로 구현:
```

```sql
-- 감사 로그 테이블 파티셔닝 (월별)
CREATE TABLE audit_logs (
  id          TEXT NOT NULL,
  tenant_id   TEXT,
  actor_id    TEXT,
  action      TEXT NOT NULL,
  target      TEXT,
  target_type TEXT,
  ip          TEXT,
  user_agent  TEXT,
  metadata    JSONB,
  hash        TEXT NOT NULL,
  previous_hash TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- 월별 파티션 생성 (예: 2026년 1월)
CREATE TABLE audit_logs_2026_01
  PARTITION OF audit_logs
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE audit_logs_2026_02
  PARTITION OF audit_logs
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- 1년 이상 된 파티션 아카이브
-- (월별 크론 작업으로 자동화)
-- 1. 파티션 분리
ALTER TABLE audit_logs DETACH PARTITION audit_logs_2025_01;
-- 2. 덤프 후 저비용 스토리지로 이동
-- 3. 조회가 필요하면 임시 재연결
ALTER TABLE audit_logs ATTACH PARTITION audit_logs_2025_01
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

### 3.4 감사 데이터 조회 최적화

```sql
-- 자주 사용되는 쿼리 패턴에 맞는 인덱스

-- 테넌트별 + 시간순 조회 (가장 빈번)
CREATE INDEX idx_audit_tenant_time
  ON audit_logs (tenant_id, created_at DESC);

-- 특정 사용자 활동 조회
CREATE INDEX idx_audit_actor
  ON audit_logs (actor_id, created_at DESC);

-- 특정 액션 유형 조회 (감리 시 사용)
CREATE INDEX idx_audit_action
  ON audit_logs (action, created_at DESC);

-- 복합 검색 (테넌트 + 액션 + 기간)
CREATE INDEX idx_audit_tenant_action_time
  ON audit_logs (tenant_id, action, created_at DESC);
```

### 3.5 감사 로그 생명주기 다이어그램

```mermaid
stateDiagram-v2
    [*] --> 이벤트발생: 민감 작업 수행

    이벤트발생 --> 해시계산: auditLog() 호출
    해시계산 --> DB저장: appendAuditLog()
    note right of 해시계산
      SHA-256 계산
      이전 해시 포함
      체인 구조 형성
    end note

    DB저장 --> 운영보존: INSERT (append-only)
    note right of DB저장
      UPDATE 불가
      DELETE 불가
      PostgreSQL 트리거로 강제
    end note

    운영보존 --> 무결성검증: 정기 검증 (주간)
    무결성검증 --> 운영보존: 검증 통과
    무결성검증 --> 보안알림: 검증 실패 (변조 탐지!)

    운영보존 --> 파티션이동: 1년 경과
    파티션이동 --> 아카이브: 저비용 스토리지
    아카이브 --> 임시조회: 감리/법적 요청
    임시조회 --> 아카이브: 조회 완료

    아카이브 --> [*]: 5년 후 삭제 (법적 보존 기간 완료)

    note right of 보안알림
      CSAP D-06 위반
      즉시 보안팀 알림
      포렌식 분석 시작
    end note
```

### 3.6 감사 로그 수집 패턴

모든 서비스에서 감사 로그를 기록하는 표준 패턴:

```typescript
// Design Ref: DESIGN-MTU-P14 (compliance-service에서 사용)
// CSAP: D-06

import { createAuditLogger, createStandardTransport } from '@public-saas/audit-sdk'

// 서비스별 감사 로거 초기화
const auditLogger = createAuditLogger({
  serviceName: 'compliance-service',
  transport: createStandardTransport('compliance-service'),
})

// 감사 로그 기록 (표준 함수)
async function logComplianceEvent(
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await auditLogger.log({
    actor: 'system:compliance-service',
    action,
    target: 'compliance',
    targetType: 'compliance',
    tenantId: 'system',
    ip: process.env.SERVICE_IP || '127.0.0.1',
    userAgent: 'compliance-service/1.0',
    metadata,
  })
}

// 사용 예시
await logComplianceEvent('CSAP_CHECK_COMPLETED', {
  domain: 'D-08',
  score: 100,
  items_checked: 12,
})
```

---

## 4. 이벤트 데이터 아키텍처

### 4.1 Redis Streams vs Pub/Sub 선택 기준

이 프로젝트는 서비스 간 이벤트 전달에 Redis를 사용합니다. Redis는 두 가지 이벤트 패턴을 제공합니다.

| 항목 | Redis Streams | Redis Pub/Sub |
|------|-------------|--------------|
| 메시지 보존 | 설정 가능 (TTL 또는 길이) | 보존 안 됨 |
| 재처리 | 가능 (Consumer Group) | 불가능 |
| 구독자 없을 때 | 메시지 보관 | 메시지 소실 |
| 순서 보장 | 보장 | 보장 안 됨 |
| 사용 사례 | 중요한 비즈니스 이벤트 | 실시간 알림 |

**우리 프로젝트의 선택**:

```
Redis Streams 사용 (대부분):
  - 테넌트 생성/삭제 이벤트
  - 구독 상태 변경 이벤트
  - 청구 이벤트
  → 소실되면 데이터 불일치 발생 → 반드시 재처리 보장 필요

Redis Pub/Sub 사용 (일부):
  - 실시간 알림 (사용자에게 즉각 전달 목적)
  - 캐시 무효화 신호
  → 잠깐 오프라인이어도 괜찮은 알림성 메시지
```

### 4.2 이벤트 보존 정책 (TTL 설정)

```typescript
// 이벤트 유형별 TTL 설정
const EVENT_TTL_SECONDS = {
  // 중요 비즈니스 이벤트: 7일 보존 (재처리를 위해)
  'tenant.created': 7 * 24 * 60 * 60,
  'subscription.changed': 7 * 24 * 60 * 60,
  'billing.invoice.created': 7 * 24 * 60 * 60,

  // 알림성 이벤트: 24시간 보존
  'notification.push': 24 * 60 * 60,

  // 캐시 무효화: 즉시 처리 후 삭제
  'cache.invalidate': 60,  // 1분
}

// Redis Streams에 이벤트 발행
async function publishEvent(
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  const stream = `events:${eventType}`
  const ttl = EVENT_TTL_SECONDS[eventType] ?? 3600

  await redis.xadd(
    stream,
    '*',  // 자동 ID
    'type', eventType,
    'payload', JSON.stringify(payload),
    'timestamp', new Date().toISOString(),
  )

  // TTL 설정 (길이 제한으로 자동 관리)
  await redis.xtrim(stream, 'MAXLEN', '~', 10000)  // 최대 10,000개 유지
}
```

### 4.3 DLQ (Dead Letter Queue) 데이터 처리

이벤트 처리에 실패한 경우를 위한 Dead Letter Queue 패턴:

```typescript
// 이벤트 처리 실패 시 DLQ로 이동
const MAX_RETRY_COUNT = 3

async function processEvent(eventId: string, event: Event): Promise<void> {
  const retryCount = parseInt(event.retryCount ?? '0')

  try {
    await handleEvent(event)
    // 성공: 스트림에서 확인 처리
    await redis.xack('events:tenant.created', 'saas-consumers', eventId)

  } catch (error) {
    if (retryCount >= MAX_RETRY_COUNT) {
      // 최대 재시도 초과: DLQ로 이동
      await redis.xadd(
        'events:dlq',
        '*',
        'original_stream', 'events:tenant.created',
        'original_id', eventId,
        'payload', JSON.stringify(event),
        'error', (error as Error).message,
        'failed_at', new Date().toISOString(),
      )
      await redis.xack('events:tenant.created', 'saas-consumers', eventId)

      // 감사 로그 기록 (CSAP D-06)
      await appendAuditLog({
        action: 'EVENT_DLQ_MOVED',
        target: eventId,
        metadata: { error: (error as Error).message, retryCount },
      })
    } else {
      // 재시도 가능: 메시지에 재시도 횟수 추가
      await redis.xadd(
        'events:tenant.created:retry',
        '*',
        ...Object.entries(event).flat(),
        'retryCount', String(retryCount + 1),
      )
    }
  }
}
```

**DLQ 모니터링**:

```bash
# DLQ에 쌓인 이벤트 수 확인
redis-cli XLEN events:dlq

# DLQ 내용 확인
redis-cli XRANGE events:dlq - + COUNT 10

# DLQ 이벤트 재처리 (수동)
redis-cli XRANGE events:dlq - + | jq '.[] | .payload' | xargs -I{} curl -X POST ...
```

---

## 5. 캐시 데이터 아키텍처

### 5.1 Redis 캐시 레이어 설계

```mermaid
graph LR
    subgraph "요청 처리"
        REQ["API 요청"]
        HANDLER["핸들러"]
    end

    subgraph "캐시 계층"
        L1["L1 캐시<br/>인메모리 (Node.js)<br/>TTL: 30초"]
        L2["L2 캐시<br/>Redis<br/>TTL: 5분~1시간"]
    end

    subgraph "데이터 계층"
        DB["PostgreSQL<br/>(Primary)"]
    end

    REQ --> HANDLER
    HANDLER --> L1
    L1 -->|"캐시 미스"| L2
    L2 -->|"캐시 미스"| DB
    DB -->|"결과 저장"| L2
    L2 -->|"결과 저장"| L1
    L1 --> HANDLER
    HANDLER --> REQ

    style L1 fill:#e3f2fd
    style L2 fill:#e8eaf6
    style DB fill:#fce4ec
```

### 5.2 캐시 키 네이밍 컨벤션 (테넌트 격리)

테넌트 간 캐시 데이터 격리는 키 네이밍 컨벤션으로 보장합니다.

```typescript
// 캐시 키 생성 유틸리티
// Design Ref: DESIGN-MTU-P06

function buildCacheKey(
  tenantId: string,
  service: string,
  resource: string,
  ...identifiers: string[]
): string {
  // 형식: {테넌트ID}:{서비스}:{리소스}:{식별자들}
  const parts = [tenantId, service, resource, ...identifiers]
  return parts.filter(Boolean).join(':')
}

// 사용 예시
const userKey = buildCacheKey('tenant-123', 'user', 'profile', userId)
// → "tenant-123:user:profile:user-456"

const menuKey = buildCacheKey('tenant-123', 'menu', 'items', 'page:1')
// → "tenant-123:menu:items:page:1"

const configKey = buildCacheKey('tenant-123', 'tenant', 'config')
// → "tenant-123:tenant:config"

// ❌ 잘못된 패턴 (테넌트 격리 없음)
const badKey = `user:profile:${userId}`
// → 테넌트A와 테넌트B의 userId가 같으면 데이터 혼재!
```

**캐시 격리 검증**:

```bash
# Redis에서 테넌트별 키 확인
redis-cli KEYS "tenant-123:*" | wc -l  # tenant-123의 캐시 수
redis-cli KEYS "tenant-456:*" | wc -l  # tenant-456의 캐시 수

# 테넌트 격리 검증: 다른 테넌트 패턴이 없어야 함
redis-cli KEYS "tenant-123:*" | grep -v "^tenant-123:" | wc -l
# → 0 (다른 테넌트 키 없음)
```

### 5.3 캐시 무효화 전략

캐시 무효화는 캐싱에서 가장 어려운 문제 중 하나입니다.

```typescript
// 두 가지 무효화 전략 비교

// 전략 1: TTL 기반 (단순, 약간의 데이터 불일치 허용)
// → 설정 시간이 지나면 자동 무효화
await redis.setex(cacheKey, 300, JSON.stringify(data))  // 5분 TTL
// 단점: 데이터 변경 후 최대 5분간 오래된 데이터 반환 가능

// 전략 2: 명시적 무효화 (복잡, 즉각 일관성)
// → 데이터 변경 시 캐시 직접 삭제
async function updateUserProfile(
  tenantId: string,
  userId: string,
  data: UpdateUserProfileInput
): Promise<UserProfile> {
  // DB 업데이트
  const updated = await prisma.userProfile.update({
    where: { id: userId, tenantId },
    data,
  })

  // 캐시 즉시 무효화
  const cacheKey = buildCacheKey(tenantId, 'user', 'profile', userId)
  await redis.del(cacheKey)

  // 목록 캐시도 무효화 (사용자 목록에 영향)
  const listKey = buildCacheKey(tenantId, 'user', 'list', '*')
  const listKeys = await redis.keys(listKey)
  if (listKeys.length > 0) {
    await redis.del(...listKeys)
  }

  return updated
}
```

**우리 프로젝트의 캐시 전략 결정**:

| 데이터 유형 | 전략 | TTL | 이유 |
|---------|------|-----|------|
| 사용자 프로필 | 명시적 | - | 변경 즉시 반영 필요 |
| 테넌트 설정 | 명시적 | - | 보안 설정 즉시 반영 |
| 메뉴 목록 | TTL | 5분 | 약간의 지연 허용 |
| 카탈로그 정보 | TTL | 1시간 | 자주 변경 안 됨 |
| JWT 블랙리스트 | TTL | 토큰만료까지 | 만료 후 자동 정리 |

### 5.4 캐시 계층 비교 (L1 인메모리 vs L2 Redis)

```typescript
// L1 캐시: Node.js 프로세스 메모리 (node-cache 또는 lru-cache)
import { LRUCache } from 'lru-cache'

const l1Cache = new LRUCache<string, unknown>({
  max: 500,          // 최대 500개 항목
  ttl: 30_000,       // 30초 TTL
  // 주의: 서비스 재시작 시 모두 사라짐
  // 주의: 여러 Pod 간 공유 안 됨 (각자 독립)
})

// L2 캐시: Redis (분산 캐시)
// → 여러 Pod이 공유
// → 서비스 재시작 후에도 유지
// → 단점: 네트워크 지연 (수 밀리초)

// 캐시 조회 전략: L1 → L2 → DB
async function getWithCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = 300
): Promise<T> {
  // L1 확인
  const l1Value = l1Cache.get(key) as T | undefined
  if (l1Value) return l1Value

  // L2 확인
  const l2Value = await redis.get(key)
  if (l2Value) {
    const parsed = JSON.parse(l2Value) as T
    l1Cache.set(key, parsed)  // L1에도 저장
    return parsed
  }

  // DB에서 조회
  const fresh = await fetchFn()
  await redis.setex(key, ttl, JSON.stringify(fresh))  // L2 저장
  l1Cache.set(key, fresh)  // L1 저장
  return fresh
}
```

---

## 6. CSAP 데이터 보존 요건 충족

### 6.1 데이터 등급별 보존 기간 정책

| 데이터 유형 | CSAP 항목 | 최소 보존 기간 | 실제 보존 기간 | 비고 |
|---------|---------|-----------|-----------|------|
| 감사 로그 | D-06 | 1년 | 5년 | 법적 분쟁 대비 |
| 보안 이벤트 로그 | D-06 | 1년 | 3년 | 침해사고 조사용 |
| 사용자 계정 정보 | D-10 | 탈퇴 후 즉시 | 탈퇴 후 30일 | 오류 복구 대비 |
| 개인정보 (PII) | D-10 | 목적 달성 후 즉시 | 계약 종료 후 90일 | 법적 의무 |
| 결제 정보 | 전자금융법 | 5년 | 5년 | 전자금융거래법 §22 |
| 접근 로그 | D-08 | 6개월 | 1년 | ISMS 권고 |
| SBOM/취약점 스캔 | D-12 | 감리 주기 | 365일 | CI 아티팩트 |

### 6.2 자동 삭제 방지 메커니즘

```sql
-- 감사 로그 테이블에 삭제 방지 트리거
-- CSAP D-06: 감사 로그는 수정/삭제 불가

CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- DELETE 시도 차단
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'CSAP D-06 위반: 감사 로그 삭제 불가. 로그ID: %', OLD.id;
  END IF;

  -- UPDATE 시도 차단
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION
      'CSAP D-06 위반: 감사 로그 수정 불가. 로그ID: %', OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

-- PostgreSQL 권한 제한
-- 감사 로그 테이블: INSERT만 허용, UPDATE/DELETE 불가
REVOKE UPDATE, DELETE ON audit_logs FROM app_user;
GRANT SELECT, INSERT ON audit_logs TO app_user;
```

### 6.3 백업 및 복구 전략 (Velero + PITR)

```yaml
# Velero 백업 스케줄 (k8s 전체 상태)
# Design Ref: DESIGN-MTU-P10

apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: daily-backup
  namespace: velero
spec:
  schedule: "0 2 * * *"  # 매일 02:00 KST (Cron 기준 UTC 17:00)
  template:
    includedNamespaces:
      - saas-platform
    storageLocation: default
    ttl: 720h0m0s  # 30일 보존
    hooks:
      resources:
        - name: pre-backup-quiesce
          includedNamespaces:
            - saas-platform
          labelSelector:
            matchLabels:
              backup-hook: "true"
          pre:
            - exec:
                command: ["/bin/sh", "-c", "pg_dump -Fc $DATABASE_URL > /tmp/pre-backup.dump"]
                timeout: 60s
```

```bash
# PostgreSQL PITR (Point-In-Time Recovery) 설정
# postgresql.conf

wal_level = replica           # WAL 수준 (복구에 필요)
archive_mode = on             # WAL 아카이빙 활성화
archive_command = 'test ! -f /archive/%f && cp %p /archive/%f'

# 특정 시점으로 복구 명령
pg_restore \
  --target-time "2026-04-12 14:00:00" \
  --recovery-target-action pause \
  -d "postgresql://localhost:5432/saas_db"
```

### 6.4 CSAP D-10 증거 수집 자동화

```bash
#!/bin/bash
# scripts/collect-data-retention-evidence.sh
# CSAP D-10 데이터 보존 정책 증거 수집

DATE=$(date +%Y%m%d)
OUTPUT="csap-d10-evidence-${DATE}"
mkdir -p "${OUTPUT}"

echo "=== CSAP D-10 데이터 보존 증거 수집 ==="

# 1. 감사 로그 건수 및 최오래된 기록 확인
psql "${DATABASE_URL}" -c "
  SELECT
    COUNT(*) as total_logs,
    MIN(created_at) as oldest_log,
    MAX(created_at) as newest_log,
    EXTRACT(DAYS FROM NOW() - MIN(created_at)) as retention_days
  FROM audit_logs;
" -o "${OUTPUT}/audit-log-stats.txt"

# 2. 무결성 검증 결과
curl -s -X POST "${API_URL}/audit/verify-integrity" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  > "${OUTPUT}/integrity-check.json"

# 3. 백업 이력 확인 (Velero)
velero backup get --output json > "${OUTPUT}/backup-history.json" 2>/dev/null || true

# 4. 보존 정책 문서 복사
cp docs/data-retention-policy.md "${OUTPUT}/" 2>/dev/null || true

echo "[완료] CSAP D-10 증거: ${OUTPUT}/"
```

---

## 7. 미래 데이터 아키텍처 계획

### 7.1 Analytics DB 도입 (ClickHouse/BigQuery 검토)

Phase 3에서 운영 DB 부하 없이 복잡한 분석을 위해 OLAP 시스템을 도입합니다.

**ClickHouse 도입 이유**:

```
PostgreSQL (OLTP):
  SELECT * FROM audit_logs WHERE tenant_id = 'T1' AND created_at > '2026-01-01'
  → 인덱스 활용, 빠름 (밀리초)

PostgreSQL (OLAP 쿼리):
  SELECT DATE_TRUNC('day', created_at), action, COUNT(*)
  FROM audit_logs
  WHERE created_at > '2025-01-01'
  GROUP BY 1, 2
  ORDER BY 1, 3 DESC;
  → 풀 스캔 필요, 느림 (초~분)
  → 운영 DB에 부하 가중!

ClickHouse (OLAP):
  동일 쿼리 → 컬럼형 저장 구조로 10~100배 빠름
  → 운영 DB 영향 없음
  → 공공기관 On-premise 배포 가능 (클라우드 금지 요건 대응)
```

**ClickHouse vs BigQuery 비교**:

| 항목 | ClickHouse | BigQuery |
|------|----------|---------|
| 배포 방식 | Self-hosted (k3s) | Google Cloud |
| 공공기관 적합성 | 적합 (On-premise) | 부적합 (외부 클라우드) |
| 비용 | 서버 비용만 | 쿼리당 과금 |
| 관리 부담 | 높음 | 낮음 |
| 성능 | 우수 | 우수 |

공공기관 SaaS는 외부 클라우드 사용 제한으로 **ClickHouse**를 선택합니다.

### 7.2 데이터 레이크 설계 방향

```mermaid
graph TD
    subgraph "운영 계층 (현재)"
        OLTP["각 서비스 PostgreSQL<br/>(OLTP)"]
        REDIS_NOW["Redis<br/>(캐시·이벤트)"]
    end

    subgraph "수집 계층 (Phase 3)"
        CDC["CDC (Change Data Capture)<br/>Debezium"]
        ETL["ETL 파이프라인"]
    end

    subgraph "저장 계층 (Phase 3)"
        LAKE["데이터 레이크<br/>(MinIO - S3 호환)"]
        OLAP["ClickHouse<br/>(OLAP)"]
    end

    subgraph "분석 계층 (Phase 3)"
        DASHBOARD["분석 대시보드<br/>(Grafana)"]
        REPORT["CSAP 보고서 자동화"]
        ML["ML 파이프라인<br/>(packages/ml-pipeline)"]
    end

    OLTP --> CDC
    REDIS_NOW --> ETL
    CDC --> LAKE
    ETL --> LAKE
    LAKE --> OLAP
    OLAP --> DASHBOARD
    OLAP --> REPORT
    LAKE --> ML

    style LAKE fill:#fff9c4
    style OLAP fill:#e8f5e9
```

### 7.3 ETL 파이프라인 구축 계획

```
Phase 3 ETL 설계:

소스 (Source):
  - PostgreSQL CDC (Debezium) → 실시간 변경 감지
  - Redis Streams → 이벤트 데이터
  - Audit Service → 감사 로그

변환 (Transform):
  - PII 마스킹 (분석 목적으로도 개인정보 불필요)
  - 테넌트 ID 해시화 (익명화)
  - 타임스탬프 표준화 (UTC)
  - 중복 제거

적재 (Load):
  - MinIO (원본 데이터 레이크, Parquet 형식)
  - ClickHouse (분석용, 컬럼형)

스케줄:
  - 실시간: 보안 이벤트 (CDC)
  - 5분 배치: 운영 지표
  - 1시간 배치: 비즈니스 분석
  - 1일 배치: 경영진 보고
```

### 7.4 실시간 분석 (Kafka 도입 검토)

현재 Redis Streams로 처리하는 이벤트가 증가하면 Kafka 도입을 검토합니다.

```
Redis Streams → Kafka 전환 기준:

현재 (Redis Streams 적합):
  - 이벤트 처리량: 초당 1,000건 이하
  - 보존 기간: 7일 이하
  - 파티션: 단일

Kafka 도입 검토 시점:
  - 이벤트 처리량: 초당 10,000건 이상
  - 보존 기간: 30일 이상 필요
  - 여러 소비자 그룹에서 독립적으로 소비
  - 정확히 한 번(exactly-once) 처리 필요

현재 평가: Redis Streams로 충분 (Phase 2까지)
재평가 시점: 2026년 Q4 (Phase 2 완료 후)
```

---

## 8. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 초안 작성 — 데이터 아키텍처 전체 가이드 | Implementer (Sonnet) |

---

**관련 문서**:
- `02-architecture/03-data-flow.md` — 데이터 흐름 상세 (선행 문서)
- `02-architecture/05-event-driven-architecture.md` — 이벤트 아키텍처 심화
- `03-development/14-database-design.md` — 데이터베이스 설계 가이드
- `platform/services/audit-service/src/lib/append-only.ts` — 감사 로그 구현체
- `platform/services/audit-service/src/lib/integrity.ts` — 무결성 검증 구현체
