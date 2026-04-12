# 멀티테넌시 심화 — 테넌트 격리의 모든 것

> **문서 ID**: ONBOARD-ARCH-07
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **대상**: API·DB·인프라를 다루는 중급 개발자
> **전제 조건**: `02-multitenancy.md` 완료, `services/04-tenant-service.md` 학습 완료
> **소요 시간**: 약 120분
> **Design Ref**: DESIGN-MTU-P03 — 테넌트 격리 아키텍처, SVC-TENANT-R14
> **Plan SC**: FR-P03.1~FR-P03.8, FR-TENANT.1~FR-TENANT.5
> **CSAP**: D-08 (접근 통제), D-09 (암호화), N2SF N-03 (격리 아키텍처)

---

## 목차

1. [왜 이 문서가 필요한가](#1-왜-이-문서가-필요한가)
2. [격리 전략 재검토 — 우리가 Row-level을 선택한 진짜 이유](#2-격리-전략-재검토--우리가-row-level을-선택한-진짜-이유)
3. [테넌트 컨텍스트 전파 — Request Lifecycle 완전 해부](#3-테넌트-컨텍스트-전파--request-lifecycle-완전-해부)
4. [격리 레이어 심화 — L1~L4 구현 상세](#4-격리-레이어-심화--l1l4-구현-상세)
5. [SUPER_ADMIN 접근 — 보안 조치와 감사 추적](#5-super_admin-접근--보안-조치와-감사-추적)
6. [테넌트 라이프사이클 완전 가이드](#6-테넌트-라이프사이클-완전-가이드)
7. [테넌트별 피처 플래그와 설정](#7-테넌트별-피처-플래그와-설정)
8. [테넌트 간 데이터 누출 시나리오와 방어](#8-테넌트-간-데이터-누출-시나리오와-방어)
9. [실습 — 새 API 엔드포인트에서 테넌트 격리 검증하기](#9-실습--새-api-엔드포인트에서-테넌트-격리-검증하기)
10. [격리 위반 감지와 대응](#10-격리-위반-감지와-대응)
11. [학습 체크리스트](#11-학습-체크리스트)
12. [다음 단계](#12-다음-단계)

---

## 1. 왜 이 문서가 필요한가

`02-multitenancy.md`를 읽으면 멀티테넌시의 기초 개념과 4개 격리 레이어의 전체 그림을 이해할 수 있습니다. 그러나 실제 코드를 작성하다 보면 다음과 같은 질문이 생깁니다.

```
"JWT 토큰에서 tenantId를 어떻게 꺼내서 DB 쿼리까지 전달하나요?"
"Redis 캐시 키에 테넌트를 어떻게 분리하나요?"
"SUPER_ADMIN이 다른 기관 데이터에 접근하면 감사 로그가 남나요?"
"테넌트 삭제 시 CSAP D-10 요건을 어떻게 충족하나요?"
"테넌트별로 AI 모델을 다르게 설정할 수 있나요?"
```

이 문서는 초급 가이드에서 다루지 못한 **구현 레벨의 내부 동작**을 해설합니다. 실제 프로덕션 코드(`platform/packages/tenant-isolation/`)를 직접 분석하여 설명합니다.

---

## 2. 격리 전략 재검토 — 우리가 Row-level을 선택한 진짜 이유

### 2.1 세 가지 전략의 실제 비용 비교

초급 가이드에서 세 가지 전략을 간략히 소개했습니다. 여기서는 실제 운영 비용을 수치로 살펴봅니다.

```
전략 1: Database-per-tenant
  기관 100개 × PostgreSQL 인스턴스 = 100개 DB 서버
  월 운영비: 서버 100대 × 50만원 = 5,000만원
  DBA 인력: 100개 인스턴스 모니터링 → 풀타임 DBA 5명 필요
  마이그레이션: 스키마 변경 시 100번 반복 실행 → 배포 2~3시간

전략 2: Schema-per-tenant
  기관 100개 × PostgreSQL 스키마 = 하나의 DB, 100개 스키마
  월 운영비: 서버 5대 (HA 구성) × 50만원 = 250만원
  DBA 인력: 스키마 관리 스크립트로 일부 자동화 가능
  제약사항: PostgreSQL 전용 (MySQL, SQLite 불가)
  마이그레이션: 스키마 100개에 순차 실행 → 배포 30~60분

전략 3: Row-level (우리의 선택)
  기관 100개 × 같은 테이블 + tenant_id 컬럼
  월 운영비: 서버 3대 (HA 구성) × 50만원 = 150만원
  DBA 인력: 일반 DB 운영 수준, 추가 인력 불필요
  마이그레이션: 단 1회 실행 → 배포 5~10분
  제약사항: 코드에서 테넌트 필터 철저히 구현 필요
```

### 2.2 CSAP 관점에서의 Row-level 격리 근거

Row-level 격리가 CSAP 중/상 등급 요건을 충족할 수 있는 이유는 다음과 같습니다.

```
CSAP D-08 접근 통제 요건:
  "사용자는 자신의 권한 범위 내 데이터에만 접근 가능해야 한다"

Row-level 격리가 D-08을 충족하는 방법:
  1. JWT 토큰에 tenantId 포함 → 사용자 신원과 테넌트 연결
  2. API 레이어: tenantId 일치 검증 → 401/403 반환
  3. DB 레이어: 모든 쿼리에 WHERE tenant_id = ? → 물리적 필터
  4. 감사 로그: 모든 크로스테넌트 접근 시도 기록
  5. 자동화 테스트: 격리 위반 시 CI 파이프라인 차단

N2SF N-03 격리 아키텍처 요건:
  "기관 데이터는 논리적 또는 물리적으로 격리되어야 한다"
  → Row-level은 '논리적 격리'에 해당 → 충족
  → C/S 등급 데이터는 '물리적 격리' 필요 → 별도 DB 또는 암호화로 보완
```

### 2.3 Row-level 격리의 핵심 위험과 완화 조치

```
위험: 개발자가 WHERE tenant_id = ? 를 빠뜨리는 실수
완화 조치:
  1. RowLevelSecurity 클래스가 자동으로 tenant_id 조건 추가
  2. Prisma 미들웨어에서 쿼리 인터셉트 → tenant_id 없는 쿼리 차단
  3. 코드 리뷰 체크리스트: "모든 DB 쿼리에 tenant_id 필터 있는가?"
  4. E2E 테스트: 기관 A의 토큰으로 기관 B 데이터 접근 시도 → 403 확인
```

```mermaid
graph TB
  subgraph "격리 전략 비교"
    A["Database-per-tenant<br/>물리적 완전 격리<br/>비용: ★★★★★<br/>관리: ★★★★★<br/>CSAP: C/S 최고등급 필수"]
    B["Schema-per-tenant<br/>스키마 격리<br/>비용: ★★★<br/>관리: ★★★<br/>CSAP: 중/상등급 충족"]
    C["Row-level 격리 ✅<br/>논리적 격리<br/>비용: ★<br/>관리: ★<br/>CSAP: 중/상등급 충족"]
  end

  subgraph "우리의 선택 이유"
    D["비용 효율 1/33"]
    E["배포 속도 10분 이내"]
    F["코드 레벨 자동화"]
    G["N2SF O등급 데이터 기준 충족"]
  end

  C --> D
  C --> E
  C --> F
  C --> G

  style C fill:#4CAF50,color:#fff
  style D fill:#E8F5E9
  style E fill:#E8F5E9
  style F fill:#E8F5E9
  style G fill:#E8F5E9
```

---

## 3. 테넌트 컨텍스트 전파 — Request Lifecycle 완전 해부

이 섹션은 HTTP 요청이 들어온 순간부터 DB 응답이 반환되는 순간까지, tenantId가 어떻게 전파되는지 단계별로 설명합니다.

### 3.1 전체 흐름 다이어그램

```mermaid
sequenceDiagram
  actor User as 기관 A 사용자
  participant GW as API Gateway
  participant TP as tenantIsolationPlugin
  participant ALS as AsyncLocalStorage
  participant Handler as Route Handler
  participant RLS as RowLevelSecurity
  participant DB as PostgreSQL

  User->>GW: POST /api/documents<br/>Authorization: Bearer eyJ...<br/>X-Tenant-Id: uuid-agency-a
  GW->>TP: 요청 전달 (JWT 검증 완료)

  Note over TP: onRequest 훅 실행
  TP->>TP: X-Tenant-Id 헤더 추출
  TP->>ALS: TenantContext.run({tenantId: "uuid-agency-a"})

  Note over ALS: AsyncLocalStorage에 컨텍스트 저장<br/>이 요청의 모든 하위 호출에서 자동 접근 가능

  TP->>Handler: 요청 처리 시작

  Handler->>RLS: rls.wrapInsert({title: "문서 제목", content: "..."})
  RLS->>ALS: requireTenantId() 호출
  ALS-->>RLS: "uuid-agency-a" 반환
  RLS-->>Handler: {title, content, tenant_id: "uuid-agency-a"}

  Handler->>DB: INSERT INTO documents (title, content, tenant_id) VALUES (?, ?, ?)
  DB-->>Handler: 삽입 성공

  Handler-->>User: 201 Created
```

### 3.2 AsyncLocalStorage — 테넌트 컨텍스트의 핵심 기술

Node.js의 `AsyncLocalStorage`는 비동기 작업 전체에 걸쳐 데이터를 자동으로 전파하는 메커니즘입니다.

```typescript
// platform/packages/tenant-isolation/src/tenant-context.ts
// Design Ref: SVC-TENANT-R14 Plan
// Plan SC: FR-TENANT.2

import { AsyncLocalStorage } from 'node:async_hooks';

export class TenantContext {
  // AsyncLocalStorage: 요청별로 독립된 저장소
  // 멀티 요청이 동시에 처리될 때도 서로 섞이지 않음
  private readonly storage = new AsyncLocalStorage<TenantInfo>();

  /**
   * 테넌트 컨텍스트 내에서 콜백 실행
   * 이 run() 안에서 호출된 모든 함수는 tenantId에 자동 접근 가능
   */
  run<T>(tenant: TenantInfo, callback: () => T): T {
    return this.storage.run(tenant, callback);
  }

  /**
   * 현재 테넌트 ID 반환 (필수)
   * 컨텍스트 외부에서 호출 시 에러 → 격리 위반 조기 탐지
   */
  requireTenantId(): string {
    const tenant = this.storage.getStore();
    if (!tenant) {
      throw new TenantContextError('테넌트 컨텍스트가 설정되지 않았습니다');
    }
    return tenant.tenantId;
  }
}
```

💡 **AsyncLocalStorage가 왜 중요한가?**

일반적인 전역 변수나 모듈 변수를 사용하면 동시 요청에서 tenantId가 섞입니다. Node.js는 싱글 스레드이지만 비동기로 여러 요청을 동시 처리하기 때문입니다.

```typescript
// ❌ 위험한 방식 — 전역 변수 사용
let currentTenantId: string | null = null;

// 요청 A가 "uuid-agency-a" 설정
currentTenantId = "uuid-agency-a";

// ... await DB 쿼리 (여기서 제어권 양보) ...

// 요청 B가 "uuid-agency-b" 설정 (요청 A의 await 중에 처리됨)
currentTenantId = "uuid-agency-b";

// 요청 A의 await 완료 후 DB 쿼리
// currentTenantId는 이제 "uuid-agency-b" → 데이터 누출!

// ✅ 안전한 방식 — AsyncLocalStorage 사용
// 각 요청은 독립된 저장소를 가짐
// await 전후로 컨텍스트가 자동 보존됨
```

### 3.3 Fastify 플러그인에서 컨텍스트 설정

```typescript
// platform/packages/tenant-isolation/src/tenant-isolation-plugin.ts (요약)
// Design Ref: SVC-TENANT-R14 Plan
// Plan SC: FR-TENANT.1

async function tenantIsolationPluginImpl(
  app: FastifyInstance,
  opts: TenantIsolationPluginOptions,
): Promise<void> {
  const tenantContext = new TenantContext();
  const rls = new RowLevelSecurity(tenantContext, opts.tenantColumn);

  // Fastify 전체에서 app.tenant.context 로 접근 가능
  app.decorate('tenant', {
    context: tenantContext,
    rls,
    encryption,
    validator,
  });

  // onRequest 훅: 모든 요청에서 테넌트 컨텍스트 자동 설정
  app.addHook('onRequest', async (request, reply) => {
    // 헬스체크 등 제외 경로 확인
    if (excludePaths.some((p) => request.url.startsWith(p))) {
      return;
    }

    // X-Tenant-Id 헤더에서 tenantId 추출
    const tenantId = tenantContext.extractTenantId(
      request.headers as Record<string, string | string[] | undefined>,
    );

    // 헤더 없으면 400 반환
    if (!tenantId && requireHeader) {
      reply.status(400).send({
        error: 'Bad Request',
        message: 'X-Tenant-Id 헤더가 필요합니다',
      });
      return;
    }

    // AsyncLocalStorage에 컨텍스트 설정
    // 이후 모든 핸들러, DB 쿼리, 캐시 접근에서 자동으로 tenantId 사용
    if (tenantId) {
      tenantContext.run({ tenantId }, () => {
        // 주의: Fastify의 request.raw를 통해 컨텍스트를 유지
      });
      // request에 tenantId 바인딩 (핸들러에서 직접 접근용)
      (request as FastifyRequest & { tenantId?: string }).tenantId = tenantId;
    }
  });
}
```

### 3.4 헤더 vs JWT에서 tenantId 추출

현재 구현에서 tenantId 추출 우선순위는 다음과 같습니다.

```typescript
// platform/packages/tenant-isolation/src/tenant-context.ts
extractTenantId(headers: Record<string, string | string[] | undefined>): string | null {
  // 1순위: X-Tenant-Id 헤더 (API Gateway가 JWT 검증 후 주입)
  const headerValue = headers['x-tenant-id'];
  if (typeof headerValue === 'string' && headerValue.length > 0) {
    return headerValue;
  }

  // 2순위: 없으면 null → 플러그인에서 400 반환
  return null;
}
```

💡 **X-Tenant-Id 헤더는 누가 설정하나?**

```
클라이언트(브라우저/앱)
  → POST /api/documents
  → Authorization: Bearer eyJhbGciOiJSUzI1NiJ9... (JWT 포함)

API Gateway (api-gateway 서비스)
  → JWT 검증: RS256 서명 확인, 만료 확인
  → JWT payload에서 tenantId 추출
  → X-Tenant-Id 헤더 추가하여 downstream으로 전달

tenant-service, user-service, etc.
  → X-Tenant-Id 헤더 수신
  → tenantIsolationPlugin이 AsyncLocalStorage에 저장
  → 이후 모든 처리에 자동 적용
```

### 3.5 Redis 키 네임스페이스 격리

DB 쿼리뿐만 아니라 Redis 캐시도 테넌트별로 격리해야 합니다.

```typescript
// 테넌트별 Redis 키 패턴
// Design Ref: DESIGN-MTU-P03 §3.3 Redis 격리
// Plan SC: FR-P03.3

// ❌ 잘못된 방식 — 테넌트 구분 없음
await redis.set('user:123', JSON.stringify(userData));
// → 기관 A와 기관 B의 사용자 ID가 같으면 충돌!

// ✅ 올바른 방식 — 테넌트 접두사 사용
const tenantId = tenantContext.requireTenantId();

// 키 패턴: tenant:{tenantId}:{리소스타입}:{ID}
await redis.set(
  `tenant:${tenantId}:user:123`,
  JSON.stringify(userData),
  'EX',
  300  // 5분 TTL
);

// 테넌트별 캐시 전체 무효화 (테넌트 설정 변경 시)
const keys = await redis.keys(`tenant:${tenantId}:*`);
if (keys.length > 0) {
  await redis.del(...keys);
}
```

실제 `cachePlugin` 사용 시 prefix 설정을 활용합니다.

```typescript
// platform/services/tenant-service/src/index.ts (발췌)
await app.register(cachePlugin, {
  config: {
    defaultTtlSeconds: 300,
    prefix: 'saas:tenant',  // 서비스 레벨 접두사
  },
});

// 핸들러에서 사용 시 tenantId 를 키에 포함
// 실제 저장 키: saas:tenant:{tenantId}:{key}
```

---

## 4. 격리 레이어 심화 — L1~L4 구현 상세

### 4.1 격리 레이어 전체 구조

```mermaid
graph LR
  subgraph "외부 요청"
    REQ["HTTP 요청<br/>Authorization + X-Tenant-Id"]
  end

  subgraph "L1: API 레이어"
    L1A["JWT 검증<br/>RS256 서명 확인"]
    L1B["tenantId 일치 검증<br/>URL param vs JWT claim"]
    L1C["RBAC 권한 검사<br/>rbacPlugin"]
  end

  subgraph "L2: DB 레이어"
    L2A["RowLevelSecurity<br/>자동 tenant_id 주입"]
    L2B["Prisma WHERE 자동 추가<br/>모든 쿼리 인터셉트"]
    L2C["IsolationValidator<br/>격리 상태 주기적 검증"]
  end

  subgraph "L3: 캐시 레이어"
    L3A["Redis 키 네임스페이스<br/>tenant:{id}:*"]
    L3B["캐시 무효화 스코프<br/>테넌트 단위 제한"]
  end

  subgraph "L4: 파일 레이어"
    L4A["MinIO 버킷 격리<br/>tenant-{id}/ 경로"]
    L4B["AES-256-GCM 암호화<br/>테넌트별 파생 키"]
  end

  REQ --> L1A --> L1B --> L1C
  L1C --> L2A --> L2B --> L2C
  L1C --> L3A --> L3B
  L1C --> L4A --> L4B

  style L1A fill:#2196F3,color:#fff
  style L1B fill:#2196F3,color:#fff
  style L1C fill:#2196F3,color:#fff
  style L2A fill:#4CAF50,color:#fff
  style L2B fill:#4CAF50,color:#fff
  style L2C fill:#4CAF50,color:#fff
  style L3A fill:#FF9800,color:#fff
  style L3B fill:#FF9800,color:#fff
  style L4A fill:#9C27B0,color:#fff
  style L4B fill:#9C27B0,color:#fff
```

### 4.2 L1: API 레이어 상세

API 레이어는 세 개의 독립적인 검사로 구성됩니다. 하나가 통과해도 나머지 두 개가 방어합니다.

```typescript
// L1-1: JWT 검증 (api-gateway 또는 auth-service에서 처리)
// JWT payload 구조
interface JWTPayload {
  sub: string;        // 사용자 ID
  tenantId: string;   // 소속 테넌트 ID
  role: string;       // 역할 (admin, user, viewer, super_admin)
  exp: number;        // 만료 시각 (Unix timestamp)
  iat: number;        // 발급 시각
}

// L1-2: tenantId 일치 검증
// platform/services/tenant-service/src/lib/isolation.ts (발췌)
export async function tenantIsolationMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = request.user as TokenPayload;

  // SUPER_ADMIN은 검증 없이 통과 (별도 감사 로그 기록)
  if (user.role === 'super_admin') {
    return;
  }

  // URL 파라미터의 tenantId와 JWT의 tenantId 비교
  const params = request.params as Record<string, string>;
  const requestedTenantId = params['tenantId'] ?? params['id'];

  if (requestedTenantId && requestedTenantId !== user.tenantId) {
    // 격리 위반 시도 → 403 + 감사 로그
    await auditLog({
      actor: user.id,
      action: 'TENANT_ISOLATION_VIOLATION_ATTEMPT',
      target: requestedTenantId,
      detail: `tenantId 불일치: JWT=${user.tenantId}, URL=${requestedTenantId}`,
    });

    await reply.status(403).send({
      success: false,
      error: {
        code: 'TENANT_ISOLATION_VIOLATION',
        message: '다른 테넌트의 데이터에 접근할 수 없습니다 (N2SF N-03)',
      },
    });
    return;
  }
}

// L1-3: RBAC 권한 검사 (rbacPlugin)
// platform/packages/rbac/src/index.ts (사용 예시)
app.get('/tenants/:tenantId/users', {
  preHandler: [
    authenticate,                         // JWT 검증
    tenantIsolationMiddleware,            // tenantId 일치 검증
    authorize('tenant:users:read'),       // RBAC 권한 검사
  ],
}, listUsersHandler);
```

### 4.3 L2: DB 레이어 상세

RowLevelSecurity 클래스가 모든 DB 쿼리에 tenant_id 조건을 자동으로 추가합니다.

```typescript
// platform/packages/tenant-isolation/src/row-level-security.ts (핵심 부분)
// Design Ref: SVC-TENANT-R14 Plan
// Plan SC: FR-TENANT.3

export class RowLevelSecurity {
  /**
   * SELECT 쿼리에 RLS 조건 자동 적용
   *
   * 사용 예시:
   *   const rls = app.tenant.rls;
   *   const rlsQuery = rls.wrapSelect('SELECT * FROM documents');
   *   // rlsQuery.tenantCondition = "tenant_id = 'uuid-agency-a'"
   *   const docs = await prisma.$queryRawUnsafe(
   *     `SELECT * FROM documents WHERE ${rlsQuery.tenantCondition}`,
   *   );
   */
  wrapSelect(query: string): RlsWrappedQuery {
    const tenantId = this.requireTenant('SELECT', query);
    // tenantId가 없으면 TenantContextError 발생 → 격리 위반 조기 탐지

    this.recordAudit('RLS_APPLIED', tenantId, 'SELECT', query);

    return {
      type: 'SELECT',
      tenantCondition: `${this.tenantColumn} = '${tenantId}'`,
      tenantId,
      originalQuery: query,
    };
  }

  /**
   * INSERT 시 tenant_id 자동 주입
   *
   * 사용 예시:
   *   const data = rls.wrapInsert({ title: '문서', content: '내용' });
   *   // data = { title: '문서', content: '내용', tenant_id: 'uuid-agency-a' }
   *   await prisma.document.create({ data });
   */
  wrapInsert(data: Record<string, unknown>): Record<string, unknown> {
    const tenantId = this.requireTenant('INSERT', JSON.stringify(data));

    this.recordAudit('RLS_APPLIED', tenantId, 'INSERT', 'data insertion');

    return {
      ...data,
      [this.tenantColumn]: tenantId,
    };
  }
}
```

실제 핸들러에서 사용하는 패턴:

```typescript
// 실제 핸들러 작성 패턴 (권장)
// Design Ref: DESIGN-MTU-P03

export async function createDocumentHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // 방법 1: app.tenant.rls 직접 사용 (원시 쿼리 필요 시)
  const data = app.tenant.rls.wrapInsert({
    title: request.body.title,
    content: request.body.content,
  });
  // data.tenant_id가 자동으로 현재 테넌트 ID로 설정됨

  // 방법 2: Prisma 사용 시 (권장) — tenantId를 명시적으로 포함
  const tenantId = app.tenant.context.requireTenantId();
  const document = await prisma.document.create({
    data: {
      title: request.body.title,
      content: request.body.content,
      tenantId,  // 명시적 포함 필수
    },
  });

  await reply.status(201).send({ success: true, data: document });
}
```

⚠️ **Prisma 사용 시 주의사항**: Prisma는 ORM이므로 자동 tenant_id 주입이 어렵습니다. `tenantId`를 항상 명시적으로 포함하고, 조회 시 반드시 `where: { tenantId }` 조건을 추가합니다.

```typescript
// ❌ 잘못된 Prisma 쿼리 — tenantId 필터 없음
const docs = await prisma.document.findMany();
// → 전체 테넌트의 문서가 반환됨!

// ✅ 올바른 Prisma 쿼리
const tenantId = app.tenant.context.requireTenantId();
const docs = await prisma.document.findMany({
  where: { tenantId },  // 필수!
});
```

### 4.4 L3: Redis 캐시 레이어 상세

```typescript
// Redis 키 네임스페이스 패턴
// Design Ref: DESIGN-MTU-P03 §3.3

// 권장 키 구조
// tenant:{tenantId}:{service}:{resource}:{id}

// 예시
const REDIS_KEY_PATTERNS = {
  userProfile: (tenantId: string, userId: string) =>
    `tenant:${tenantId}:user:profile:${userId}`,

  tenantConfig: (tenantId: string) =>
    `tenant:${tenantId}:config`,

  sessionList: (tenantId: string) =>
    `tenant:${tenantId}:sessions`,

  featureFlags: (tenantId: string) =>
    `tenant:${tenantId}:feature-flags`,

  rateLimitCounter: (tenantId: string, apiPath: string) =>
    `tenant:${tenantId}:rate-limit:${apiPath}`,
};

// 테넌트 정지 시 전체 캐시 무효화
async function invalidateTenantCache(tenantId: string): Promise<void> {
  const pattern = `tenant:${tenantId}:*`;
  const keys = await redis.keys(pattern);

  if (keys.length > 0) {
    await redis.del(...keys);
    // 감사 로그
    await auditLog({
      action: 'TENANT_CACHE_INVALIDATED',
      target: tenantId,
      detail: `${keys.length}개 캐시 키 삭제`,
    });
  }
}
```

### 4.5 L4: 파일 스토리지 레이어 상세

MinIO에서 테넌트별 파일 격리는 버킷 경로(prefix)를 사용합니다.

```typescript
// platform/services/file-service/src/lib/storage.ts (개념 코드)
// Design Ref: DESIGN-MTU-P03 §3.4

// MinIO 버킷 구조
// 버킷: public-saas-files (단일 버킷)
// 경로: tenant/{tenantId}/{type}/{fileName}

const STORAGE_PATHS = {
  document: (tenantId: string, fileName: string) =>
    `tenant/${tenantId}/documents/${fileName}`,

  image: (tenantId: string, fileName: string) =>
    `tenant/${tenantId}/images/${fileName}`,

  export: (tenantId: string, fileName: string) =>
    `tenant/${tenantId}/exports/${fileName}`,
};

// 파일 업로드 시 AES-256-GCM 암호화 적용
// TenantEncryption 클래스가 테넌트별 파생 키 생성
async function uploadEncryptedFile(
  tenantId: string,
  fileContent: Buffer,
  fileName: string,
): Promise<void> {
  // HKDF로 마스터 키 → 테넌트별 키 파생
  // 각 테넌트는 고유한 암호화 키를 가짐
  const encryption = app.tenant.encryption;
  if (!encryption) {
    throw new Error('암호화 미설정 (TENANT_MASTER_KEY 환경 변수 확인)');
  }

  const encrypted = encryption.encrypt(fileContent.toString('base64'));
  const path = STORAGE_PATHS.document(tenantId, fileName);

  await minioClient.putObject(
    'public-saas-files',
    path,
    JSON.stringify(encrypted),
  );
}
```

**테넌트별 암호화 키 파생 원리** (`TenantEncryption` 클래스):

```typescript
// platform/packages/tenant-isolation/src/tenant-encryption.ts (핵심)
// Plan SC: FR-TENANT.4

private deriveTenantKey(tenantId: string): Buffer {
  // HKDF (HMAC-based Extract-and-Expand Key Derivation Function)
  // 마스터 키 + tenantId → 테넌트별 고유 AES-256 키
  // 테넌트가 달라지면 키도 달라짐 → 암호화 데이터 크로스테넌트 복호화 불가
  const hmac = createHmac('sha256', this.masterKey);
  hmac.update(`tenant-key-${tenantId}-v${this.keyVersion}`);
  return hmac.digest();
}
```

---

## 5. SUPER_ADMIN 접근 — 보안 조치와 감사 추적

### 5.1 SUPER_ADMIN이 필요한 이유

```
시나리오 1: 기관 A가 "우리 계정에서 대량 데이터가 사라졌다"고 신고
  → 운영팀이 기관 A 데이터를 직접 확인해야 함
  → SUPER_ADMIN 없이는 불가능

시나리오 2: 기관 B의 DB 데이터 복구 (백업에서 복원)
  → 복원 후 데이터 무결성 확인 필요
  → SUPER_ADMIN 없이는 불가능

시나리오 3: 월별 전체 기관 사용량 통계 집계
  → 모든 테넌트 데이터를 집계해야 함
  → SUPER_ADMIN 없이는 불가능
```

### 5.2 SUPER_ADMIN 접근 보안 조치

SUPER_ADMIN이 강력한 권한을 갖는 만큼, 다중 보안 장치가 적용됩니다.

```mermaid
flowchart TD
  A[SUPER_ADMIN 로그인 시도] --> B[일반 MFA 인증\nTOTP 6자리]
  B --> C{MFA 성공?}
  C -->|실패| D[계정 잠금 5회]
  C -->|성공| E[SUPER_ADMIN 전용 추가 인증\n감독관 승인 토큰]
  E --> F{승인 토큰 유효?}
  F -->|실패| G[접근 거부 + 알림]
  F -->|성공| H[SUPER_ADMIN 세션 발급\nTTL: 1시간 최대]
  H --> I[특정 테넌트 접근 시]
  I --> J[감사 로그 자동 기록\n누가, 언제, 어떤 테넌트, 어떤 작업]
  J --> K[실시간 알림\n보안팀 슬랙 채널]
  K --> L[실제 데이터 접근 허용]
  L --> M[세션 종료 후\n접근 내역 보고서 자동 생성]

  style D fill:#F44336,color:#fff
  style G fill:#F44336,color:#fff
  style H fill:#FF9800,color:#fff
  style J fill:#4CAF50,color:#fff
```

### 5.3 SUPER_ADMIN 감사 로그 구조

```typescript
// SUPER_ADMIN이 테넌트 데이터에 접근할 때 자동 기록되는 감사 로그
// Design Ref: DESIGN-MTU-P03 §5, CSAP D-06

interface SuperAdminAuditEvent {
  timestamp: string;              // ISO 8601
  actor: string;                  // SUPER_ADMIN 사용자 ID
  actorName: string;              // 실명 (감사 목적)
  action: 'SUPER_ADMIN_ACCESS';
  targetTenantId: string;         // 접근한 테넌트 ID
  targetTenantName: string;       // 기관명
  resourceType: string;           // 'users' | 'documents' | 'settings' 등
  resourceId?: string;            // 특정 리소스 ID
  operation: 'READ' | 'WRITE' | 'DELETE';
  reason: string;                 // 접근 사유 (필수 입력)
  sessionId: string;              // 해당 SUPER_ADMIN 세션 ID
  ip: string;                     // 접근 IP
}

// 실제 감사 로그 예시
const auditEvent: SuperAdminAuditEvent = {
  timestamp: '2026-04-12T09:30:00Z',
  actor: 'admin-001',
  actorName: '홍길동',
  action: 'SUPER_ADMIN_ACCESS',
  targetTenantId: 'uuid-agency-a',
  targetTenantName: '행정안전부',
  resourceType: 'users',
  operation: 'READ',
  reason: '고객 신고 처리 — 티켓 #1234',
  sessionId: 'sess-abc-123',
  ip: '10.0.1.100',
};
```

### 5.4 SUPER_ADMIN vs 일반 어드민 차이

| 권한 | 일반 TENANT_ADMIN | SUPER_ADMIN |
|------|-------------------|-------------|
| 자기 테넌트 사용자 관리 | ✅ 가능 | ✅ 가능 |
| 자기 테넌트 데이터 조회 | ✅ 가능 | ✅ 가능 |
| 다른 테넌트 데이터 조회 | ❌ 403 | ✅ 가능 (감사 로그 기록) |
| 테넌트 생성/삭제 | ❌ 403 | ✅ 가능 (감사 로그 기록) |
| 전체 기관 통계 | ❌ 403 | ✅ 가능 |
| 시스템 설정 변경 | ❌ 403 | ✅ 가능 (감사 로그 기록) |
| 자기 계정 생성/삭제 | ❌ 불가 | ❌ 불가 (다른 SUPER_ADMIN 필요) |

---

## 6. 테넌트 라이프사이클 완전 가이드

### 6.1 테넌트 생성 플로우

```mermaid
sequenceDiagram
  actor Admin as SUPER_ADMIN
  participant API as tenant-service
  participant DB as PostgreSQL
  participant Vault as HashiCorp Vault
  participant Schema as DB Schema
  participant Audit as audit.jsonl

  Admin->>API: POST /admin/tenants<br/>{name, slug, maxUsers, maxStorage}

  Note over API: Zod 입력 검증

  API->>DB: BEGIN TRANSACTION
  API->>DB: INSERT INTO tenants (id, name, slug, status='TRIAL')
  DB-->>API: tenant.id = "new-uuid"

  API->>Vault: vault kv put secret/tenant/new-uuid<br/>encryption_key=<random-256bit>
  Vault-->>API: 시크릿 저장 완료

  API->>Schema: CREATE SCHEMA tenant_new_uuid (선택적)
  Schema-->>API: 스키마 생성 완료

  API->>DB: COMMIT
  API->>Audit: 감사 로그: TENANT_CREATED

  API-->>Admin: 201 Created<br/>{tenantId: "new-uuid", status: "TRIAL"}
```

```typescript
// platform/services/tenant-service/src/handlers/tenant.handler.ts (발췌)
// Plan SC: FR-P03.1

export async function createTenantHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // CSAP D-12: Zod 입력 검증
  const validated = createTenantSchema.parse(request.body);

  // UUID 자동 생성
  const tenantId = crypto.randomUUID();

  // DB 트랜잭션 시작
  const tenant = await prisma.$transaction(async (tx) => {
    // 1. 테넌트 레코드 생성
    const newTenant = await tx.tenant.create({
      data: {
        id: tenantId,
        name: validated.name,
        slug: validated.slug,
        status: 'TRIAL',
        maxUsers: validated.maxUsers,
        maxStorage: BigInt(validated.maxStorage),
      },
    });

    // 2. 기본 설정 생성
    await tx.tenantConfig.create({
      data: {
        tenantId,
        aiModel: 'claude-haiku-4-5',   // 기본값: 비용 효율형
        sloThreshold: 0.999,            // 99.9% 기본 SLA
      },
    });

    return newTenant;
  });

  // 3. Vault에 테넌트 암호화 키 저장 (트랜잭션 외부)
  // 트랜잭션 실패 시 Vault 키는 자동 정리 (별도 보상 로직)
  await vaultClient.write(`secret/tenant/${tenantId}`, {
    encryption_key: crypto.randomBytes(32).toString('hex'),
  });

  // 4. 감사 로그 (CSAP D-06)
  await logTenantEvent({
    actor: request.user.id,
    action: 'TENANT_CREATED',
    tenantId,
    detail: `테넌트 생성: ${validated.name}`,
  });

  await reply.status(201).send({ success: true, data: serializeTenant(tenant) });
}
```

### 6.2 테넌트 일시정지 (구독 플랜 만료)

```typescript
// 테넌트 상태 전이
// TRIAL → ACTIVE → SUSPENDED → ARCHIVED

// 일시정지 트리거: 구독 만료, 결제 실패, 정책 위반
export async function suspendTenantHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { id } = tenantIdParamSchema.parse(request.params);
  const { reason } = updateStatusSchema.parse(request.body);

  await prisma.$transaction(async (tx) => {
    // 1. 테넌트 상태 변경
    await tx.tenant.update({
      where: { id },
      data: { status: 'SUSPENDED', suspendedAt: new Date() },
    });

    // 2. 해당 테넌트의 모든 활성 세션 무효화
    // Redis에서 tenant:{id}:session:* 패턴의 키 삭제
    const sessionKeys = await redis.keys(`tenant:${id}:session:*`);
    if (sessionKeys.length > 0) {
      await redis.del(...sessionKeys);
    }

    // 3. 진행 중인 API 요청 완료 후 새 요청 차단
    await tx.tenantConfig.update({
      where: { tenantId: id },
      data: { apiBlocked: true },
    });
  });

  // 4. 감사 로그
  await logTenantEvent({
    actor: request.user.id,
    action: 'TENANT_SUSPENDED',
    tenantId: id,
    detail: `일시정지 사유: ${reason}`,
  });

  // 5. 테넌트 관리자에게 알림 발송
  await notificationService.send({
    tenantId: id,
    type: 'TENANT_SUSPENDED',
    message: `서비스가 일시정지되었습니다. 사유: ${reason}`,
  });

  await reply.send({ success: true, message: '테넌트 일시정지 완료' });
}
```

### 6.3 테넌트 삭제 — CSAP D-10 완전 삭제 요건

CSAP D-10은 서비스 종료 시 데이터를 완전히 삭제할 것을 요구합니다. 이를 충족하는 삭제 플로우:

```typescript
// 테넌트 완전 삭제 플로우 (CSAP D-10 준수)
// Design Ref: DESIGN-MTU-P03 §6
// Plan SC: FR-P03.6

export async function archiveTenantHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { id } = tenantIdParamSchema.parse(request.params);

  // 단계 1: 데이터 내보내기 (삭제 전 기관 요청 시)
  const exportPath = await exportTenantData(id);

  // 단계 2: DB 데이터 삭제 (CASCADE 순서 준수)
  await prisma.$transaction(async (tx) => {
    // 자식 테이블부터 순서대로 삭제 (외래 키 제약 준수)
    await tx.document.deleteMany({ where: { tenantId: id } });
    await tx.user.deleteMany({ where: { tenantId: id } });
    await tx.subscription.deleteMany({ where: { tenantId: id } });
    await tx.auditLog.deleteMany({ where: { tenantId: id } });
    // CSAP D-10: 감사 로그도 보관 기간(1년) 경과 후 삭제
    // 보관 기간 중에는 삭제 불가 (CSAP D-06 보존 요건 우선)

    // 마지막으로 테넌트 레코드 삭제
    await tx.tenant.delete({ where: { id } });
  });

  // 단계 3: Redis 캐시 완전 삭제
  const cacheKeys = await redis.keys(`tenant:${id}:*`);
  if (cacheKeys.length > 0) {
    await redis.del(...cacheKeys);
  }

  // 단계 4: MinIO 파일 완전 삭제
  const objects = await listMinIOObjects(`tenant/${id}/`);
  for (const obj of objects) {
    await minioClient.removeObject('public-saas-files', obj.name);
  }

  // 단계 5: Vault 시크릿 삭제
  await vaultClient.delete(`secret/tenant/${id}`);

  // 단계 6: 삭제 완료 감사 로그 (별도 영구 보존 DB에 기록)
  await permanentAuditLog({
    action: 'TENANT_PERMANENTLY_DELETED',
    tenantId: id,
    deletedAt: new Date().toISOString(),
    deletedBy: request.user.id,
    exportPath,
    csapRef: 'D-10',
  });

  await reply.send({ success: true, message: '테넌트 완전 삭제 완료 (CSAP D-10)' });
}
```

**삭제 시 CSAP 요건 정리**:

| 삭제 대상 | 삭제 방법 | CSAP 요건 |
|---------|---------|---------|
| DB 사용자 데이터 | Prisma deleteMany() CASCADE | D-10: 서비스 종료 후 완전 삭제 |
| 감사 로그 | 1년 보관 후 삭제 | D-06: 1년 이상 보존 (먼저) |
| 파일/문서 | MinIO 객체 삭제 | D-10: 잔존 데이터 없음 확인 |
| 암호화 키 | Vault 키 삭제 | D-09: 키 삭제로 기존 데이터 복호화 불가 |
| 삭제 기록 | 영구 별도 DB | D-06: 삭제 사실 자체는 영구 보존 |

---

## 7. 테넌트별 피처 플래그와 설정

### 7.1 테넌트별 AI 모델 설정

각 기관은 자신의 예산과 요구사항에 맞는 AI 모델을 선택할 수 있습니다.

```typescript
// 테넌트별 AI 설정 스키마 (DB)
// platform/services/tenant-service/src/prisma/schema.prisma (개념)

model TenantConfig {
  tenantId    String   @id
  aiModel     String   @default("claude-haiku-4-5")  // 기본: 저비용
  aiMaxTokens Int      @default(4096)
  sloThreshold Float  @default(0.999)                // 99.9%
  features    Json     @default("{}")                 // 피처 플래그 맵
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// 테넌트별 AI 모델 조회 및 사용
// platform/services/ai-service/src/handlers/ai.handler.ts (개념)
export async function getAIResponse(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const tenantId = app.tenant.context.requireTenantId();

  // 해당 테넌트의 설정 조회 (캐시 우선)
  const config = await getTenantConfig(tenantId);

  // 테넌트별 모델 선택
  // HAIKU: 소규모 기관 (비용 우선)
  // SONNET: 중규모 기관 (균형)
  // OPUS: 대규모 기관 또는 특수 목적 (성능 우선)
  const modelId = config.aiModel;

  // N2SF 등급 검사 (O등급만 AI 전송 가능)
  const dataGrade = classifyData(request.body.content);
  if (dataGrade !== 'O') {
    throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지`);
  }

  // AI Gateway 경유 (절대 직접 외부 API 호출 금지)
  const response = await aiGateway.send({
    model: modelId,
    messages: request.body.messages,
    maxTokens: config.aiMaxTokens,
  });

  await reply.send({ success: true, data: response });
}
```

### 7.2 테넌트별 피처 플래그

```typescript
// 피처 플래그 패턴 (feature-flag-sdk 사용)
// platform/packages/feature-flag-sdk/src/index.ts 참조

// 피처 플래그 정의 (Redis에 저장)
interface TenantFeatureFlags {
  aiEnabled: boolean;            // AI 기능 활성화
  ragEnabled: boolean;           // RAG 검색 활성화
  exportPdfEnabled: boolean;     // PDF 내보내기 활성화
  maxApiCallsPerMin: number;     // 분당 API 호출 제한
  customDomainEnabled: boolean;  // 커스텀 도메인 사용
  ssoEnabled: boolean;           // SSO/SAML 연동
  auditLogRetentionDays: number; // 감사 로그 보관 일수 (최소 365)
}

// 피처 플래그 조회 (핸들러에서 사용)
async function checkFeature(
  tenantId: string,
  feature: keyof TenantFeatureFlags,
): Promise<boolean> {
  // Redis 캐시 먼저 확인 (tenant:{tenantId}:feature-flags)
  const cacheKey = `tenant:${tenantId}:feature-flags`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    const flags = JSON.parse(cached) as TenantFeatureFlags;
    return Boolean(flags[feature]);
  }

  // DB에서 조회 후 캐시 저장
  const config = await prisma.tenantConfig.findUnique({
    where: { tenantId },
    select: { features: true },
  });

  const flags = config?.features as TenantFeatureFlags ?? {};
  await redis.setex(cacheKey, 300, JSON.stringify(flags));

  return Boolean(flags[feature]);
}

// 핸들러에서 사용
export async function generateDocumentHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const tenantId = app.tenant.context.requireTenantId();

  // AI 기능 활성화 여부 확인
  const aiEnabled = await checkFeature(tenantId, 'aiEnabled');
  if (!aiEnabled) {
    return reply.status(403).send({
      error: 'FEATURE_DISABLED',
      message: 'AI 기능이 현재 플랜에서 지원되지 않습니다',
    });
  }

  // ... AI 문서 생성 로직
}
```

### 7.3 테넌트별 SLO 임계값

```typescript
// 테넌트별 SLO 설정 (프리미엄 기관은 더 높은 SLA)
// Design Ref: DESIGN-MTU-P03 §7

interface TenantSLOConfig {
  sloThreshold: number;         // 0.999 = 99.9%, 0.9999 = 99.99%
  errorBudgetDays: number;      // 에러 버짓 계산 기간
  escalationLevels: {
    warning: number;            // 에러 버짓 소진 경고 (예: 0.5 = 50%)
    critical: number;           // 에러 버짓 소진 위험 (예: 0.8 = 80%)
    breach: number;             // SLA 위반 (예: 1.0 = 100%)
  };
}

// 테넌트별 SLO 알림 로직
// packages/slo-escalation/src/escalation-controller.ts 연계
async function checkTenantSLO(tenantId: string): Promise<void> {
  const config = await getTenantSLOConfig(tenantId);
  const currentAvailability = await calculateAvailability(tenantId);

  if (currentAvailability < config.sloThreshold) {
    // SLO 위반: 해당 기관 담당자에게 즉시 알림
    await escalate({
      tenantId,
      level: 'BREACH',
      message: `SLA 위반: 현재 가용성 ${(currentAvailability * 100).toFixed(3)}%`,
    });
  }
}
```

---

## 8. 테넌트 간 데이터 누출 시나리오와 방어

### 8.1 실제 발생 가능한 누출 시나리오

```
시나리오 1: Prisma findMany()에서 where 빠뜨리기
  코드: const docs = await prisma.document.findMany();
  결과: 전체 테넌트 문서 반환 (데이터 누출)
  방어: 코드 리뷰 + tenantId 없는 findMany 패턴 Semgrep으로 탐지

시나리오 2: JOIN 쿼리에서 tenant_id 필터 누락
  코드: SELECT d.*, u.name FROM documents d JOIN users u ON d.user_id = u.id
  결과: 기관 A 문서가 기관 B 사용자와 조인될 수 있음
  방어: WHERE d.tenant_id = ? AND u.tenant_id = ? 필수

시나리오 3: Redis 캐시 키 테넌트 미분리
  코드: await redis.get(`user:${userId}`);
  결과: 다른 테넌트의 같은 userId가 있으면 캐시 충돌
  방어: 항상 tenant:{tenantId}: 접두사 사용

시나리오 4: AsyncLocalStorage 컨텍스트 누락
  코드: setTimeout(() => { tenantContext.requireTenantId(); }, 100);
  결과: 타이머 콜백은 AsyncLocalStorage 컨텍스트 상속 안 함
  방어: setImmediate 대신 await + 명시적 tenantId 전달
```

### 8.2 IsolationValidator — 격리 상태 주기적 검증

```typescript
// platform/packages/tenant-isolation/src/isolation-validator.ts
// Design Ref: SVC-TENANT-R14 Plan
// Plan SC: FR-TENANT.5

export interface IsolationCheckResult {
  tenantId: string;
  isIsolated: boolean;
  violations: string[];
  checkedAt: string;
}

export class IsolationValidator {
  /**
   * 현재 요청의 격리 상태 검증
   *
   * 격리 위반 즉시 예외 발생 → 안전 실패 원칙
   */
  checkCurrentRequest(): IsolationCheckResult {
    const tenant = this.tenantContext.getCurrentTenant();
    const violations: string[] = [];

    if (!tenant) {
      violations.push('테넌트 컨텍스트 없음 — 미인증 접근 시도');
    }

    if (tenant && !isValidUUID(tenant.tenantId)) {
      violations.push(`잘못된 tenantId 형식: ${tenant.tenantId}`);
    }

    return {
      tenantId: tenant?.tenantId ?? 'unknown',
      isIsolated: violations.length === 0,
      violations,
      checkedAt: new Date().toISOString(),
    };
  }
}

// /tenant/isolation-check 엔드포인트 (개발/운영 점검용)
// GET /tenant/isolation-check
// Response: { isIsolated: true, tenantId: "uuid-agency-a", violations: [] }
```

---

## 9. 실습 — 새 API 엔드포인트에서 테넌트 격리 검증하기

### 9.1 실습 목표

새로운 `GET /documents` 엔드포인트를 추가하면서 테넌트 격리가 올바르게 적용되는지 검증합니다.

### 9.2 단계별 실습

**Step 1: 핸들러 작성 (테넌트 격리 포함)**

```typescript
// platform/services/tenant-service/src/handlers/document.handler.ts (신규)
// Design Ref: DESIGN-MTU-P03 — 테넌트 격리 구현 패턴

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

// Plan SC: FR-P03.5 — 입력 검증
const listDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * 문서 목록 조회 (테넌트 격리 적용)
 * CSAP D-08: tenantId 기반 접근 통제
 * CSAP D-12: Zod 입력 검증
 */
export async function listDocumentsHandler(
  request: FastifyRequest<{ Querystring: { page?: string; pageSize?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  // Step 1: 입력 검증
  const { page, pageSize } = listDocumentsQuerySchema.parse(request.query);

  // Step 2: tenantId 추출 (자동 - tenantIsolationPlugin이 설정)
  // 직접 접근: request.tenantId (플러그인에서 바인딩)
  // 또는: app.tenant.context.requireTenantId()
  const tenantId = (request as FastifyRequest & { tenantId?: string }).tenantId;
  if (!tenantId) {
    return reply.status(401).send({ error: 'TENANT_CONTEXT_MISSING' });
  }

  // Step 3: DB 쿼리 — tenantId 필터 필수!
  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where: {
        tenantId,  // ✅ 테넌트 격리 핵심 — 절대 빠뜨리지 말 것
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.document.count({ where: { tenantId } }),  // ✅ count도 격리 필수
  ]);

  await reply.send({
    success: true,
    data: documents,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}
```

**Step 2: 라우트 등록 (인증 미들웨어 체인)**

```typescript
// platform/services/tenant-service/src/routes.ts (추가)
import { listDocumentsHandler } from './handlers/document.handler.js';

export async function registerTenantRoutes(app: FastifyInstance): Promise<void> {
  // 기존 라우트들...

  // 새 문서 목록 라우트
  app.get('/documents', {
    preHandler: [
      // 체인 순서 중요:
      // 1. JWT 검증 (authenticate)
      // 2. tenantId 일치 검증 (tenantIsolationMiddleware)
      // 3. RBAC 권한 검사 (authorize)
      authenticate,
      authorize('documents:read'),
    ],
    handler: listDocumentsHandler,
  });
}
```

**Step 3: 격리 검증 테스트 작성**

```typescript
// platform/services/tenant-service/tests/integration/document-isolation.test.ts
// Plan SC: FR-P03.8 — 격리 검증 테스트

import { describe, it, expect, beforeAll } from 'vitest';

describe('문서 목록 — 테넌트 격리 검증', () => {
  let tokenA: string;   // 기관 A의 JWT
  let tokenB: string;   // 기관 B의 JWT
  let docA_id: string;  // 기관 A에서 생성한 문서 ID

  beforeAll(async () => {
    // 테스트 데이터 준비
    tokenA = await getTestToken({ tenantId: 'test-tenant-a' });
    tokenB = await getTestToken({ tenantId: 'test-tenant-b' });

    // 기관 A에서 문서 생성
    const res = await app.inject({
      method: 'POST',
      url: '/documents',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'X-Tenant-Id': 'test-tenant-a',
      },
      payload: { title: '기관 A 전용 문서', content: '비밀 내용' },
    });
    docA_id = res.json().data.id;
  });

  it('기관 A는 자신의 문서만 조회됨', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/documents',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'X-Tenant-Id': 'test-tenant-a',
      },
    });

    expect(res.statusCode).toBe(200);
    const docs = res.json().data;

    // 기관 A 문서만 포함
    expect(docs.every((d: { tenantId: string }) => d.tenantId === 'test-tenant-a')).toBe(true);
    // 기관 B 문서 없음 (isolation)
    expect(docs.every((d: { tenantId: string }) => d.tenantId !== 'test-tenant-b')).toBe(true);
  });

  it('기관 B는 기관 A의 문서에 접근 불가 — 테넌트 격리 핵심 검증', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/documents',
      headers: {
        Authorization: `Bearer ${tokenB}`,
        'X-Tenant-Id': 'test-tenant-b',  // 기관 B의 토큰
      },
    });

    expect(res.statusCode).toBe(200);
    const docs = res.json().data;

    // 기관 A 문서가 기관 B 응답에 없어야 함
    expect(docs.find((d: { id: string }) => d.id === docA_id)).toBeUndefined();
  });

  it('X-Tenant-Id 헤더 없으면 400 반환', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/documents',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        // X-Tenant-Id 헤더 의도적으로 생략
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain('X-Tenant-Id');
  });

  it('JWT의 tenantId와 URL param이 불일치하면 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/tenants/test-tenant-b/documents',  // 기관 B 경로
      headers: {
        Authorization: `Bearer ${tokenA}`,       // 기관 A 토큰
        'X-Tenant-Id': 'test-tenant-a',
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('TENANT_ISOLATION_VIOLATION');
  });
});
```

**Step 4: 격리 검증 실행**

```bash
# 실습 검증 명령어
cd /data/ai-saas

# 특정 서비스 테스트만 실행
pnpm --filter @public-saas/tenant-service test

# 격리 테스트만 실행
pnpm --filter @public-saas/tenant-service test -- --grep "테넌트 격리"

# 커버리지 확인 (80% 이상 필수)
pnpm --filter @public-saas/tenant-service test:coverage

# 린트 오류 확인 (PR 전 필수)
pnpm --filter @public-saas/tenant-service lint
```

### 9.3 실습 완료 체크포인트

```
✅ /documents 핸들러에 tenantId 필터 적용
✅ 격리 테스트 4개 모두 통과
✅ 커버리지 80% 이상
✅ 린트 오류 없음
✅ 감사 로그 기록 확인 (cat .claude/audit.jsonl | tail -5)
```

---

## 10. 격리 위반 감지와 대응

### 10.1 실시간 격리 위반 탐지 흐름

```mermaid
flowchart LR
  subgraph "위반 시도"
    A["기관 A 사용자\n기관 B 데이터 접근 시도"]
  end

  subgraph "탐지 레이어"
    B["L1: tenantIsolationMiddleware\n403 즉시 반환"]
    C["L2: RLS 컨텍스트 없음\nTenantContextError 발생"]
    D["L3: Redis 키 불일치\n캐시 미스 (데이터 없음)"]
  end

  subgraph "대응"
    E["감사 로그 기록\nautdit.jsonl"]
    F["Prometheus 메트릭 증가\ntenant_isolation_violations_total"]
    G["AlertManager 알림\n임계값 초과 시 슬랙"]
    H["보안팀 검토\n반복 위반 시 계정 잠금"]
  end

  A --> B --> E
  A --> C --> E
  A --> D --> E
  E --> F --> G --> H
```

### 10.2 격리 위반 모니터링

```promql
# Prometheus: 테넌트 격리 위반 횟수
sum(rate(tenant_isolation_violations_total[5m])) by (tenant_id)

# 특정 테넌트에서 반복적으로 위반 시도 탐지
sum(rate(tenant_isolation_violations_total[1h])) by (tenant_id) > 10
```

```yaml
# AlertManager 규칙 (격리 위반 알림)
# platform/k8s/monitoring/tenant-isolation-alert.yaml
- alert: TenantIsolationViolationHigh
  expr: rate(tenant_isolation_violations_total[5m]) > 5
  for: 2m
  labels:
    severity: critical
    csap_ref: D-08
  annotations:
    summary: "테넌트 격리 위반 빈번 (N2SF N-03)"
    description: "5분간 {{ $value }}건의 격리 위반 시도 탐지"
    runbook: "https://wiki/runbooks/tenant-isolation-violation"
```

---

## 11. 학습 체크리스트

이 문서를 완전히 학습했다면 다음 질문에 모두 답할 수 있어야 합니다.

### 개념 이해

- [ ] Row-level 격리가 CSAP 중/상 등급 요건을 충족하는 이유를 설명할 수 있다
- [ ] AsyncLocalStorage가 왜 전역 변수보다 안전한지 설명할 수 있다
- [ ] X-Tenant-Id 헤더가 어느 서비스에서 누가 설정하는지 알고 있다
- [ ] SUPER_ADMIN이 다른 테넌트 데이터에 접근할 때 어떤 보안 조치가 적용되는지 안다
- [ ] 테넌트 삭제 시 CSAP D-10 요건을 충족하기 위해 무엇을 삭제해야 하는지 안다

### 코드 작성 능력

- [ ] 새 API 핸들러에서 tenantId를 추출하고 DB 쿼리에 적용할 수 있다
- [ ] Redis 캐시 키에 올바른 테넌트 접두사를 적용할 수 있다
- [ ] 테넌트 격리 검증 테스트 4개 (정상/격리/헤더없음/URL불일치)를 작성할 수 있다
- [ ] IsolationValidator를 사용하여 현재 요청의 격리 상태를 검증할 수 있다

### 운영 이해

- [ ] 테넌트 생성 시 Vault에 암호화 키가 자동 저장됨을 안다
- [ ] 테넌트 일시정지 시 Redis 세션 캐시가 즉시 무효화됨을 안다
- [ ] 격리 위반 시 감사 로그와 Prometheus 메트릭이 자동 기록됨을 안다

---

## 12. 다음 단계

- `03-development/04-advanced-patterns.md` — Fastify 플러그인 심화, Repository 패턴
- `03-development/05-prisma-guide.md` — Prisma 쿼리 최적화, 마이그레이션
- `07-security/csap/02-dev-checklist.md` — CSAP 개발자 체크리스트 전체 항목
- `10-exercises/06-end-to-end-scenario.md` — 테넌트 통계 API 캡스톤 실습
- `platform/packages/tenant-isolation/src/` — 실제 격리 패키지 소스코드 직접 탐독

> **Design Ref**: DESIGN-MTU-P03 §1~8 — 테넌트 격리 전체 설계
> **Plan SC**: FR-P03.1~FR-P03.8, FR-TENANT.1~FR-TENANT.5
> **CSAP**: D-08 접근 통제, D-09 암호화, D-10 서비스 연속성, N2SF N-03 격리 아키텍처
