# 공공기관 SaaS 프레임워크 -- 디자인 패턴 지침서

> **버전**: 1.0.0 | **작성일**: 2026-04-11 | **작성자**: PM Lead (Opus)
> **적용 범위**: platform/ 하위 전체 (services, packages, apps)
> **Plan 참조**: MTU-TECH-STACK-2026Q2 (CC-REQ-07)
> **CSAP 관련**: D-06, D-07, D-08, D-09, N2SF N-03, N-05

---

## 목차

1. [백엔드 핵심 패턴](#1-백엔드-핵심-패턴)
2. [공유 패키지 패턴](#2-공유-패키지-패턴)
3. [프론트엔드 패턴](#3-프론트엔드-패턴)
4. [공공기관 SaaS 특화 패턴](#4-공공기관-saas-특화-패턴)
5. [인프라 연동 패턴](#5-인프라-연동-패턴)
6. [패턴 선택 가이드](#6-패턴-선택-가이드)

---

## 1. 백엔드 핵심 패턴

### 1.1 Fastify Plugin 패턴

**목적**: 기능 단위 캡슐화, 서비스 간 코드 공유

본 프로젝트에서 가장 핵심적인 패턴이다. 모든 공유 기능은 Fastify 플러그인으로 제공된다.

```typescript
// @public-saas/health -- healthPlugin 실제 구현 패턴
import fp from 'fastify-plugin';
import type { FastifyPluginCallback } from 'fastify';

export interface HealthPluginOptions {
  serviceName: string;
  version: string;
  checkers: DependencyChecker[];
}

// Fastify 인스턴스 데코레이터 타입 확장
declare module 'fastify' {
  interface FastifyInstance {
    healthChecker: HealthChecker;
  }
}

const healthPluginImpl: FastifyPluginCallback<HealthPluginOptions> = (app, opts, done) => {
  const checker = new HealthChecker(opts);
  app.decorate('healthChecker', checker);

  // /health (liveness), /ready (readiness) 자동 등록
  app.get('/health', async () => checker.liveness());
  app.get('/ready', async () => checker.readiness());

  done();
};

// fp() 래핑으로 encapsulation 해제 -- 모든 라우트에서 접근 가능
export const healthPlugin = fp(healthPluginImpl, {
  name: 'health-plugin',
  fastify: '5.x',
});
```

**적용 위치**: `platform/packages/*/src/*-plugin.ts`

**규칙**:
- 모든 공유 패키지는 Fastify 플러그인 형태로 제공
- `fastify-plugin`(fp)으로 래핑하여 encapsulation 해제
- `declare module 'fastify'`로 인스턴스 타입 확장
- `fastify: '5.x'` 버전 호환성 명시

### 1.2 서비스 부트스트랩 패턴

**목적**: 모든 서비스의 동일한 초기화 순서 보장

```typescript
// 표준 부트스트랩 순서 (17개 서비스 모두 동일)
async function main(): Promise<void> {
  // Phase 1: 인스턴스 생성
  const app = Fastify({ logger: { /* ... */ } });

  // Phase 2: 설정 로드
  await app.register(configPlugin, { /* ... */ });

  // Phase 3: 인프라 플러그인
  await app.register(meshReadyPlugin, { /* ... */ });
  await app.register(responseTimePlugin);

  // Phase 4: 보안 플러그인
  await app.register(healthPlugin, { /* ... */ });
  await app.register(rbacPlugin, { /* ... */ });

  // Phase 5: 도메인 플러그인 (서비스별 상이)
  await app.register(cachePlugin, { /* ... */ });      // tenant-service
  await app.register(eventBusPlugin, { /* ... */ });   // auth-service

  // Phase 6: 비즈니스 라우트
  await registerRoutes(app);

  // Phase 7: 서버 시작 + 안전 장치
  await app.listen({ port: PORT, host: HOST });
  app.server.keepAliveTimeout = 65000;
  app.server.headersTimeout = 66000;
}
```

### 1.3 핸들러-서비스 분리 패턴

**목적**: HTTP 레이어와 비즈니스 로직 분리

```
요청 -> routes.ts (스키마 + preHandler) -> handler.ts (얇은 레이어) -> lib/ (비즈니스 로직)
```

```typescript
// handlers/login.handler.ts -- HTTP 관심사만 담당
export async function loginHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // 1. 검증 (schemas/ 호출)
  const parseResult = loginSchema.safeParse(request.body);
  if (!parseResult.success) { /* 400 응답 */ return; }

  // 2. 비즈니스 로직 (lib/ 호출)
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  const isValid = await verifyPassword(password, user.passwordHash);
  const accessToken = await signAccessToken({ sub: user.id, /* ... */ });
  await createSession(user.id, { token: accessToken, /* ... */ });

  // 3. 감사 로그 + 응답
  await logAuthEvent('LOGIN_SUCCESS', user.id, tenant.id, ip, userAgent);
  await reply.status(200).send({ success: true, data: { accessToken } });
}
```

**핸들러 책임**: 요청 파싱, 응답 포맷팅, HTTP 상태 코드
**lib 책임**: DB 접근, 암호화, 토큰 발급, 세션 관리

### 1.4 Zod 스키마 검증 패턴

**목적**: 런타임 입력 검증 + 타입 추론 (CSAP D-12)

```typescript
// schemas/login.schema.ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('유효한 이메일 주소를 입력하세요').max(255),
  password: z.string().min(1, '비밀번호를 입력하세요').max(128),
  tenantSlug: z.string().min(1).max(100),
  mfaCode: z.string().length(6).regex(/^\d+$/).optional(),
});

// Zod에서 TypeScript 타입 자동 추출
export type LoginRequest = z.infer<typeof loginSchema>;
```

**이중 검증 전략**:
1. Fastify JSON Schema: 요청 레벨 검증 (빠름, OpenAPI 자동 생성)
2. Zod 스키마: 핸들러 레벨 검증 (정밀, 타입 추론)

### 1.5 Rate Limiting 패턴

**목적**: DoS 방어 + API 남용 방지 (CSAP D-10)

```typescript
// 2단계 Rate Limiting
// 1. API Gateway 레벨: @fastify/rate-limit (전역, 테넌트 키 기반)
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (request) => {
    const tenantId = request.headers['x-tenant-id'];
    return typeof tenantId === 'string' ? `tenant:${tenantId}` : request.ip;
  },
});

// 2. 서비스 레벨: @public-saas/rate-limit (엔드포인트별, Redis 기반)
const LOGIN_RATE_LIMIT = rateLimitMiddleware({
  max: 10,
  windowSeconds: 60,
  keyPrefix: 'ratelimit:login',
});

app.post('/auth/login', { preHandler: LOGIN_RATE_LIMIT }, loginHandler);
```

### 1.6 Circuit Breaker 패턴

**목적**: 서비스 간 장애 전파 방지 (CSAP D-07)

```typescript
// API Gateway에서 Circuit Breaker로 백엔드 서비스 보호
import { circuitBreaker } from './lib/circuit-breaker.js';

// 상태 모니터링 엔드포인트
app.get('/admin/circuits', async (request, reply) => {
  // 내부 인증 확인 (CSAP D-08)
  if (providedKey !== internalKey) {
    await reply.status(403).send({ /* ... */ });
    return;
  }
  return { success: true, data: circuitBreaker.getAllStatus() };
});
```

---

## 2. 공유 패키지 패턴

### 2.1 Event Bus 패턴

**목적**: 서비스 내부 비동기 도메인 이벤트 (CSAP D-06 감사 이벤트)

```typescript
// @public-saas/event-bus 사용 패턴
import { eventBusPlugin } from '@public-saas/event-bus';

// 서비스에 등록
await app.register(eventBusPlugin, {
  maxRetries: 3,
  retryBaseDelay: 1000,
  maxDeadLetters: 100,
});

// 이벤트 구독 (감사 로그 자동 기록)
app.eventBus.on('user:created', async (event) => {
  await auditLogger.log({ action: 'USER_CREATE', target: event.userId });
});

// 이벤트 발행
await app.eventBus.emit('user:created', { userId: user.id, tenantId: tenant.id });
```

### 2.2 Config Vault 패턴

**목적**: 환경 변수 중앙 관리 + 타입 안전 접근

```typescript
// @public-saas/config-vault 사용 패턴
await app.register(configPlugin, {
  defaults: {
    port: 3001,
    host: '0.0.0.0',
    corsOrigin: 'http://localhost:3000',
  },
  envMapping: {
    AUTH_SERVICE_PORT: 'port',
    AUTH_SERVICE_HOST: 'host',
    CORS_ORIGIN: 'corsOrigin',
  },
});

// 타입 안전 접근 (기본값 보장)
const port = app.config.get<number>('port', 3001);
const host = app.config.get<string>('host', '0.0.0.0');
```

### 2.3 Observability 패턴

**목적**: 분산 추적, 구조화 로깅, 메트릭 수집 (CSAP D-10)

```typescript
// 1. 서비스 시작 전 반드시 초기화 (import 순서 중요)
import { initTelemetry, shutdownTelemetry } from '@public-saas/observability';
initTelemetry({ serviceName: 'auth-service', serviceVersion: '0.3.0' });

// 2. 이후 다른 모듈 import
import Fastify from 'fastify';

// 3. 응답 시간 측정 플러그인
import { responseTimePlugin } from '@public-saas/observability';
await app.register(responseTimePlugin);

// 4. 구조화 로깅 (Pino 내장)
app.log.info({ userId: user.id, tenantId: tenant.id }, '사용자 로그인 성공');
app.log.error({ err, errorId }, '내부 오류 발생');
```

### 2.4 Health Check 패턴

**목적**: k8s livenessProbe/readinessProbe 표준화 (CSAP D-07)

```typescript
// CommonCheckers로 의존성 상태 확인
import { healthPlugin, CommonCheckers } from '@public-saas/health';

await app.register(healthPlugin, {
  serviceName: 'auth-service',
  version: '0.3.0',
  checkers: [
    CommonCheckers.database(prisma),                // PostgreSQL
    CommonCheckers.custom('redis', async () => {     // Redis
      const pong = await redis.ping();
      return pong === 'PONG';
    }, 3000),
    CommonCheckers.httpService('user-service',       // 다른 서비스
      'http://user-service:3002/health'),
  ],
});

// 자동 등록 엔드포인트:
// GET /health  -- livenessProbe (서비스 자체 상태)
// GET /ready   -- readinessProbe (의존성 포함)
```

### 2.5 Mesh Ready 패턴

**목적**: 서비스 메시 호환 (분산 추적 전파, 그레이스풀 셧다운)

```typescript
import { meshReadyPlugin } from '@public-saas/mesh-ready';

await app.register(meshReadyPlugin, {
  service: { name: 'auth-service', version: '0.3.0' },
  shutdown: {
    cleanupHandlers: [
      async () => { await shutdownTelemetry(); },   // OTel 종료
      // 추가 정리 작업 (DB 연결 해제 등)
    ],
  },
});

// 사용: 예기치 못한 에러 시 graceful shutdown
process.on('uncaughtException', (err) => {
  app.log.fatal({ err }, '치명적 예외 발생 -- 서비스 종료');
  void app.mesh.shutdown.shutdown(app).then(() => process.exit(1));
});
```

---

## 3. 프론트엔드 패턴

### 3.1 App Shell 패턴

**목적**: 관리 포털의 일관된 레이아웃 구조

```
RootLayout (Server Component)
  +-- AppShell (Client Component)
       +-- ServiceRail (왼쪽 서비스 레일)
       +-- FloatingSidebar (플로팅 사이드바)
       +-- AppNavbar (상단 네비게이션)
       +-- RecentTabsBar (최근 탭)
       +-- {children} (페이지 콘텐츠)
```

```typescript
// components/layout/AppShell.tsx
'use client';
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <ServiceRail />
      <FloatingSidebar />
      <div className="flex-1 flex flex-col">
        <AppNavbar />
        <RecentTabsBar />
        <main className="flex-1 overflow-auto p-4">{children}</main>
      </div>
    </div>
  );
}
```

### 3.2 Server Component 데이터 페칭

**목적**: 클라이언트 번들 최소화, 직접 DB 접근

```typescript
// app/admin/tenants/page.tsx (Server Component)
import { prisma } from '@/lib/prisma';
import { TenantList } from '@/components/admin/TenantList';

export default async function TenantsPage() {
  // Server Component에서 직접 DB 접근 (API 호출 불필요)
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <div>
      <h1>테넌트 관리</h1>
      <TenantList tenants={tenants} />
    </div>
  );
}
```

### 3.3 보안 헤더 미들웨어 패턴

**목적**: CSP nonce 기반 XSS 방지 (CSAP D-12)

```typescript
// middleware.ts -- Next.js 미들웨어
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // 요청 헤더에 nonce 주입 -> layout.tsx에서 읽기
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  // 응답에 보안 헤더 설정
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', cspDirectives.join('; '));
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');

  return response;
}
```

---

## 4. 공공기관 SaaS 특화 패턴

### 4.1 멀티테넌시 격리 패턴

**목적**: 테넌트 간 데이터 격리 (N2SF N-03)

```typescript
// @public-saas/tenant-isolation 패키지 구성:
// - TenantContext:        요청별 테넌트 컨텍스트 관리
// - RowLevelSecurity:     DB 쿼리에 tenantId 자동 주입
// - TenantEncryption:     테넌트별 암호화 키 관리
// - IsolationValidator:   격리 검증 (감리 증적)

// 서비스에 적용
await app.register(tenantIsolationPlugin, {
  masterKey: masterKey || undefined,
  tenantColumn: 'tenant_id',
  requireTenantHeader: true,
  excludePaths: ['/health', '/ready', '/metadata', '/health/detail'],
});
```

**4단계 격리 메커니즘**:

```
1. API Gateway: X-Tenant-Id 헤더 검증
2. 서비스 미들웨어: JWT의 tenantId와 헤더 대조
3. tenantIsolationPlugin: DB 쿼리에 tenantId 자동 주입 (RLS)
4. Prisma: 복합 유니크 제약 (@@unique([tenantId, email]))
```

### 4.2 RBAC 권한 매트릭스 패턴

**목적**: 역할 기반 접근 제어 (CSAP D-08)

```typescript
// @public-saas/rbac 패키지 구성:
// - ROLE_PERMISSIONS:   역할별 권한 매트릭스
// - RBACEngine:         권한 검사 엔진
// - rbacPlugin:         Fastify 플러그인

// 역할 정의 (5개)
type Role = 'super_admin' | 'tenant_admin' | 'user' | 'viewer' | 'auditor';

// 권한 형식: resource:action
// tenant:read, tenant:create, user:update, audit:read

// 라우트별 권한 적용
import { requirePermission, requireAnyPermission } from '@public-saas/rbac';

app.get('/tenants', { preHandler: requirePermission('tenant:read') }, handler);
app.post('/tenants', { preHandler: requirePermission('tenant:create') }, handler);
app.get('/audit-logs', { preHandler: requireAnyPermission(['audit:read']) }, handler);
```

### 4.3 감사 로그 체인 패턴

**목적**: 변조 불가 감사 추적 (CSAP D-06)

```typescript
// @public-saas/audit-sdk 패키지 사용
import { createAuditLogger, createStandardTransport } from '@public-saas/audit-sdk';
import { computeHash, verifyChainIntegrity } from '@public-saas/audit-sdk';

const auditLogger = createAuditLogger({
  serviceName: 'auth-service',
  transport: createStandardTransport('auth-service'),
});

// 감사 로그 기록 (append-only)
await auditLogger.log({
  actor: user.id,
  action: 'LOGIN_SUCCESS',
  target: user.id,
  targetType: 'session',
  tenantId: tenant.id,
  ip: request.ip,
  userAgent: request.headers['user-agent'] ?? 'unknown',
});

// 체인 무결성 검증 (감리 시)
const isValid = await verifyChainIntegrity(auditLogFile);
```

### 4.4 N2SF 데이터 등급 게이트 패턴

**목적**: AI API 전송 전 데이터 등급 검증 (N2SF N-05)

```
요청 -> 등급 확인 -> C/S등급: 차단 (throw)
                 -> O등급: PII 마스킹 -> AI API 전송
```

```typescript
// lib/grade-check.ts
import type { DataGrade } from '@public-saas/types';

export function validateDataGrade(grade: DataGrade): void {
  if (grade === 'C' || grade === 'S') {
    throw new DataGradeViolationError(
      `BLOCKED: ${grade}등급 데이터는 AI API 전송이 금지됩니다 (N2SF N-05)`,
      grade,
    );
  }
}

// lib/pii-masking.ts
export function maskPII(text: string): string {
  // 이메일, 전화번호, 주민번호, 카드번호, IP 마스킹
  // ... (coding-standards.md 참조)
}
```

### 4.5 서비스 간 인증 패턴

**목적**: 내부 서비스 간 안전한 통신 (CSAP D-08)

```typescript
// 서비스 간 인증 미들웨어
export const requireServiceAuth = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const internalKey = process.env['INTERNAL_SERVICE_KEY'];
  const providedKey = request.headers['x-internal-service-key'];

  if (!internalKey || providedKey !== internalKey) {
    await reply.status(403).send({
      success: false,
      error: { code: 'SERVICE_AUTH_REQUIRED', message: '서비스 인증이 필요합니다' },
    });
  }
};

// 내부 전용 엔드포인트에 적용
app.post('/auth/sessions/invalidate', {
  preHandler: requireServiceAuth,
}, invalidateAllSessionsHandler);
```

---

## 5. 인프라 연동 패턴

### 5.1 k8s 호환 서버 설정

```typescript
// 모든 서비스 공통 -- k8s ALB 호환
await app.listen({ port: PORT, host: '0.0.0.0' });  // 0.0.0.0 필수 (컨테이너)
app.server.keepAliveTimeout = 65000;  // ALB 기본 60초보다 길게
app.server.headersTimeout = 66000;    // keepAliveTimeout + 1초
```

### 5.2 Graceful Shutdown

```typescript
// meshReadyPlugin이 SIGTERM/SIGINT를 자동 처리
// 1. 새 요청 거부 시작
// 2. 진행 중인 요청 완료 대기
// 3. cleanupHandlers 실행 (OTel, DB 연결 등)
// 4. 프로세스 종료
```

### 5.3 헬스체크 엔드포인트

```
GET /health     -- k8s livenessProbe (서비스 자체 상태)
GET /ready      -- k8s readinessProbe (의존성 포함)
GET /metadata   -- 서비스 메타데이터 (버전, 이름)
```

---

## 6. 패턴 선택 가이드

### 신규 서비스 생성 시

1. `platform/services/{service-name}/` 디렉토리 생성
2. 서비스 부트스트랩 패턴 (1.2) 적용
3. 필수 플러그인: configPlugin, meshReadyPlugin, responseTimePlugin, healthPlugin, rbacPlugin
4. Zod 스키마 정의 (schemas/)
5. 핸들러 작성 (handlers/)
6. 라우트 등록 (routes.ts)
7. 감사 로그 유틸리티 (lib/audit.ts)

### 신규 공유 패키지 생성 시

1. `platform/packages/{package-name}/` 디렉토리 생성
2. 핵심 기능 구현 (`src/{feature}.ts`)
3. Fastify 플러그인 래핑 (`src/{feature}-plugin.ts`)
4. 엔트리포인트 re-export (`src/index.ts`)
5. package.json 표준 적용

### 신규 프론트엔드 페이지 생성 시

1. `platform/apps/portal/src/app/{route}/page.tsx` 생성
2. Server Component 기본 (데이터 페칭)
3. Client Component는 필요 시에만 (`'use client'`)
4. 보안 헤더 자동 적용 (middleware.ts)

---

## 7. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|-------|
| 1.0.0 | 2026-04-11 | 초기 작성 -- 현재 코드베이스 실측 패턴 기반 | PM Lead (Opus) |
