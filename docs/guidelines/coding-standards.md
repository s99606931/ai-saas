# 공공기관 SaaS 프레임워크 -- 코딩 표준 지침서

> **버전**: 1.0.0 | **작성일**: 2026-04-11 | **작성자**: PM Lead (Opus)
> **적용 범위**: platform/ 하위 전체 (services, packages, apps)
> **Plan 참조**: MTU-TECH-STACK-2026Q2 (CC-REQ-02 ~ CC-REQ-06)
> **CSAP 관련**: D-06, D-08, D-09, D-12

---

## 목차

1. [TypeScript 기본 규칙](#1-typescript-기본-규칙)
2. [네이밍 규칙](#2-네이밍-규칙)
3. [타입 정의 패턴](#3-타입-정의-패턴)
4. [에러 처리 패턴](#4-에러-처리-패턴)
5. [Fastify 서비스 패턴](#5-fastify-서비스-패턴)
6. [프론트엔드 패턴 (Next.js 15 + React 19)](#6-프론트엔드-패턴)
7. [공유 패키지 패턴](#7-공유-패키지-패턴)
8. [보안 코딩 패턴 (CSAP/N2SF)](#8-보안-코딩-패턴)
9. [비동기 처리 패턴](#9-비동기-처리-패턴)
10. [테스트 패턴](#10-테스트-패턴)

---

## 1. TypeScript 기본 규칙

### 1.1 strict 모드 필수

모든 TypeScript 프로젝트는 `tsconfig.base.json`을 상속하며 다음 옵션이 활성화된다:

```jsonc
// tsconfig.base.json -- 프로젝트 공통
{
  "compilerOptions": {
    "strict": true,                      // 모든 strict 계열 활성화
    "noUnusedLocals": true,              // 미사용 변수 -> 오류
    "noUnusedParameters": true,          // 미사용 매개변수 -> 오류
    "noUncheckedIndexedAccess": true,    // 인덱스 접근 시 T | undefined
    "verbatimModuleSyntax": true,        // import type 명시 강제
    "noFallthroughCasesInSwitch": true   // switch 폴스루 방지
  }
}
```

### 1.2 any 사용 금지

```typescript
// [금지] any 사용
function processData(data: any): any { ... }

// [필수] unknown + 타입 가드 사용
function processData(data: unknown): ProcessResult {
  if (!isValidInput(data)) {
    throw new ValidationError('유효하지 않은 입력');
  }
  return transformData(data);
}

// [허용] Record<string, unknown> -- 동적 키-값 구조
function logMetadata(metadata: Record<string, unknown>): void { ... }
```

### 1.3 환경 변수 접근

```typescript
// [금지] process.env.VAR 직접 접근 (undefined 가능)
const port = process.env.PORT;

// [필수] 브래킷 표기법 + 기본값 -- noUncheckedIndexedAccess 호환
const port = process.env['PORT'] ?? '3000';

// [권장] configPlugin 사용 (서비스 레벨)
const PORT = app.config.get<number>('port', 3001);
```

### 1.4 함수 크기 및 책임

| 규칙 | 기준 | 비고 |
|------|------|------|
| 함수 최대 줄 수 | 80줄 이하 | 초과 시 분리 |
| 파일 최대 줄 수 | 800줄 이하 | 초과 시 모듈 분리 |
| 줄 길이 | 120자 이하 | ESLint 강제 |
| 중첩 깊이 | 4단계 이하 | 가드 절(early return) 활용 |

### 1.5 import 순서

```typescript
// 1. Node.js 내장 모듈
import { randomUUID } from 'node:crypto';

// 2. 외부 패키지 (npm)
import Fastify from 'fastify';
import { z } from 'zod';

// 3. 내부 공유 패키지 (@public-saas/*)
import { rbacPlugin } from '@public-saas/rbac';
import type { TokenPayload } from '@public-saas/types';

// 4. 로컬 모듈 (상대 경로)
import { loginHandler } from './handlers/login.handler.js';
import { loginSchema } from './schemas/login.schema.js';
```

### 1.6 ESM 규칙

```typescript
// [필수] .js 확장자 포함 (ESM 호환)
import { prisma } from './lib/prisma.js';

// [필수] type 키워드로 타입 import 분리 (verbatimModuleSyntax)
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// [필수] package.json에 "type": "module" 설정
```

---

## 2. 네이밍 규칙

### 2.1 파일명

| 대상 | 형식 | 예시 |
|------|------|------|
| 서비스 진입점 | index.ts | `src/index.ts` |
| 핸들러 | {resource}.handler.ts | `login.handler.ts` |
| 미들웨어 | {기능}.middleware.ts | `auth.middleware.ts` |
| 스키마 | {resource}.schema.ts | `login.schema.ts` |
| Fastify 플러그인 | {기능}-plugin.ts | `rbac-plugin.ts` |
| 타입 정의 | {도메인}.ts | `user.ts`, `tenant.ts` |
| 테스트 | {대상}.test.ts | `login.handler.test.ts` |

**규칙**: 모든 파일명은 **kebab-case** (소문자 + 하이픈).

### 2.2 코드 네이밍

| 대상 | 형식 | 예시 |
|------|------|------|
| 변수 | camelCase | `accessToken`, `tenantId` |
| 함수 | camelCase (동사 시작) | `createSession`, `verifyToken` |
| 클래스 | PascalCase | `EventBus`, `TenantContext` |
| 타입/인터페이스 | PascalCase | `TokenPayload`, `ApiResponse` |
| 열거형 값 | PascalCase (enum) / UPPER_SNAKE_CASE (const) | `UserRole`, `AUTH_CONSTANTS` |
| 상수 | UPPER_SNAKE_CASE | `MAX_LOGIN_ATTEMPTS` |

### 2.3 금지 네이밍

```typescript
// [금지] I 접두사 (인터페이스)
interface IUser { ... }
// [필수] 접두사 없이 명확한 이름
interface User { ... }

// [금지] 약어 (의미 불분명)
const usr = getUsr();
// [필수] 완전한 이름
const user = getUser();

// [금지] DTO 접미사 남용 (입출력에만 사용)
interface UserDto { ... }
// [권장] 용도 명시
interface CreateUserInput { ... }
interface UserListResponse { ... }
```

---

## 3. 타입 정의 패턴

### 3.1 중앙 타입 패키지

공유 타입은 `@public-saas/types` 패키지에서 관리한다:

```typescript
// platform/packages/types/src/index.ts
// 도메인별 타입을 re-export
export type { Tenant, TenantStatus, TenantConfig } from './tenant.js';
export type { User, UserRole, TokenPayload } from './user.js';
export type { ApiResponse, PaginatedResponse, ErrorResponse } from './api.js';
export type { DataGrade, N2sfDomain, CsapControl } from './csap.js';
```

### 3.2 API 응답 표준 타입

```typescript
// 성공 응답 -- 모든 API에서 동일 구조
interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

// 페이지네이션 응답
interface PaginatedResponse<T = unknown> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// 오류 응답
interface ErrorResponse {
  success: false;
  error: {
    code: string;           // 대문자_스네이크 (AUTH_TOKEN_INVALID)
    message: string;         // 한국어 사용자 메시지
    errorId?: string;        // UUID -- 감사 로그 연결 (CSAP D-06)
  };
}
```

### 3.3 서비스 내부 타입

서비스 전용 타입은 해당 서비스의 `schemas/` 또는 인라인으로 정의:

```typescript
// platform/services/auth-service/src/schemas/login.schema.ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('유효한 이메일 주소를 입력하세요').max(255),
  password: z.string().min(1, '비밀번호를 입력하세요').max(128),
  tenantSlug: z.string().min(1).max(100),
  mfaCode: z.string().length(6).regex(/^\d+$/).optional(),
});

// Zod에서 타입 추출
export type LoginRequest = z.infer<typeof loginSchema>;
```

### 3.4 Fastify 타입 확장

```typescript
// request 타입 확장 (미들웨어에서 주입하는 속성)
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

// fastify-plugin으로 래핑하여 encapsulation 보장
export default fp(authPlugin, {
  name: 'auth-middleware',
  fastify: '5.x',
});
```

---

## 4. 에러 처리 패턴

### 4.1 도메인 에러 클래스

```typescript
// 비즈니스 도메인 에러 (throw 패턴)
export class DataGradeViolationError extends Error {
  public readonly grade: DataGrade;
  public readonly code = 'N2SF_DATA_GRADE_VIOLATION';

  constructor(message: string, grade: DataGrade) {
    super(message);
    this.name = 'DataGradeViolationError';
    this.grade = grade;
  }
}
```

### 4.2 핸들러 에러 응답

```typescript
// 핸들러에서는 ErrorResponse 형식으로 직접 응답
export async function loginHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parseResult = loginSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parseResult.error.issues.map((i) => i.message).join(', '),
      },
    });
    return;
  }
  // ... 비즈니스 로직
}
```

### 4.3 에러 응답에 민감 정보 금지

```typescript
// [금지] 스택 트레이스, DB 정보 노출
catch (err) {
  return { error: err.message, stack: err.stack };
}

// [필수] 안전한 에러 응답 + 내부 로깅
catch (err) {
  const errorId = randomUUID();
  app.log.error({ err, errorId }, '내부 오류 발생');
  await reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '내부 오류가 발생했습니다',
      errorId,
    },
  });
}
```

---

## 5. Fastify 서비스 패턴

### 5.1 서비스 진입점 표준 구조

모든 Fastify 서비스는 동일한 구조를 따른다:

```typescript
// src/index.ts -- 표준 진입점
// Design Ref: {MTU-ID} DESIGN
// Plan SC: {FR-ID 목록}
// CSAP: {관련 항목}

// 1. OpenTelemetry 초기화 (다른 import보다 먼저)
import { initTelemetry, shutdownTelemetry } from '@public-saas/observability';
initTelemetry({ serviceName: '{서비스명}', serviceVersion: '{버전}' });

// 2. 외부 의존성 import
import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';
import { healthPlugin, CommonCheckers } from '@public-saas/health';
import { rbacPlugin } from '@public-saas/rbac';
import { meshReadyPlugin } from '@public-saas/mesh-ready';
import { configPlugin } from '@public-saas/config-vault';

async function main(): Promise<void> {
  // 3. Fastify 인스턴스 생성
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport: process.env['NODE_ENV'] === 'development'
        ? { target: 'pino-pretty' }
        : undefined,
    },
  });

  // 4. 플러그인 등록 (순서 중요)
  // 4a. 설정 관리 (최우선)
  await app.register(configPlugin, { /* ... */ });

  // 4b. 인프라 플러그인 (meshReady, responseTime)
  await app.register(meshReadyPlugin, { /* ... */ });
  await app.register(responseTimePlugin);

  // 4c. 보안 플러그인 (health, rbac)
  await app.register(healthPlugin, { /* ... */ });
  await app.register(rbacPlugin, {});

  // 4d. 비즈니스 라우트
  await registerRoutes(app);

  // 5. 서버 시작
  const PORT = app.config.get<number>('port', 3001);
  const HOST = app.config.get<string>('host', '0.0.0.0');
  await app.listen({ port: PORT, host: HOST });

  // 6. Keep-Alive 설정 (k8s ALB 호환)
  app.server.keepAliveTimeout = 65000;
  app.server.headersTimeout = 66000;

  // 7. 예기치 못한 에러 처리
  process.on('uncaughtException', (err) => {
    app.log.fatal({ err }, '치명적 예외 발생 -- 서비스 종료');
    void app.mesh.shutdown.shutdown(app).then(() => process.exit(1));
  });
  process.on('unhandledRejection', (reason) => {
    app.log.error({ reason }, '처리되지 않은 Promise rejection');
  });
}

main().catch((err) => {
  process.stderr.write(`서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
```

### 5.2 플러그인 등록 순서

```
1. configPlugin         -- 환경 설정 로드 (다른 플러그인이 참조)
2. meshReadyPlugin      -- 서비스 메타데이터 + 그레이스풀 셧다운
3. responseTimePlugin   -- X-Response-Time 헤더
4. cors                 -- CORS 설정 (API Gateway에서만)
5. securityHeaders      -- 보안 헤더 (API Gateway에서만)
6. correlationId        -- 요청 추적 ID (API Gateway에서만)
7. auditLogger          -- 감사 로그 (API Gateway에서만)
8. rateLimit            -- Rate Limiting
9. healthPlugin         -- /health, /ready 엔드포인트
10. rbacPlugin          -- RBAC 권한 검사
11. 도메인 플러그인     -- 서비스별 고유 플러그인 (cache, eventBus 등)
12. 비즈니스 라우트     -- 실제 API 엔드포인트
```

### 5.3 라우트 등록 패턴

```typescript
// src/routes.ts
import type { FastifyInstance } from 'fastify';
import { loginHandler } from './handlers/login.handler.js';

// JSON Schema로 입출력 정의 (Fastify 내장 검증 + OpenAPI 자동 생성)
const loginSchemaOpts = {
  schema: {
    description: '사용자 로그인 (CSAP D-08-01)',
    tags: ['auth'],
    body: {
      type: 'object' as const,
      required: ['email', 'password', 'tenantSlug'],
      properties: {
        email: { type: 'string' as const, format: 'email' },
        password: { type: 'string' as const, minLength: 8 },
        tenantSlug: { type: 'string' as const },
      },
    },
    response: {
      200: { type: 'object' as const, properties: { /* ... */ } },
      401: { type: 'object' as const, properties: { /* ... */ } },
    },
  },
  preHandler: rateLimitMiddleware,  // Rate Limit (선택)
};

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // Plan SC: FR-AUTH.1
  app.post('/auth/login', loginSchemaOpts, loginHandler);
}
```

### 5.4 핸들러 패턴

```typescript
// src/handlers/{resource}.handler.ts
// 3단계 구조: 검증 -> 비즈니스 로직 -> 응답

export async function loginHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // 1. 입력 검증 (Zod)
  const parseResult = loginSchema.safeParse(request.body);
  if (!parseResult.success) {
    await reply.status(400).send({ success: false, error: { /* ... */ } });
    return;
  }

  // 2. 비즈니스 로직 (lib/ 함수 호출)
  const user = await findUser(parseResult.data.email);
  const token = await signAccessToken(user);

  // 3. 감사 로그 + 응답
  await logAuthEvent('LOGIN_SUCCESS', user.id, /* ... */);
  await reply.status(200).send({ success: true, data: { accessToken: token } });
}
```

### 5.5 PrismaClient 싱글턴 패턴

```typescript
// src/lib/prisma.ts -- 모든 서비스에서 동일 패턴
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

---

## 6. 프론트엔드 패턴

### 6.1 Server Component vs Client Component

| 기준 | Server Component | Client Component |
|------|-----------------|-----------------|
| 데이터 조회만 | O | - |
| 사용자 상호작용 없음 | O | - |
| onClick, onChange 필요 | - | O |
| useState, useEffect 필요 | - | O |
| 브라우저 API 접근 | - | O |

```typescript
// Server Component (기본) -- 'use client' 없음
export default async function DashboardPage() {
  const data = await prisma.tenant.findMany();  // 서버에서 직접 DB 접근
  return <TenantList tenants={data} />;
}

// Client Component -- 'use client' 명시
'use client';
export function TenantFilter({ onFilter }: { onFilter: (q: string) => void }) {
  const [query, setQuery] = useState('');
  return <input onChange={(e) => { setQuery(e.target.value); onFilter(e.target.value); }} />;
}
```

### 6.2 레이아웃 패턴

```typescript
// src/app/layout.tsx -- 루트 레이아웃 (Server Component)
import type { Metadata } from 'next';
import { headers } from 'next/headers';

export const metadata: Metadata = {
  title: '공공 SaaS 포털',
  description: '공공기관 SaaS 플랫폼 관리 포털',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headerStore = await headers();
  const nonce = headerStore.get('x-nonce') ?? '';
  return (
    <html lang="ko">
      <body nonce={nonce}>{children}</body>
    </html>
  );
}
```

### 6.3 보안 미들웨어 (CSP nonce)

```typescript
// src/middleware.ts -- Next.js 미들웨어
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', cspDirectives.join('; '));
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');

  return response;
}
```

---

## 7. 공유 패키지 패턴

### 7.1 엔트리포인트 구조

```typescript
// src/index.ts -- re-export만 수행 (비즈니스 로직 금지)
export { EventBus, type EventHandler, type EventBusOptions } from './event-bus.js';
export { eventBusPlugin, type EventBusPluginOptions } from './event-bus-plugin.js';
```

### 7.2 Fastify 플러그인 래핑

```typescript
// src/{기능}-plugin.ts
import fp from 'fastify-plugin';
import type { FastifyPluginCallback } from 'fastify';

// Fastify 인스턴스 타입 확장 (decorator)
declare module 'fastify' {
  interface FastifyInstance {
    myFeature: MyFeatureType;
  }
}

const plugin: FastifyPluginCallback<MyPluginOptions> = (app, opts, done) => {
  const instance = new MyFeature(opts);
  app.decorate('myFeature', instance);
  done();
};

// fastify-plugin으로 래핑 -- encapsulation 제거 (전역 접근 가능)
export const myFeaturePlugin = fp(plugin, {
  name: 'my-feature-plugin',
  fastify: '5.x',
});
```

### 7.3 package.json 표준

```json
{
  "name": "@public-saas/{패키지명}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/ --max-warnings 0",
    "clean": "rm -rf dist"
  }
}
```

---

## 8. 보안 코딩 패턴

### 8.1 RBAC 적용 (CSAP D-08)

```typescript
// 서비스 레벨: rbacPlugin 등록
await app.register(rbacPlugin, {
  auditLogger: (event) => {
    app.log.info({ rbacEvent: event }, 'RBAC 감사 로그');
  },
});

// 라우트 레벨: requirePermission 미들웨어
import { requirePermission } from '@public-saas/rbac';

app.get('/tenants', {
  preHandler: requirePermission('tenant:read'),
}, tenantListHandler);
```

### 8.2 감사 로그 (CSAP D-06)

```typescript
// audit-sdk를 사용한 표준 패턴
import { createAuditLogger, createStandardTransport } from '@public-saas/audit-sdk';

const auditLogger = createAuditLogger({
  serviceName: '{서비스명}',
  transport: createStandardTransport('{서비스명}'),
});

// 민감 작업 전후 기록 (누가, 무엇을, 언제, 어디서)
await auditLogger.log({
  actor: user.id,
  action: 'USER_DELETE',
  target: targetUserId,
  targetType: 'user',
  tenantId: tenant.id,
  ip: request.ip,
  userAgent: request.headers['user-agent'] ?? 'unknown',
  metadata: { reason: '관리자 요청' },
});
```

### 8.3 입력 검증 (CSAP D-12)

```typescript
// 모든 API 입력은 Zod 스키마로 검증
import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().min(1, '테넌트명을 입력하세요').max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, '소문자, 숫자, 하이픈만 허용'),
  maxUsers: z.number().int().min(1).max(10000),
});

// 핸들러에서 safeParse 사용
const result = createTenantSchema.safeParse(request.body);
if (!result.success) {
  await reply.status(400).send({
    success: false,
    error: { code: 'VALIDATION_ERROR', message: result.error.issues[0]?.message ?? '입력 오류' },
  });
  return;
}
```

### 8.4 N2SF 데이터 등급 검증

```typescript
// AI API 전송 전 필수 검증
import type { DataGrade } from '@public-saas/types';

export function validateDataGrade(grade: DataGrade): void {
  if (grade === 'C' || grade === 'S') {
    throw new DataGradeViolationError(
      `BLOCKED: ${grade}등급 데이터는 AI API 전송이 금지됩니다 (N2SF N-05)`,
      grade,
    );
  }
}

// O등급 데이터는 PII 마스킹 후 전송
import { maskPII } from './pii-masking.js';
const safeText = maskPII(userInput);
```

### 8.5 PII 마스킹

```typescript
// 마스킹 대상: 이메일, 전화번호, 주민번호, 카드번호, IP
export function maskPII(text: string): string {
  let masked = text;
  masked = masked.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_MASKED]');
  masked = masked.replace(/\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g, '[CARD_MASKED]');
  masked = masked.replace(/\d{6}[-\s]?\d{7}/g, '[RRN_MASKED]');
  masked = masked.replace(/0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g, '[PHONE_MASKED]');
  masked = masked.replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, '[IP_MASKED]');
  return masked;
}
```

### 8.6 시크릿 관리

```typescript
// [절대 금지] 하드코딩된 시크릿
const API_KEY = 'sk-1234567890';

// [필수] 환경 변수 + 존재 확인
const API_KEY = process.env['API_KEY'];
if (!API_KEY) {
  throw new Error('API_KEY 환경 변수가 설정되지 않았습니다');
}

// [권장] configPlugin으로 중앙 관리
await app.register(configPlugin, {
  envMapping: { API_KEY: 'apiKey' },
});
const apiKey = app.config.get<string>('apiKey');
```

### 8.7 JWT 인증 미들웨어 패턴

```typescript
// 공개 경로 정확 매칭 (CSAP D-08-01: 경로 우회 방지)
const urlPath = request.url.split('?')[0] ?? request.url;
const publicPaths = ['/health', '/ready', '/auth/login', '/auth/refresh'];
if (publicPaths.some((p) => urlPath === p)) {
  return;  // 인증 건너뜀
}

// Bearer 토큰 추출
const authHeader = request.headers.authorization;
if (!authHeader?.startsWith('Bearer ')) {
  await reply.status(401).send({ /* ... */ });
  return;
}

const token = authHeader.slice(7);

// 블랙리스트 확인 + 토큰 검증
if (await isTokenBlacklisted(token)) { /* 401 */ }
const payload = await verifyToken(token);
request.user = payload;
```

---

## 9. 비동기 처리 패턴

### 9.1 async/await 기본

```typescript
// [필수] async/await 사용 (Promise chain 금지)
async function createTenant(data: CreateTenantInput): Promise<Tenant> {
  const tenant = await prisma.tenant.create({ data });
  await auditLogger.log({ action: 'TENANT_CREATE', target: tenant.id });
  return tenant;
}

// [금지] Promise chain
function createTenant(data) {
  return prisma.tenant.create({ data })
    .then((tenant) => auditLogger.log({}).then(() => tenant));
}
```

### 9.2 병렬 실행

```typescript
// 독립적인 작업은 Promise.all로 병렬화
const [tenant, permissions, sessions] = await Promise.all([
  prisma.tenant.findUnique({ where: { id: tenantId } }),
  getUserPermissions(userId),
  getActiveSessions(userId),
]);
```

### 9.3 Fastify 비동기 플러그인

```typescript
// Fastify 플러그인에서 비동기 함수 사용 시 void 처리
process.on('uncaughtException', (err) => {
  app.log.fatal({ err }, '치명적 예외 발생');
  void app.mesh.shutdown.shutdown(app).then(() => process.exit(1));
});
```

---

## 10. 테스트 패턴

### 10.1 파일 구조

```
tests/
  unit/                      # 단위 테스트 (비즈니스 로직)
    login.handler.test.ts
  integration/               # 통합 테스트 (API 엔드포인트)
    auth-flow.test.ts
```

### 10.2 Vitest 서비스 테스트

```typescript
// tests/unit/login.handler.test.ts
import { describe, it, expect, vi } from 'vitest';
import { verifyPassword } from '../../src/lib/password.js';

describe('verifyPassword', () => {
  it('올바른 비밀번호를 검증한다', async () => {
    const hash = await hashPassword('test1234');
    const result = await verifyPassword('test1234', hash);
    expect(result).toBe(true);
  });

  it('잘못된 비밀번호를 거부한다', async () => {
    const hash = await hashPassword('test1234');
    const result = await verifyPassword('wrong', hash);
    expect(result).toBe(false);
  });
});
```

### 10.3 E2E 테스트 (Playwright)

```typescript
// platform/tests/e2e/scenarios/auth-login.test.ts
import { test, expect } from '@playwright/test';

test('로그인 후 대시보드에 접근할 수 있다', async ({ page }) => {
  await page.goto('/auth/login');
  await page.fill('[name=email]', 'admin@test.com');
  await page.fill('[name=password]', 'test1234');
  await page.click('button[type=submit]');
  await expect(page).toHaveURL('/dashboard');
});
```

---

## 11. 코드 주석 표준

### 11.1 파일 헤더 주석 (필수)

모든 소스 파일 상단에 추적성 주석을 포함한다:

```typescript
// {파일 설명}
// Design Ref: {MTU-ID} DESIGN §{섹션}
// Plan SC: {FR-ID 목록}
// CSAP: {관련 항목}
```

실제 예시:

```typescript
// 로그인 핸들러
// Design Ref: DESIGN-MTU-P01 Section 2 -- POST /auth/login
// Plan SC: FR-P01.1, FR-P01.6, FR-P01.8, FR-P01.12
// CSAP: D-08-01 인증, D-08-06 계정 잠금
```

### 11.2 인라인 주석

```typescript
// Plan SC: FR-AUTH.1 (MFA 검증 통합)
app.post('/auth/login', loginSchemaOpts, loginHandler);

// CSAP D-08-06: 5회 실패 -> 30분 잠금
if (newFailedCount >= AUTH_CONSTANTS.MAX_LOGIN_ATTEMPTS) {
  updateData['lockedUntil'] = new Date(Date.now() + lockDurationMs);
}
```

### 11.3 TODO / NOTE 형식

```typescript
// TODO: FR-2.3 -- Phase 2에서 캐시 무효화 전략 구현 -- 담당자: 미정 -- 기한: 2026-07
// NOTE: 미사용. Phase 2 FR-2.3 구현 시 사용 예정. 재검토일: 2026-07-01
```

---

## 12. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|-------|
| 1.0.0 | 2026-04-11 | 초기 작성 -- 현재 코드베이스 패턴 기반 | PM Lead (Opus) |
