# TypeScript 고급 패턴 — 공공기관 SaaS에서 자주 쓰는 패턴

> **문서 ID**: ONBOARD-03-22
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **대상**: 백엔드 개발자, 풀스택 개발자
> **선행 학습**: `03-development/04-advanced-patterns.md`, `03-development/02-service-development.md`
> **소요 시간**: 약 5~7시간 (실습 포함)
> **CSAP**: D-12 (시스템 개발 보안 — 타입 안전성), D-08 (접근 통제 — RBAC 타입)

---

## 목차

1. [우리 프로젝트의 TypeScript 설정](#1-우리-프로젝트의-typescript-설정)
2. [고급 타입 유틸리티](#2-고급-타입-유틸리티)
3. [실제 프로젝트에서 자주 쓰는 패턴](#3-실제-프로젝트에서-자주-쓰는-패턴)
4. [제네릭 고급 활용](#4-제네릭-고급-활용)
5. [타입 안전한 API 설계](#5-타입-안전한-api-설계)
6. [타입 에러 해결 패턴](#6-타입-에러-해결-패턴)
7. [성능 관련 TypeScript 패턴](#7-성능-관련-typescript-패턴)
8. [변경 이력](#8-변경-이력)

---

## 1. 우리 프로젝트의 TypeScript 설정

### 1.1 tsconfig.base.json 분석

이 프로젝트의 루트 `tsconfig.base.json` 파일을 분석합니다. 모든 서비스가 이 파일을 상속(`"extends": "../../../tsconfig.base.json"`)합니다.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  }
}
```

각 설정의 의미와 왜 이렇게 설정했는지 설명합니다.

**`"strict": true`**

`strict` 옵션은 다음 검사를 모두 활성화합니다.

| 하위 옵션 | 의미 | 이 프로젝트에서의 중요성 |
|---------|------|-------------------|
| `strictNullChecks` | null/undefined를 별도 타입으로 처리 | DB 조회 결과가 null일 때 런타임 에러 방지 |
| `strictFunctionTypes` | 함수 매개변수의 반공변성(contravariance) 검사 | 콜백 타입 안전성 |
| `strictPropertyInitialization` | 클래스 필드 초기화 강제 | 미초기화 필드 접근 방지 |
| `noImplicitAny` | 암묵적 any 타입 금지 | 타입 정보 누락 방지 |
| `noImplicitThis` | this의 암묵적 any 금지 | 메서드 바인딩 오류 방지 |

**`"noUnusedLocals": true` + `"noUnusedParameters": true`**

Dead code 정책을 컴파일러 수준에서 강제합니다. 사용하지 않는 변수나 함수 매개변수가 있으면 컴파일 에러가 발생합니다.

```typescript
// ❌ noUnusedLocals 위반 — 컴파일 에러
function processUser(userId: string) {
  const unusedVariable = 'hello'; // 에러: 'unusedVariable' is declared but never read
  return userId;
}

// ❌ noUnusedParameters 위반
function createHandler(request: Request, unusedParam: string) { // 에러
  return request;
}

// ✅ 사용하지 않는 매개변수는 _로 시작
function createHandler(request: Request, _unusedParam: string) { // OK
  return request;
}
```

**`"noUncheckedIndexedAccess": true`**

배열이나 객체 인덱스 접근 결과에 `undefined`를 포함합니다. 이 옵션은 매우 엄격하여 처음에 불편할 수 있지만, 런타임 에러를 방지하는 효과가 큽니다.

```typescript
// noUncheckedIndexedAccess 없이
const arr = ['a', 'b', 'c'];
const first = arr[0]; // 타입: string

// noUncheckedIndexedAccess 있을 때
const arr = ['a', 'b', 'c'];
const first = arr[0]; // 타입: string | undefined

// ✅ 반드시 undefined 확인 필요
if (first !== undefined) {
  console.log(first.toUpperCase()); // 이제 안전
}

// 또는 non-null assertion (확실히 있을 때만 사용)
const definitelyFirst = arr[0]!; // string (undefined 가능성 제거)
```

**`"verbatimModuleSyntax": true`**

타입 전용 import/export에 `type` 키워드를 강제합니다. 번들러가 타입만 가져오는 import를 효율적으로 처리할 수 있게 합니다.

```typescript
// ❌ verbatimModuleSyntax 위반 — 컴파일 에러
import { FastifyRequest, FastifyReply } from 'fastify';

// ✅ 타입은 type 키워드로 가져옴
import type { FastifyRequest, FastifyReply } from 'fastify';

// ✅ 값과 타입을 함께 가져올 때
import fastify, { type FastifyInstance } from 'fastify';
```

### 1.2 서비스별 tsconfig 상속 구조

실제 auth-service의 `tsconfig.json`을 보면 최소한의 설정만 오버라이드합니다.

```json
// platform/services/auth-service/tsconfig.json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2022", "DOM"]  // auth-service는 DOM 타입도 필요 (crypto API)
  },
  "include": ["src"]
}
```

`"lib": ["ES2022", "DOM"]`이 추가된 이유: auth-service는 `crypto.subtle` 같은 Web Crypto API를 사용하기 때문입니다. 서버 환경이지만 Node.js 22가 Web API를 지원하므로 DOM 타입을 포함합니다.

---

## 2. 고급 타입 유틸리티

### 2.1 Discriminated Union으로 상태 표현

Discriminated Union은 **상태를 타입 수준에서 모델링**하는 가장 강력한 패턴입니다. 잘못된 상태가 타입 시스템에 의해 원천 차단됩니다.

실제 사용 케이스: 구독 상태 관리.

```typescript
// platform/services/subscription-service/src/lib/subscription-state.ts
// Design Ref: DESIGN-MTU-P07 §상태 관리
// CSAP D-12: 타입 안전한 상태 전이

// 각 상태에는 해당 상태에서만 존재하는 필드가 있습니다.
type SubscriptionState =
  | {
      status: 'TRIAL';
      trialEndsAt: Date;
      // 결제 정보 없음
    }
  | {
      status: 'ACTIVE';
      currentPeriodStart: Date;
      currentPeriodEnd: Date;
      paymentMethodId: string;
    }
  | {
      status: 'PAST_DUE';
      currentPeriodEnd: Date;
      paymentMethodId: string;
      overdueAmount: number;  // PAST_DUE에만 존재
    }
  | {
      status: 'CANCELED';
      canceledAt: Date;
      cancelReason: string;
    };

// 상태를 체크하면 해당 상태의 필드를 타입 안전하게 접근할 수 있습니다.
function processSubscription(sub: SubscriptionState): string {
  switch (sub.status) {
    case 'TRIAL':
      return `시험 사용 중, 만료: ${sub.trialEndsAt.toISOString()}`;
      // sub.overdueAmount ← 접근하면 컴파일 에러 (TRIAL에는 없음)

    case 'ACTIVE':
      return `활성 구독, 다음 결제: ${sub.currentPeriodEnd.toISOString()}`;

    case 'PAST_DUE':
      return `연체 ${sub.overdueAmount}원, 결제수단: ${sub.paymentMethodId}`;
      // TypeScript가 PAST_DUE에만 overdueAmount가 있음을 알고 있음

    case 'CANCELED':
      return `취소됨 (${sub.cancelReason})`;

    default:
      // exhaustive check: 새 상태를 추가하면 이 줄에서 컴파일 에러
      const _exhaustive: never = sub;
      return _exhaustive;
  }
}
```

**`never`를 이용한 완전성 검사(exhaustive check)**:

새로운 상태를 `SubscriptionState`에 추가하고 `switch` 문에 처리를 추가하지 않으면, 컴파일 에러가 발생합니다. 런타임까지 기다리지 않고 컴파일 타임에 누락을 감지합니다.

### 2.2 Template Literal Type

이벤트 이름이나 API 경로를 타입으로 정의할 때 사용합니다. 오타를 컴파일 타임에 잡을 수 있습니다.

```typescript
// 이벤트 이름 타입 정의
type Entity = 'subscription' | 'tenant' | 'user' | 'payment';
type Action = 'created' | 'updated' | 'deleted' | 'activated';

// Template Literal Type으로 조합
type DomainEvent = `${Entity}.${Action}`;
// 결과: "subscription.created" | "subscription.updated" | ...
//       "tenant.created" | "tenant.updated" | ...
//       "user.created" | ... (총 4 * 4 = 16가지)

// 이벤트 버스 타입 안전성
function publish(event: DomainEvent, payload: unknown): void {
  // 구현
}

publish('subscription.created', { id: '...' }); // OK
publish('subscription.deleted', { id: '...' }); // OK
publish('subscription.removed', { id: '...' }); // 컴파일 에러! 'removed'는 Action에 없음
publish('order.created', { id: '...' });         // 컴파일 에러! 'order'는 Entity에 없음
```

**API 경로 타입 정의**:

```typescript
// Fastify 라우트 경로 타입 안전성
type ApiVersion = 'v1' | 'v2';
type ResourcePath = '/tenants' | '/users' | '/subscriptions';

type ApiEndpoint = `/api/${ApiVersion}${ResourcePath}`;
// 결과: "/api/v1/tenants" | "/api/v1/users" | "/api/v1/subscriptions"
//       "/api/v2/tenants" | ...

function registerRoute(endpoint: ApiEndpoint, handler: Function): void {
  // 구현
}

registerRoute('/api/v1/tenants', handler); // OK
registerRoute('/api/v3/tenants', handler); // 컴파일 에러!
```

### 2.3 Conditional Type

환경이나 조건에 따라 다른 타입을 반환하는 패턴입니다.

```typescript
// CSAP N2SF 데이터 등급에 따른 응답 타입
type DataGrade = 'C' | 'S' | 'O';

// C/S 등급은 마스킹된 타입, O 등급은 원본 타입 반환
type ApiResponse<T, Grade extends DataGrade> =
  Grade extends 'C' | 'S'
    ? MaskedResponse<T>   // 기밀/민감: 마스킹 적용
    : T;                  // 공개: 원본 반환

// 마스킹 타입: 문자열 필드를 마스킹
type MaskedResponse<T> = {
  [K in keyof T]: T[K] extends string ? string | '***' : T[K];
};

// 사용 예시
interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
}

type PublicUserResponse = ApiResponse<UserProfile, 'O'>;
// 결과: UserProfile (원본 그대로)

type ConfidentialUserResponse = ApiResponse<UserProfile, 'C'>;
// 결과: { id: string | '***'; name: string | '***'; email: string | '***'; role: string | '***' }
```

**중첩 조건 타입**:

```typescript
// Array인지 검사하는 조건 타입
type UnwrapArray<T> = T extends Array<infer Item> ? Item : T;

type NumberOrArray = number | string[];
type Unwrapped = UnwrapArray<NumberOrArray>;
// 결과: number | string (Array는 풀림)

// Promise 중첩 해제
type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;
// 이미 TypeScript 내장 타입으로 존재 (참고용)
```

### 2.4 Mapped Type

기존 타입의 각 속성을 변환하는 패턴입니다. DB 모델을 API 응답 형식으로 변환할 때 자주 사용합니다.

```typescript
// Prisma 모델 → API 응답 변환 패턴

// Prisma가 생성한 타입 (가정)
interface PrismaUser {
  id: string;
  email: string;
  passwordHash: string;       // 절대 외부에 노출 금지
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;     // 소프트 삭제
}

// 특정 키를 제외하는 Mapped Type
type Omit<T, K extends keyof T> = {
  [P in keyof T as P extends K ? never : P]: T[P];
};

// 모든 Date를 string으로 변환 (JSON 직렬화 대비)
type SerializeDate<T> = {
  [K in keyof T]: T[K] extends Date
    ? string
    : T[K] extends Date | null
      ? string | null
      : T[K];
};

// 최종 API 응답 타입
type UserApiResponse = SerializeDate<Omit<PrismaUser, 'passwordHash' | 'deletedAt'>>;
// 결과:
// {
//   id: string;
//   email: string;
//   createdAt: string;  // Date → string
//   updatedAt: string;  // Date → string
// }

// 변환 함수
function toUserResponse(user: PrismaUser): UserApiResponse {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
```

### 2.5 Branded Type — ID 혼동 방지

이 프로젝트에는 `tenantId`, `userId`, `planId` 등 다양한 ID가 있습니다. 모두 `string` 타입이라 실수로 혼용할 수 있습니다. Branded Type을 사용하면 컴파일 타임에 혼용을 방지합니다.

```typescript
// platform/packages/id-generator/src/branded-ids.ts
// Plan SC: FR-ID.5 — ID 타입 안전성

// Brand를 만드는 일반 패턴
type Brand<T, B extends string> = T & { readonly __brand: B };

// 구체적인 ID 타입 정의
type TenantId = Brand<string, 'TenantId'>;
type UserId = Brand<string, 'UserId'>;
type PlanId = Brand<string, 'PlanId'>;
type SubscriptionId = Brand<string, 'SubscriptionId'>;

// ID 생성 함수 (타입 강제)
function asTenantId(id: string): TenantId {
  // 여기서 형식 검증 가능
  return id as TenantId;
}

function asUserId(id: string): UserId {
  return id as UserId;
}

// 이제 함수 시그니처에서 혼용을 방지합니다.
async function getSubscriptionsByTenant(tenantId: TenantId): Promise<unknown[]> {
  return [];
}

const tenantId = asTenantId('tenant-abc-123');
const userId = asUserId('user-xyz-456');

getSubscriptionsByTenant(tenantId); // OK
getSubscriptionsByTenant(userId);   // 컴파일 에러!
// Argument of type 'UserId' is not assignable to parameter of type 'TenantId'
// Types of property '__brand' are incompatible.

// 실제 auth-service의 JWT 페이로드에서도 이 패턴 응용 가능:
// verifyToken() 반환 타입의 sub 필드를 UserId로 브랜딩
```

---

## 3. 실제 프로젝트에서 자주 쓰는 패턴

### 3.1 Result 타입 패턴 — 에러 핸들링

JavaScript의 `try/catch`는 에러 타입을 `unknown`으로 처리합니다. Result 타입을 사용하면 에러를 타입 안전하게 처리합니다.

```typescript
// platform/packages/shared/src/result.ts
// CSAP D-12: 에러 핸들링 타입 안전성

type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// 생성 함수
function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// 도메인 에러 타입
type AuthError =
  | { type: 'INVALID_CREDENTIALS'; message: string }
  | { type: 'ACCOUNT_LOCKED'; lockedUntil: Date }
  | { type: 'MFA_REQUIRED'; methods: string[] }
  | { type: 'TOKEN_EXPIRED'; expiredAt: Date };

// 실제 사용 — auth-service 패턴
async function login(
  email: string,
  password: string,
): Promise<Result<{ accessToken: string; refreshToken: string }, AuthError>> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return err({ type: 'INVALID_CREDENTIALS', message: '이메일 또는 비밀번호가 올바르지 않습니다' });
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return err({ type: 'ACCOUNT_LOCKED', lockedUntil: user.lockedUntil });
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return err({ type: 'INVALID_CREDENTIALS', message: '이메일 또는 비밀번호가 올바르지 않습니다' });
  }

  if (user.mfaEnabled) {
    return err({ type: 'MFA_REQUIRED', methods: ['totp'] });
  }

  const accessToken = await signAccessToken({ sub: user.id, tenantId: user.tenantId, role: user.role, permissions: [] });
  const refreshToken = await signRefreshToken(user.id, user.tenantId);

  return ok({ accessToken, refreshToken });
}

// 호출 측에서 타입 안전하게 처리
async function handleLogin(email: string, password: string): Promise<void> {
  const result = await login(email, password);

  if (!result.ok) {
    // result.error의 타입이 AuthError임을 TypeScript가 알고 있음
    switch (result.error.type) {
      case 'INVALID_CREDENTIALS':
        console.log(result.error.message);
        break;
      case 'ACCOUNT_LOCKED':
        console.log(`잠금 해제: ${result.error.lockedUntil.toISOString()}`);
        break;
      case 'MFA_REQUIRED':
        console.log(`MFA 필요: ${result.error.methods.join(', ')}`);
        break;
      case 'TOKEN_EXPIRED':
        console.log(`토큰 만료: ${result.error.expiredAt.toISOString()}`);
        break;
    }
    return;
  }

  // result.value의 타입이 보장됨
  console.log(`로그인 성공, 토큰: ${result.value.accessToken.substring(0, 20)}...`);
}
```

### 3.2 Repository 패턴 타입 (실제 코드 기반)

이 프로젝트의 핸들러 코드 (`subscription.handler.ts` 등)를 보면 Prisma를 핸들러에서 직접 사용합니다. 복잡한 쿼리가 필요한 경우에는 Repository 패턴으로 분리합니다.

```typescript
// 추상 Repository 인터페이스
// CSAP D-12: 의존성 역전 원칙으로 테스트 가능성 확보

interface Repository<T, CreateInput, UpdateInput> {
  findById(id: string): Promise<T | null>;
  findMany(filter: Partial<T>): Promise<T[]>;
  create(data: CreateInput): Promise<T>;
  update(id: string, data: UpdateInput): Promise<T>;
  delete(id: string): Promise<void>;
}

// 구체적인 Prisma Repository 구현
// Prisma가 생성하는 타입을 직접 활용
import type { Subscription, Prisma } from '@prisma/client';

class SubscriptionRepository implements Repository<
  Subscription,
  Prisma.SubscriptionCreateInput,
  Prisma.SubscriptionUpdateInput
> {
  constructor(private readonly prismaClient: PrismaClient) {}

  async findById(id: string): Promise<Subscription | null> {
    return this.prismaClient.subscription.findUnique({
      where: { id },
    });
  }

  async findMany(filter: Partial<Subscription>): Promise<Subscription[]> {
    return this.prismaClient.subscription.findMany({
      where: filter as Prisma.SubscriptionWhereInput,
    });
  }

  async create(data: Prisma.SubscriptionCreateInput): Promise<Subscription> {
    return this.prismaClient.subscription.create({ data });
  }

  async update(id: string, data: Prisma.SubscriptionUpdateInput): Promise<Subscription> {
    return this.prismaClient.subscription.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prismaClient.subscription.delete({ where: { id } });
  }

  // 도메인 특화 쿼리 (인터페이스 확장)
  async findActiveByTenant(tenantId: string): Promise<Subscription[]> {
    return this.prismaClient.subscription.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

### 3.3 Fastify TypeProvider 활용 — 라우트 타입 안전성

`04-advanced-patterns.md`에서 플러그인 패턴을 다뤘습니다. 이 문서에서는 TypeProvider를 이용한 라우트 타입 안전성을 심화합니다.

```typescript
// Fastify + Zod TypeProvider로 완전한 타입 안전성

import fastify from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

const app = fastify().withTypeProvider<ZodTypeProvider>();
app.setSerializerCompiler(serializerCompiler);
app.setValidatorCompiler(validatorCompiler);

// 스키마 정의
const createSubscriptionSchema = {
  body: z.object({
    tenantId: z.string().uuid(),
    planId: z.string().uuid(),
  }),
  response: {
    200: z.object({
      id: z.string(),
      status: z.string(),
      createdAt: z.string(),
    }),
    400: z.object({
      error: z.string(),
    }),
  },
};

// TypeProvider 덕분에 request/reply가 완전히 타입화됩니다.
app.post(
  '/subscriptions',
  { schema: createSubscriptionSchema },
  async (request, reply) => {
    // request.body의 타입이 자동으로 { tenantId: string; planId: string }
    const { tenantId, planId } = request.body;

    // 잘못된 필드 접근 시 컴파일 에러
    // request.body.invalidField ← 컴파일 에러

    const subscription = await prisma.subscription.create({
      data: { tenantId, planId, status: 'ACTIVE' },
    });

    // reply.send의 인자 타입이 200 응답 스키마와 일치해야 함
    return reply.send({
      id: subscription.id,
      status: subscription.status,
      createdAt: subscription.createdAt.toISOString(),
    });
  },
);
```

---

## 4. 제네릭 고급 활용

### 4.1 제네릭 제약 조건 — CSAP 데이터 등급 타입 안전성

제네릭 제약 조건(`extends`)을 사용하면 타입 매개변수를 특정 형태로 제한할 수 있습니다.

```typescript
// N2SF 데이터 등급 타입 시스템
// CSAP: N2SF 데이터 분류 체계 적용

interface DataClassified {
  grade: 'C' | 'S' | 'O'; // 기밀 | 민감 | 공개
}

interface TenantData extends DataClassified {
  tenantId: string;
}

// grade가 'C' | 'S'인 데이터는 외부 전송 불가
// 제네릭 제약으로 이를 타입 수준에서 표현

// 공개 데이터만 AI API로 전송 가능
// T extends { grade: 'O' } 제약으로 O등급 데이터만 허용
async function sendToAIGateway<T extends { grade: 'O' }>(
  data: T,
): Promise<{ result: string }> {
  // 내부 구현에서 추가 마스킹 등 처리
  const response = await fetch(process.env['AI_GATEWAY_URL'] ?? '', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.json() as Promise<{ result: string }>;
}

// 사용 예시
const publicDocument = {
  grade: 'O' as const,
  content: '공개 정책 문서 내용',
  tenantId: 'tenant-123',
};

const confidentialDoc = {
  grade: 'C' as const,
  content: '기밀 예산 정보',
  tenantId: 'tenant-123',
};

await sendToAIGateway(publicDocument);      // OK
await sendToAIGateway(confidentialDoc);     // 컴파일 에러!
// Argument of type '{ grade: "C"; ... }' is not assignable to parameter of type '{ grade: "O" }'
```

### 4.2 제네릭 유틸리티 함수

자주 사용하는 유틸리티 함수를 제네릭으로 만들면 재사용성이 높아집니다.

```typescript
// 페이지네이션 유틸리티 (platform/packages/pagination 기반)

interface PaginationOptions {
  page: number;
  pageSize: number;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 어떤 타입의 배열도 페이지네이션 가능
function paginateArray<T>(
  items: T[],
  options: PaginationOptions,
): PaginatedResult<T> {
  const { page, pageSize } = options;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: items.slice(start, end),
    total: items.length,
    page,
    pageSize,
    totalPages: Math.ceil(items.length / pageSize),
  };
}

// 배열의 특정 키로 그루핑
function groupBy<T, K extends keyof T>(
  items: T[],
  key: K,
): Map<T[K], T[]> {
  const map = new Map<T[K], T[]>();

  for (const item of items) {
    const groupKey = item[key];
    const group = map.get(groupKey) ?? [];
    group.push(item);
    map.set(groupKey, group);
  }

  return map;
}

// 사용 예시
const subscriptions = await prisma.subscription.findMany({ where: { tenantId } });
const byStatus = groupBy(subscriptions, 'status');
// byStatus: Map<string, Subscription[]>
// byStatus.get('ACTIVE') → Subscription[]

// 비동기 작업을 안전하게 실행
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = `타임아웃: ${timeoutMs}ms 초과`,
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs),
  );

  return Promise.race([promise, timeout]);
}

// AI API 호출 타임아웃
const result = await withTimeout(
  sendToAIGateway(publicDocument),
  5000,
  'AI Gateway 응답 타임아웃',
);
```

### 4.3 제네릭 클래스 — Repository`<T>`

```typescript
// 타입 안전한 제네릭 Repository 클래스
// Prisma의 다양한 모델에 동일한 패턴 적용

import type { PrismaClient } from '@prisma/client';

// Prisma 모델이 공통으로 가지는 필드 타입
interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// Prisma 클라이언트의 모델 접근자 타입 추출
// 예: PrismaClient['user'] | PrismaClient['subscription'] 등
type PrismaModelDelegate = {
  findUnique: (args: { where: { id: string } }) => Promise<unknown>;
  findMany: (args?: unknown) => Promise<unknown[]>;
  create: (args: { data: unknown }) => Promise<unknown>;
  update: (args: { where: { id: string }; data: unknown }) => Promise<unknown>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
};

// 추상 기본 클래스
abstract class BaseRepository<TEntity extends BaseEntity> {
  constructor(protected readonly model: PrismaModelDelegate) {}

  async findById(id: string): Promise<TEntity | null> {
    const result = await this.model.findUnique({ where: { id } });
    return result as TEntity | null;
  }

  async create(data: Omit<TEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<TEntity> {
    const result = await this.model.create({ data });
    return result as TEntity;
  }

  async delete(id: string): Promise<void> {
    await this.model.delete({ where: { id } });
  }
}

// 구체적인 구현
class UserRepository extends BaseRepository<{
  id: string;
  email: string;
  role: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}> {
  constructor(prismaClient: PrismaClient) {
    super(prismaClient.user as unknown as PrismaModelDelegate);
  }

  async findByEmail(email: string) {
    return this.model.findUnique({ where: { id: email } as { id: string } });
  }
}
```

### 4.4 공변성과 반공변성 실용 예시

이 개념은 처음 접하면 어렵게 느껴지지만, 실제 에러를 만나면 이해가 빠릅니다.

```typescript
// 공변성(Covariance): 하위 타입을 상위 타입으로 사용 가능 (일반적인 타입 관계)

class Animal {
  name: string = '';
}

class Dog extends Animal {
  bark(): void { console.log('멍'); }
}

// ✅ 공변성: Dog[]를 Animal[]에 할당 가능
const dogs: Dog[] = [new Dog()];
const animals: Animal[] = dogs; // OK

// 반공변성(Contravariance): 함수 매개변수에서 발생

// ✅ 이 함수는 Animal을 매개변수로 받음
const processAnimal: (a: Animal) => void = (a) => console.log(a.name);

// ❌ Dog를 매개변수로 받는 함수를 Animal을 받는 곳에 할당하면 에러
// (strict 모드에서 함수 매개변수는 반공변)
const processDog: (d: Dog) => void = (d) => d.bark();

// processAnimal = processDog; ← 컴파일 에러!
// Dog만 처리하는 함수를 모든 Animal을 처리해야 하는 자리에 넣으면 위험

// 실용적 예시: 이벤트 핸들러 타입
type EventHandler<T> = (event: T) => void;

interface BaseEvent { timestamp: Date }
interface UserCreatedEvent extends BaseEvent { userId: string }

// 구체적인 이벤트 핸들러
const handleUserCreated: EventHandler<UserCreatedEvent> = (e) => {
  console.log(e.userId); // UserCreatedEvent에만 있는 필드
};

// 일반 이벤트 핸들러
const handleBaseEvent: EventHandler<BaseEvent> = (e) => {
  console.log(e.timestamp);
};

// strictFunctionTypes: true 때문에
// handleUserCreated를 EventHandler<BaseEvent>에 할당 불가
// (모든 BaseEvent에 userId가 있는 건 아니므로 위험)
```

---

## 5. 타입 안전한 API 설계

### 5.1 Zod와 TypeScript 타입 통합

Zod 스키마에서 TypeScript 타입을 자동으로 추론합니다. 스키마와 타입을 따로 관리할 필요가 없습니다.

```typescript
// CSAP D-12: 입력 검증 — Zod 스키마 기반

import { z } from 'zod';

// 스키마 정의
const createUserSchema = z.object({
  email: z.string().email('유효한 이메일 형식이 아닙니다'),
  name: z.string()
    .min(1, '이름은 필수입니다')
    .max(100, '이름은 100자 이하여야 합니다')
    .regex(/^[가-힣a-zA-Z\s]+$/, '이름에는 한글, 영문, 공백만 허용됩니다'),
  role: z.enum(['TENANT_ADMIN', 'USER', 'VIEWER']),
  tenantId: z.string().uuid('유효한 테넌트 ID 형식이 아닙니다'),
});

// 타입 자동 추론 — 스키마와 타입이 항상 동기화됨
type CreateUserInput = z.infer<typeof createUserSchema>;
// 결과:
// {
//   email: string;
//   name: string;
//   role: "TENANT_ADMIN" | "USER" | "VIEWER";
//   tenantId: string;
// }

// 응답 스키마
const userResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.string(),
  createdAt: z.string().datetime(),
});

type UserResponse = z.infer<typeof userResponseSchema>;

// 핸들러에서 활용
async function createUserHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // safeParse: 에러를 throw하지 않고 Result로 반환
  const parseResult = createUserSchema.safeParse(request.body);

  if (!parseResult.success) {
    // parseResult.error는 ZodError 타입
    const errors = parseResult.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    await reply.status(400).send({ errors });
    return;
  }

  // parseResult.data는 CreateUserInput 타입 보장
  const { email, name, role, tenantId } = parseResult.data;

  // Prisma 호출 — 타입 안전
  const user = await prisma.user.create({
    data: { email, name, role, tenantId },
  });

  const response: UserResponse = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };

  await reply.status(201).send(response);
}
```

### 5.2 런타임 타입 검사 vs 컴파일 타임 검사

이 두 가지의 차이와 언제 각각을 사용하는지 이해하는 것이 중요합니다.

```
컴파일 타임 검사 (TypeScript):
  - 코드 작성 시 IDE에서 즉시 피드백
  - 빌드 시 에러 감지
  - 런타임 오버헤드 없음
  - 외부 입력에는 적용 불가 (외부 입력은 런타임에 들어옴)

런타임 타입 검사 (Zod, 직접 검사):
  - HTTP 요청, 파일 내용, 외부 API 응답 등 외부 입력에 필수
  - 런타임 오버헤드 있음 (하지만 보안상 필수)
  - CSAP D-12 입력 검증 요건 충족
```

```typescript
// 외부 입력에는 런타임 검사 필수
async function handleWebhook(request: FastifyRequest): Promise<void> {
  // request.body는 런타임에 어떤 값이 올지 모름
  // TypeScript 타입만으로는 보호 불가

  // ❌ 잘못된 방법: 타입 단언만 사용
  const body = request.body as WebhookPayload;
  body.eventType; // 런타임에 null/undefined이면 에러

  // ✅ 올바른 방법: Zod로 런타임 검증
  const webhookSchema = z.object({
    eventType: z.string(),
    tenantId: z.string().uuid(),
    data: z.record(z.unknown()),
  });

  const result = webhookSchema.safeParse(request.body);
  if (!result.success) {
    // 잘못된 형식의 요청 거부
    return;
  }
  // result.data.eventType은 런타임에도 string임이 보장됨
}
```

---

## 6. 타입 에러 해결 패턴

### 6.1 가장 흔한 타입 에러 10가지

**에러 1: `Object is possibly 'null' or 'undefined'`**

```typescript
// 에러 상황
const user = await prisma.user.findUnique({ where: { id } });
console.log(user.email); // 에러: Object is possibly 'null'

// 해결 방법 A: null 체크
if (user === null) throw new Error('사용자를 찾을 수 없습니다');
console.log(user.email); // OK

// 해결 방법 B: Optional chaining
console.log(user?.email); // undefined 반환 (에러 없음)

// 해결 방법 C: Non-null assertion (확실할 때만)
console.log(user!.email); // null이면 런타임 에러
```

**에러 2: `Type 'X' is not assignable to type 'Y'`**

```typescript
// Prisma enum과 TypeScript 문자열 타입 불일치
const role: string = 'TENANT_ADMIN';
await prisma.user.create({
  data: { role }, // 에러: string은 'SUPER_ADMIN' | 'TENANT_ADMIN' | ... 에 할당 불가
});

// 해결: const assertion 또는 enum 캐스팅
const role = 'TENANT_ADMIN' as const; // 타입: "TENANT_ADMIN"
// 또는
import type { Role } from '@prisma/client';
const role: Role = 'TENANT_ADMIN';
```

**에러 3: `Property 'X' does not exist on type 'never'`**

```typescript
// never 타입이 되는 상황: 모든 가능성을 배제한 후
type Status = 'A' | 'B';
const status: Status = getStatus();

if (status === 'A') {
  // status: 'A'
} else if (status === 'B') {
  // status: 'B'
} else {
  // status: never (A와 B 모두 아님 — 도달 불가)
  console.log(status.length); // 에러: never에는 아무 프로퍼티도 없음
}
```

**에러 4: `Index signature is missing in type`**

```typescript
// Record 타입과 인터페이스 불일치
interface Config {
  host: string;
  port: number;
}

// Record<string, unknown>에 Config를 할당하려면
function acceptRecord(config: Record<string, unknown>): void {}

acceptRecord({ host: 'localhost', port: 3000 } as Config); // 경우에 따라 에러

// 해결: 인터페이스에 인덱스 시그니처 추가 (권장하지 않음)
interface ConfigWithIndex extends Config {
  [key: string]: unknown; // 추가
}

// 더 나은 해결: 타입 단언 사용
acceptRecord({ host: 'localhost', port: 3000 } as unknown as Record<string, unknown>);
```

**에러 5: `noUncheckedIndexedAccess` 관련 에러**

```typescript
// 배열 인덱스 접근 결과가 undefined일 수 있음
const items = ['a', 'b', 'c'];

// 에러: Type 'string | undefined' is not assignable to type 'string'
const first: string = items[0]; // undefined일 수도 있음

// 해결 A: 타입에 undefined 포함
const first: string | undefined = items[0];

// 해결 B: Non-null assertion (배열이 비어있지 않음을 확신할 때)
const first = items[0]!;

// 해결 C: 기본값 제공
const first = items[0] ?? '';
```

### 6.2 `as` 캐스팅 사용 기준

`as` 캐스팅은 강력하지만 남용하면 타입 시스템의 보호를 무력화합니다.

```typescript
// ✅ as 캐스팅이 괜찮은 경우

// 1. Prisma enum 값 변환 (타입 형태는 같지만 TypeScript가 인식 못할 때)
const userRole = rawRole as Role; // Role은 Prisma enum

// 2. DOM/Node.js API에서 타입이 명확한 경우
const envValue = process.env['DATABASE_URL'] as string;
// (단, 환경 변수가 반드시 있다고 확신할 때만)

// 3. 외부 라이브러리 타입이 틀렸을 때 (타입 단언으로 우회)
const result = await externalLib.getUser() as { id: string; email: string };

// ❌ as 캐스팅이 위험한 경우

// 1. 관련 없는 타입으로 캐스팅
const num = '123' as unknown as number; // 문자열을 숫자로 — 런타임에 문자열 그대로임

// 2. Zod 검증 없이 외부 입력 캐스팅
const body = request.body as CreateUserInput; // 위험! 검증 없이 신뢰

// 3. 에러를 무시하기 위한 캐스팅
const user = await prisma.user.findUnique({ where: { id } }) as User;
// null 가능성을 제거하려는 의도지만 런타임 에러 위험
```

### 6.3 `any` 사용 금지 — `unknown` 활용

`any`는 TypeScript의 타입 검사를 완전히 비활성화합니다. 이 프로젝트에서는 `any` 사용이 원칙적으로 금지됩니다.

```typescript
// ❌ any 사용 — 타입 안전성 완전 무력화
function processData(data: any): void {
  data.someMethod(); // 런타임까지 에러 감지 불가
  data.anything.deeply.nested; // 컴파일 에러 없음
}

// ✅ unknown 사용 — 사용 전 타입 확인 강제
function processData(data: unknown): void {
  // 바로 사용 불가 — 타입을 확인해야 함
  // data.someMethod(); ← 컴파일 에러

  // 타입 좁히기 후 사용 가능
  if (typeof data === 'object' && data !== null && 'someMethod' in data) {
    (data as { someMethod: () => void }).someMethod();
  }
}

// catch 블록에서의 에러 처리
try {
  await dangerousOperation();
} catch (error) {
  // ✅ unknown으로 받아서 타입 확인
  if (error instanceof Error) {
    console.error(error.message);
  } else if (typeof error === 'string') {
    console.error(error);
  } else {
    console.error('알 수 없는 에러');
  }
}
```

### 6.4 타입 좁히기 기법

```typescript
// 타입 좁히기는 TypeScript가 더 구체적인 타입을 알 수 있게 하는 방법입니다.

// 방법 1: typeof 체크
function formatValue(value: string | number): string {
  if (typeof value === 'string') {
    return value.toUpperCase(); // 여기서 value: string
  }
  return value.toFixed(2); // 여기서 value: number
}

// 방법 2: instanceof 체크
function handleError(error: unknown): string {
  if (error instanceof Error) {
    return error.message; // 여기서 error: Error
  }
  return '알 수 없는 에러';
}

// 방법 3: in 연산자
interface AdminUser { role: 'admin'; adminLevel: number }
interface RegularUser { role: 'user'; subscriptionTier: string }

function processUser(user: AdminUser | RegularUser): void {
  if ('adminLevel' in user) {
    console.log(user.adminLevel); // 여기서 user: AdminUser
  } else {
    console.log(user.subscriptionTier); // 여기서 user: RegularUser
  }
}

// 방법 4: 사용자 정의 타입 가드
function isActiveSubscription(sub: unknown): sub is { id: string; status: 'ACTIVE' } {
  return (
    typeof sub === 'object' &&
    sub !== null &&
    'status' in sub &&
    (sub as { status: unknown }).status === 'ACTIVE'
  );
}

const subscriptions = await prisma.subscription.findMany({ where: { tenantId } });
const activeOnly = subscriptions.filter(isActiveSubscription);
// activeOnly의 타입: Array<{ id: string; status: 'ACTIVE' }>
```

---

## 7. 성능 관련 TypeScript 패턴

### 7.1 타입 연산 비용 최소화

TypeScript의 타입 검사는 컴파일 타임에 이루어지지만, 복잡한 타입은 IDE 성능을 저하시킬 수 있습니다. 특히 대형 공개 인터페이스를 가진 패키지에서 중요합니다.

```typescript
// ❌ 복잡한 중첩 조건 타입 — IDE 성능 저하 가능
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? T[P] extends Function
      ? T[P]
      : DeepReadonly<T[P]>
    : T[P];
};

// ✅ 실제로 필요한 깊이만 처리 (이 프로젝트 수준에서는 shallow 충분)
type Readonly<T> = { readonly [P in keyof T]: T[P] };

// ❌ 재귀 타입을 불필요하게 깊이 사용
type DeepPartial<T> = { [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P] };

// ✅ Prisma의 Select/Include를 활용하면 DeepPartial 불필요
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, email: true }, // 필요한 필드만 선택
});
// user는 { id: string; email: string } | null 타입 (정확하고 가볍게)
```

### 7.2 대형 Union 타입 최적화

```typescript
// ❌ 너무 많은 Union 멤버는 타입 체크 속도 저하
type AllEventTypes =
  | 'subscription.created'
  | 'subscription.updated'
  // ... 100개의 이벤트 타입 나열 ...
  | 'tenant.deleted';

// ✅ Template Literal Type으로 생성 (컴파일러가 효율적으로 처리)
type Entity = 'subscription' | 'tenant' | 'user';
type Action = 'created' | 'updated' | 'deleted';
type EventType = `${Entity}.${Action}`;
// 3 * 3 = 9가지 조합 자동 생성, 명확한 의도

// ✅ 자주 사용하는 복잡 타입은 alias로 캐싱
// (TypeScript 컴파일러가 타입 별칭을 캐시하여 재사용)
type SubscriptionWithPlan = Prisma.SubscriptionGetPayload<{
  include: { plan: true };
}>;

// 이 타입을 여러 곳에서 재사용 (매번 다시 계산하지 않음)
function formatSubscription(sub: SubscriptionWithPlan): string {
  return `${sub.id} - ${sub.plan.name}`;
}
```

### 7.3 Declaration 파일 작성

내부 패키지를 외부에 공개할 때 `.d.ts` 파일을 올바르게 작성해야 합니다. 이 프로젝트의 `platform/packages/` 패키지들이 이 패턴을 따릅니다.

```typescript
// platform/packages/id-generator/src/index.ts — 공개 API 정의

// ✅ 타입과 값을 명확히 구분하여 export
export type { Brand } from './branded-ids.js';
export { asTenantId, asUserId, asPlanId } from './branded-ids.js';
export {
  generateUUIDv7,
  generatePrefixedId,
  generateShortId,
  generateBatch,
  isValidUUIDv7,
  isValidPrefixedId,
  extractUUID,
  extractPrefix,
} from './id-generator.js';

// tsconfig.json에 "declaration": true가 설정되어 있으면
// 자동으로 dist/index.d.ts가 생성됩니다.
```

**`package.json`에서 타입 선언 위치 지정**:

```json
{
  "name": "@public-saas/id-generator",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

```mermaid
flowchart TD
    A[TypeScript 소스\n.ts 파일] --> B[tsc 컴파일]
    B --> C[JavaScript 출력\ndist/*.js]
    B --> D[타입 선언\ndist/*.d.ts]
    B --> E[소스맵\ndist/*.js.map]
    B --> F[선언 맵\ndist/*.d.ts.map]

    C --> G[런타임 실행]
    D --> H[소비자 패키지의\nTypeScript 타입 체크]
    E --> I[런타임 디버깅\n소스 위치 표시]
    F --> J["Go to Definition"\n원본 .ts 파일로 이동"]
```

---

## 8. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 초안 작성 — tsconfig 분석, 고급 타입 패턴, 실제 프로젝트 코드 기반 예시 포함 | Implementer (Sonnet) |
