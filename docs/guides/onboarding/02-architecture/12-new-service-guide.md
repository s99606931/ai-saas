# 새 마이크로서비스 추가 완전 가이드

> **문서 ID**: ONBOARD-ARCH-012
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **대상**: 백엔드 개발자 (신규 서비스 담당)
> **선행 학습**: `02-architecture/09-platform-engineering.md`, `13-contributing.md`
> **관련 CSAP**: D-08 접근 통제, D-12 시스템 개발 보안

---

## 목차

1. [새 서비스 추가 전 체크리스트](#1-새-서비스-추가-전-체크리스트)
2. [서비스 구조 생성 — 단계별](#2-서비스-구조-생성--단계별)
3. [공통 패키지 연동](#3-공통-패키지-연동)
4. [Fastify 서비스 보일러플레이트](#4-fastify-서비스-보일러플레이트)
5. [Kubernetes 배포 설정](#5-kubernetes-배포-설정)
6. [Gitea Actions 파이프라인 연동](#6-gitea-actions-파이프라인-연동)
7. [CSAP 신규 서비스 등록 절차](#7-csap-신규-서비스-등록-절차)
8. [실습: "feedback-service" 추가해보기](#8-실습-feedback-service-추가해보기)

---

## 1. 새 서비스 추가 전 체크리스트

### 1.1 기존 서비스로 해결 가능한가?

새 서비스를 추가하기 전에 반드시 다음 질문에 답해야 합니다. 마이크로서비스 분리는 복잡도와 운영 비용을 높이므로, 충분한 이유 없이 서비스를 추가해서는 안 됩니다.

**서비스 분리 기준:**

| 분리해야 하는 경우 | 분리하지 말아야 하는 경우 |
|-------------------|--------------------------|
| 독립적인 배포 주기가 필요한 경우 | 기존 서비스의 기능 확장인 경우 |
| 다른 기술 스택이 필요한 경우 | 단순 API 엔드포인트 추가인 경우 |
| 독립적인 확장(HPA)이 필요한 경우 | 팀이 1~2명인 경우 (운영 부담) |
| 명확한 DDD 바운디드 컨텍스트인 경우 | 개발 기간 2주 미만인 소규모 기능 |

**현재 서비스 목록 확인:**

```bash
ls /data/ai-saas/platform/services/
# ai-service, auth-service, billing-service, catalog-service,
# compliance-service, crm-service, file-service, menu-service,
# notification-service, saas-catalog-service, security-monitor-service,
# security-service, subscription-service, tenant-service, user-service
```

예를 들어 "사용자 피드백 수집" 기능은 `user-service`에 엔드포인트를 추가해도 충분할 수 있습니다. 반면 "피드백 AI 분석 + 리포팅 + 외부 연동"이 필요하다면 독립 서비스가 타당합니다.

### 1.2 DDD 바운디드 컨텍스트 설계 먼저

서비스를 분리하기로 결정했다면, 코드 작성 전에 도메인 경계를 설계합니다.

**바운디드 컨텍스트 설계 질문:**
- 이 서비스가 소유하는 집합체(Aggregate)는 무엇인가?
- 다른 서비스와 어떤 이벤트로 통신하는가?
- 이 서비스가 사용하는 데이터 스키마는 독립적인가?

**예시: feedback-service 바운디드 컨텍스트**

```
Feedback Aggregate (소유)
  - Feedback { id, tenantId, userId, content, rating, status }
  - FeedbackTag { id, feedbackId, tag }

발행 이벤트
  - feedback.created: 새 피드백 제출 시
  - feedback.resolved: 담당자 답변 완료 시

구독 이벤트
  - user.deleted: 사용자 삭제 시 피드백 익명화

의존 서비스 (읽기 전용)
  - auth-service: 토큰 검증
  - tenant-service: 테넌트 정보
```

### 1.3 Plan + Design 문서 완비 (CLAUDE.md §1 요건)

**구현 착수 전 반드시 완료:**

```bash
# Plan 문서 작성 (요구사항 + 성공 기준 + 보안 분석)
docs/01-plan/mtus/SVC-{서비스명}-R1.plan.md

# Design 문서 작성 (API 명세 + 데이터 모델 + 시퀀스 다이어그램)
docs/02-design/mtus/SVC-{서비스명}-R1.design.md
```

문서 없는 구현은 감리 결함입니다. (CLAUDE.md §1 절대 제약)

### 1.4 보안팀 사전 리뷰 (CSAP 신규 서비스 등록)

신규 서비스 추가 시 보안팀에 다음 사항을 사전 통보합니다.

```
통보 내용:
1. 서비스명 및 포트 번호
2. 처리하는 데이터의 N2SF 등급 (C/S/O)
3. 외부 연동 여부 (AI API 포함)
4. 네트워크 정책 (어떤 서비스에서 접근 가능한지)
5. 예상 민감 작업 목록 (CSAP 감사 이벤트 코드)
```

---

## 2. 서비스 구조 생성 — 단계별

### 2.1 pnpm workspace에 새 서비스 추가

워크스페이스 설정 파일: `/data/ai-saas/pnpm-workspace.yaml`

```yaml
# 이미 platform/services/* 가 포함되어 있으므로
# 새 서비스를 platform/services/ 하위에 생성하면 자동으로 워크스페이스에 포함됩니다
packages:
  - "platform/apps/*"
  - "platform/services/*"   ← 여기에 자동 포함
  - "platform/packages/*"
```

**새 서비스 디렉토리 생성:**

```bash
# 서비스 이름: feedback-service
mkdir -p /data/ai-saas/platform/services/feedback-service/src/{handlers,lib}
mkdir -p /data/ai-saas/platform/services/feedback-service/tests
```

### 2.2 디렉토리 구조 (notification-service 기반)

실제 운영 중인 `notification-service`의 구조를 기준으로 합니다.

```
platform/services/feedback-service/
  src/
    handlers/           ← 각 도메인별 HTTP 핸들러
      feedback.handler.ts     - 피드백 CRUD
      response.handler.ts     - 담당자 답변
      analytics.handler.ts    - 통계/분석
    lib/                ← 비즈니스 로직 + 인프라
      prisma.ts              - Prisma 클라이언트 싱글톤
      audit.ts               - CSAP 감사 로그 유틸
      event-bus.ts           - 이벤트 발행/구독
    index.ts            ← 서비스 진입점 (Fastify 앱 구동)
    routes.ts           ← 라우트 등록 (모든 엔드포인트)
  tests/
    feedback.test.ts         - 단위 테스트
    feedback.e2e.test.ts     - 통합 테스트
  Dockerfile
  package.json
  tsconfig.json
  prisma/
    schema.prisma      ← 이 서비스의 데이터 모델
```

```mermaid
graph TD
    subgraph "feedback-service"
        IDX["index.ts<br/>Fastify 앱 시작"]
        RTS["routes.ts<br/>엔드포인트 등록"]
        FH["handlers/<br/>feedback.handler.ts<br/>response.handler.ts"]
        LIB["lib/<br/>prisma.ts<br/>audit.ts<br/>event-bus.ts"]
        PKG["공유 패키지<br/>@public-saas/auth-sdk<br/>@public-saas/rbac<br/>@public-saas/mesh-ready"]
        DB[("PostgreSQL<br/>feedback 스키마")]
        MB["이벤트 버스<br/>(메모리/Redis)"]
    end

    IDX -->|등록| RTS
    RTS -->|핸들러 연결| FH
    FH -->|비즈니스 로직| LIB
    LIB -->|쿼리| DB
    LIB -->|이벤트 발행| MB
    IDX -->|플러그인| PKG
```

### 2.3 package.json 설정

`notification-service/package.json` 구조를 그대로 따릅니다.

```json
{
  "name": "@public-saas/feedback-service",
  "version": "0.1.0",
  "private": true,
  "description": "공공기관 SaaS 플랫폼 — 피드백 서비스",
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/ --max-warnings 0",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@prisma/client": "^6.0.0",
    "@public-saas/audit-sdk": "workspace:*",
    "@public-saas/auth-sdk": "workspace:*",
    "@public-saas/health": "workspace:*",
    "@public-saas/mesh-ready": "workspace:*",
    "@public-saas/observability": "workspace:*",
    "@public-saas/rate-limit": "workspace:*",
    "@public-saas/rbac": "workspace:*",
    "@public-saas/config-vault": "workspace:*",
    "@public-saas/event-bus": "workspace:*",
    "@public-saas/types": "workspace:*",
    "fastify": "^5.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "prisma": "^6.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

**의존성 설치:**

```bash
cd /data/ai-saas
pnpm install
# pnpm이 workspace:* 심볼릭 링크를 자동으로 구성합니다
```

---

## 3. 공통 패키지 연동

### 3.1 `@public-saas/auth-sdk` — 인증/인가 적용

모든 서비스는 auth-sdk를 통해 JWT 토큰을 검증합니다.

```typescript
// src/handlers/feedback.handler.ts
import { verifyToken } from '@public-saas/auth-sdk';
import type { FastifyRequest, FastifyReply } from 'fastify';

// CSAP D-08: 모든 엔드포인트에 토큰 검증 필수
export async function createFeedbackHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // 1. 토큰 검증 (auth-sdk)
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return reply.status(401).send({ error: '인증 토큰이 없습니다' });
  }

  const user = await verifyToken(token);
  if (!user) {
    return reply.status(401).send({ error: '유효하지 않은 토큰입니다' });
  }

  // 2. 이후 비즈니스 로직 (user 정보 사용 가능)
  const body = feedbackCreateSchema.parse(request.body);
  // ...
}
```

### 3.2 `@public-saas/rbac` — 권한 검사

```typescript
// src/routes.ts
import { rbacPlugin } from '@public-saas/rbac';
import { checkPermission } from '@public-saas/rbac';

// 플러그인 등록 (index.ts에서)
await app.register(rbacPlugin, {});

// 핸들러에서 권한 검사
export async function deleteFeedbackHandler(request, reply) {
  const user = await verifyToken(request.headers.authorization!);

  // CSAP D-08: RBAC 검사
  const canDelete = await checkPermission(user, 'feedback:delete', {
    tenantId: request.params.tenantId,
    resourceId: request.params.feedbackId,
  });

  if (!canDelete) {
    return reply.status(403).send({ error: '권한이 없습니다' });
  }

  // 이후 삭제 로직...
}
```

**권한 코드 등록 (RBAC 관리 콘솔에서):**

```
feedback:create  — 피드백 제출
feedback:read    — 피드백 조회
feedback:delete  — 피드백 삭제 (관리자)
feedback:respond — 담당자 답변 (담당자 역할)
```

### 3.3 `@public-saas/audit-sdk` — 감사 로그

```typescript
// src/lib/audit.ts
import { auditLog } from '@public-saas/audit-sdk';

// CSAP D-06: 모든 민감 작업에 감사 로그 필수
export async function logFeedbackEvent(
  action: 'FEEDBACK_CREATE' | 'FEEDBACK_DELETE' | 'FEEDBACK_RESPOND',
  actor: string,
  feedbackId: string,
  tenantId: string,
  ip: string,
  details?: Record<string, unknown>
): Promise<void> {
  await auditLog({
    action,
    actor,
    resource: 'feedback',
    resourceId: feedbackId,
    tenantId,
    ip,
    timestamp: new Date().toISOString(),
    details: details ?? {},
  });
}
```

**핸들러에서 사용:**

```typescript
export async function deleteFeedbackHandler(request, reply) {
  // 삭제 전 감사 로그 (CSAP D-06: 민감 작업 전 기록)
  await logFeedbackEvent(
    'FEEDBACK_DELETE',
    user.id,
    params.feedbackId,
    params.tenantId,
    request.ip,
    { reason: body.reason }
  );

  await prisma.feedback.delete({ where: { id: params.feedbackId } });
  reply.status(204).send();
}
```

### 3.4 `@public-saas/mesh-ready` — 헬스체크 + 추적 컨텍스트

notification-service의 실제 연동 패턴을 그대로 사용합니다.

```typescript
// src/index.ts
import { meshReadyPlugin } from '@public-saas/mesh-ready';
import { healthPlugin, CommonCheckers } from '@public-saas/health';

async function main(): Promise<void> {
  const app = Fastify({ logger: { level: process.env['LOG_LEVEL'] ?? 'info' } });

  // mesh-ready: 서비스 메타데이터 + 추적 + 셧다운
  await app.register(meshReadyPlugin, {
    service: {
      name: 'feedback-service',
      version: '0.1.0',
      dependencies: ['auth-service', 'tenant-service'],
    },
    shutdown: {
      timeout: 30_000,
      cleanupHandlers: [
        async () => { await prisma.$disconnect(); },
      ],
    },
  });

  // 헬스체크: /health, /ready 엔드포인트 자동 등록
  const { prisma } = await import('./lib/prisma.js');
  await app.register(healthPlugin, {
    serviceName: 'feedback-service',
    version: '0.1.0',
    checkers: [CommonCheckers.database(prisma)],
  });
}
```

**헬스체크 응답 확인:**

```bash
curl http://localhost:3015/health
# {"status":"ok","service":"feedback-service","version":"0.1.0","uptime":42}

curl http://localhost:3015/ready
# {"status":"ready","checks":{"database":"ok"}}
# (DB 연결 실패 시 {"status":"not-ready","checks":{"database":"fail"}})
```

---

## 4. Fastify 서비스 보일러플레이트

### 4.1 `src/index.ts` — 서비스 진입점

notification-service의 index.ts 패턴을 기반으로 feedback-service를 구성합니다.

```typescript
// platform/services/feedback-service/src/index.ts
// Design Ref: SVC-FEEDBACK-R1 DESIGN §1
// Plan SC: FR-FB.1~FR-FB.5
// CSAP: D-06 감사 로그, D-08 접근 통제, D-12 개발 보안

import { initTelemetry, shutdownTelemetry } from '@public-saas/observability';

// OTel SDK를 가장 먼저 초기화 (다른 import 전에)
initTelemetry({
  serviceName: 'feedback-service',
  serviceVersion: '0.1.0'
});

import Fastify from 'fastify';
import { responseTimePlugin } from '@public-saas/observability';
import { healthPlugin, CommonCheckers } from '@public-saas/health';
import { rbacPlugin } from '@public-saas/rbac';
import { meshReadyPlugin } from '@public-saas/mesh-ready';
import { configPlugin } from '@public-saas/config-vault';
import { eventBusPlugin } from '@public-saas/event-bus';

async function main(): Promise<void> {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      serializers: {
        // CSAP D-12: 로그에서 민감 정보 제거
        req(request) {
          return {
            method: request.method,
            url: request.url,
            remoteAddress: request.ip,
          };
        },
      },
    },
  });

  // 환경 설정 플러그인 (config-vault)
  await app.register(configPlugin, {
    defaults: { port: 3015, host: '0.0.0.0' },
    envMapping: { FEEDBACK_SERVICE_PORT: 'port' },
  });

  const PORT = app.config.get<number>('port', 3015);
  const HOST = app.config.get<string>('host', '0.0.0.0');

  // mesh-ready: 추적 + 셧다운 + 메타데이터
  await app.register(meshReadyPlugin, {
    service: {
      name: 'feedback-service',
      version: '0.1.0',
      dependencies: ['auth-service', 'tenant-service'],
    },
    shutdown: {
      cleanupHandlers: [
        async () => { await shutdownTelemetry(); },
      ],
    },
  });

  // 응답 시간 메트릭
  await app.register(responseTimePlugin);

  // 헬스체크
  const { prisma } = await import('./lib/prisma.js');
  await app.register(healthPlugin, {
    serviceName: 'feedback-service',
    version: '0.1.0',
    checkers: [CommonCheckers.database(prisma)],
  });

  // RBAC 플러그인
  await app.register(rbacPlugin, {});

  // 이벤트 버스
  await app.register(eventBusPlugin, {
    maxRetries: 3,
    retryBaseDelay: 1000,
  });

  // 이벤트 구독: user.deleted → 피드백 익명화
  app.events.on('user.deleted', async (payload) => {
    app.log.info({ userId: payload.userId }, '사용자 삭제 이벤트: 피드백 익명화 시작');
    // 익명화 로직 호출
  });

  // 라우트 등록
  const { registerRoutes } = await import('./routes.js');
  await registerRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`피드백 서비스 기동: http://${HOST}:${PORT}`);

  // 미처리 예외 핸들러
  process.on('uncaughtException', (err) => {
    app.log.fatal({ err }, '치명적 예외 — 서비스 종료');
    void app.mesh.shutdown.shutdown(app).then(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason) => {
    app.log.error({ reason }, '미처리 Promise rejection');
  });
}

main().catch((err) => {
  process.stderr.write(`피드백 서비스 기동 실패: ${String(err)}\n`);
  process.exit(1);
});
```

### 4.2 `src/routes.ts` — 라우트 등록

```typescript
// platform/services/feedback-service/src/routes.ts
// CSAP: D-08-06 Rate Limiting

import type { FastifyInstance } from 'fastify';
import { createRateLimiter } from '@public-saas/rate-limit';
import {
  createFeedbackHandler,
  getFeedbackHandler,
  listFeedbacksHandler,
  deleteFeedbackHandler,
} from './handlers/feedback.handler.js';
import { respondToFeedbackHandler } from './handlers/response.handler.js';
import { feedbackAnalyticsHandler } from './handlers/analytics.handler.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // CSAP D-08: 내부 서비스 인증
  const internalKey = process.env['INTERNAL_SERVICE_KEY'];
  if (!internalKey && process.env['NODE_ENV'] === 'production') {
    throw new Error('[SECURITY] INTERNAL_SERVICE_KEY 환경변수 누락');
  }
  if (internalKey) {
    app.addHook('onRequest', async (request, reply) => {
      if (request.url === '/health' || request.url === '/ready' || request.url === '/metrics') return;
      const provided = request.headers['x-internal-service-key'];
      if (provided !== internalKey) {
        await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '내부 서비스 인증 실패' },
        });
      }
    });
  }

  // Rate Limiter 설정
  const readLimiter = createRateLimiter(100, 60, 'rl:feedback:read');
  const writeLimiter = createRateLimiter(30, 60, 'rl:feedback:write');

  // OpenAPI 공통 스키마
  const successResponse = {
    type: 'object' as const,
    properties: { success: { type: 'boolean' as const }, data: { type: 'object' as const } },
  };
  const errorResponse = {
    type: 'object' as const,
    properties: { success: { type: 'boolean' as const }, error: { type: 'object' as const } },
  };

  // FR-FB.1: 피드백 제출
  app.post(
    '/feedback',
    {
      schema: {
        description: '피드백 제출',
        tags: ['feedback'],
        body: {
          type: 'object' as const,
          required: ['tenantId', 'content', 'rating'] as const,
          properties: {
            tenantId: { type: 'string' as const, format: 'uuid' },
            content: { type: 'string' as const, minLength: 1, maxLength: 2000 },
            rating: { type: 'integer' as const, minimum: 1, maximum: 5 },
            category: { type: 'string' as const, maxLength: 50 },
          },
        },
        response: { 201: successResponse, 400: errorResponse, 401: errorResponse },
      },
      preHandler: writeLimiter,
    },
    createFeedbackHandler as never,
  );

  // FR-FB.2: 피드백 조회
  app.get(
    '/feedback/:id',
    {
      schema: {
        description: '피드백 단건 조회',
        tags: ['feedback'],
        params: {
          type: 'object' as const,
          properties: { id: { type: 'string' as const, format: 'uuid' } },
        },
        response: { 200: successResponse, 404: errorResponse },
      },
      preHandler: readLimiter,
    },
    getFeedbackHandler as never,
  );

  // FR-FB.3: 피드백 목록 조회
  app.get(
    '/feedback',
    {
      schema: {
        description: '피드백 목록 조회 (테넌트별)',
        tags: ['feedback'],
        querystring: {
          type: 'object' as const,
          properties: {
            tenantId: { type: 'string' as const, format: 'uuid' },
            page: { type: 'integer' as const, default: 1 },
            limit: { type: 'integer' as const, default: 20, maximum: 100 },
            status: { type: 'string' as const, enum: ['open', 'resolved', 'all'] },
          },
        },
        response: { 200: successResponse },
      },
      preHandler: readLimiter,
    },
    listFeedbacksHandler as never,
  );

  // FR-FB.4: 피드백 삭제 (관리자)
  app.delete(
    '/feedback/:id',
    {
      schema: {
        description: '피드백 삭제 (관리자 전용)',
        tags: ['feedback'],
        params: {
          type: 'object' as const,
          properties: { id: { type: 'string' as const, format: 'uuid' } },
        },
        response: { 204: { type: 'null' as const }, 403: errorResponse },
      },
      preHandler: writeLimiter,
    },
    deleteFeedbackHandler as never,
  );

  // FR-FB.5: 담당자 답변
  app.post(
    '/feedback/:id/respond',
    {
      schema: {
        description: '피드백 답변 (담당자 전용)',
        tags: ['feedback'],
        body: {
          type: 'object' as const,
          required: ['response'] as const,
          properties: {
            response: { type: 'string' as const, minLength: 1, maxLength: 5000 },
          },
        },
        response: { 200: successResponse, 403: errorResponse },
      },
      preHandler: writeLimiter,
    },
    respondToFeedbackHandler as never,
  );

  // FR-FB.6: 통계/분석
  app.get(
    '/feedback/analytics',
    {
      schema: {
        description: '피드백 통계 (테넌트별)',
        tags: ['feedback'],
        querystring: {
          type: 'object' as const,
          properties: {
            tenantId: { type: 'string' as const, format: 'uuid' },
            days: { type: 'integer' as const, default: 30 },
          },
        },
        response: { 200: successResponse },
      },
      preHandler: readLimiter,
    },
    feedbackAnalyticsHandler as never,
  );
}
```

### 4.3 핸들러 패턴 — 실제 서비스 기반

```typescript
// src/handlers/feedback.handler.ts
// Design Ref: SVC-FEEDBACK-R1 DESIGN §2
// Plan SC: FR-FB.1

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logFeedbackEvent } from '../lib/audit.js';
import { verifyToken } from '@public-saas/auth-sdk';

// CSAP D-12: Zod 스키마로 모든 입력 검증
const feedbackCreateSchema = z.object({
  tenantId: z.string().uuid(),
  content: z.string().min(1).max(2000),
  rating: z.number().int().min(1).max(5),
  category: z.string().max(50).optional(),
});

type FeedbackCreateBody = z.infer<typeof feedbackCreateSchema>;

export async function createFeedbackHandler(
  request: FastifyRequest<{ Body: FeedbackCreateBody }>,
  reply: FastifyReply
): Promise<void> {
  // 1. 입력 검증 (CSAP D-12)
  const body = feedbackCreateSchema.parse(request.body);

  // 2. 인증 (CSAP D-08)
  const token = request.headers.authorization?.replace('Bearer ', '');
  const user = await verifyToken(token ?? '');
  if (!user) {
    return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED' } });
  }

  try {
    // 3. 비즈니스 로직 — 매개변수화 쿼리 (CSAP D-12)
    const feedback = await prisma.feedback.create({
      data: {
        tenantId: body.tenantId,
        userId: user.id,
        content: body.content,  // SQL 주입 방지: Prisma가 자동 처리
        rating: body.rating,
        category: body.category ?? null,
        status: 'open',
      },
    });

    // 4. 감사 로그 (CSAP D-06)
    await logFeedbackEvent(
      'FEEDBACK_CREATE',
      user.id,
      feedback.id,
      body.tenantId,
      request.ip,
      { rating: body.rating, category: body.category }
    );

    // 5. 이벤트 발행 (다른 서비스 통지)
    await request.app.events.emit('feedback.created', {
      feedbackId: feedback.id,
      tenantId: body.tenantId,
      userId: user.id,
    });

    return reply.status(201).send({
      success: true,
      data: {
        id: feedback.id,
        status: feedback.status,
        createdAt: feedback.createdAt,
      },
    });
  } catch (err) {
    // CSAP D-12: 에러 메시지에 민감 정보 노출 금지
    request.log.error(err, '피드백 생성 실패');
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '피드백 생성 중 오류가 발생했습니다.' },
    });
  }
}
```

### 4.4 Prisma 통합

```prisma
// prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Feedback {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @db.Uuid
  userId    String   @db.Uuid
  content   String   @db.VarChar(2000)
  rating    Int
  category  String?  @db.VarChar(50)
  status    String   @default("open") @db.VarChar(20)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  responses FeedbackResponse[]

  @@index([tenantId])
  @@index([userId])
  @@index([status])
}

model FeedbackResponse {
  id         String   @id @default(uuid()) @db.Uuid
  feedbackId String   @db.Uuid
  responderId String  @db.Uuid
  content    String   @db.VarChar(5000)
  createdAt  DateTime @default(now())
  feedback   Feedback @relation(fields: [feedbackId], references: [id], onDelete: Cascade)

  @@index([feedbackId])
}
```

**마이그레이션 실행:**

```bash
cd /data/ai-saas/platform/services/feedback-service

# 마이그레이션 파일 생성
pnpm prisma migrate dev --name init-feedback-schema

# Prisma Client 재생성
pnpm prisma generate
```

### 4.5 요청 처리 흐름도

```mermaid
sequenceDiagram
    participant C as 클라이언트
    participant GW as API Gateway
    participant FB as feedback-service
    participant AUTH as auth-service
    participant DB as PostgreSQL
    participant EB as Event Bus

    C->>GW: POST /api/feedback {tenantId, content, rating}
    GW->>GW: JWT 검증 + Rate Limit 체크
    GW->>FB: POST /feedback (x-internal-service-key)

    FB->>FB: Zod 스키마 검증 (CSAP D-12)
    FB->>AUTH: verifyToken(JWT)
    AUTH-->>FB: {userId, tenantId, roles}

    FB->>DB: prisma.feedback.create(...)
    DB-->>FB: {id, status, createdAt}

    FB->>FB: logFeedbackEvent('FEEDBACK_CREATE')
    FB->>FB: audit.jsonl 기록 (CSAP D-06)

    FB->>EB: emit('feedback.created', {feedbackId})
    EB-->>FB: 발행 완료

    FB-->>GW: 201 {success:true, data:{id, status}}
    GW-->>C: 201 Created
```

---

## 5. Kubernetes 배포 설정

### 5.1 Helm 차트 구조

```
k8s/services/feedback-service/
  Chart.yaml
  values.yaml
  templates/
    deployment.yaml
    service.yaml
    hpa.yaml
    networkpolicy.yaml
    servicemonitor.yaml
```

**Chart.yaml:**

```yaml
apiVersion: v2
name: feedback-service
description: 공공기관 SaaS 플랫폼 — 피드백 서비스
type: application
version: 0.1.0
appVersion: "0.1.0"
```

### 5.2 values.yaml 설정

```yaml
# k8s/services/feedback-service/values.yaml

replicaCount: 2

image:
  repository: gitea.example.go.kr/saas/feedback-service
  pullPolicy: IfNotPresent
  tag: "0.1.0"

service:
  type: ClusterIP
  port: 3015

resources:
  requests:
    cpu: "100m"
    memory: "128Mi"
  limits:
    cpu: "500m"
    memory: "512Mi"

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

env:
  NODE_ENV: production
  LOG_LEVEL: info
  FEEDBACK_SERVICE_PORT: "3015"

# 시크릿은 Kubernetes Secret으로 별도 관리
envFromSecrets:
  - name: feedback-service-secrets
    keys:
      - DATABASE_URL
      - INTERNAL_SERVICE_KEY

# Linkerd 사이드카 주입
podAnnotations:
  linkerd.io/inject: enabled

# 헬스체크 설정
livenessProbe:
  httpGet:
    path: /health
    port: 3015
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /ready
    port: 3015
  initialDelaySeconds: 5
  periodSeconds: 10
```

### 5.3 HPA 설정

```yaml
# templates/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: feedback-service
  namespace: saas-system
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: feedback-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### 5.4 NetworkPolicy — 기본 격리

```yaml
# templates/networkpolicy.yaml
# CSAP D-10: 네트워크 보안 — 최소 권한 원칙
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: feedback-service-netpol
  namespace: saas-system
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: feedback-service
  policyTypes:
    - Ingress
    - Egress

  ingress:
    # API Gateway에서만 수신 허용
    - from:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: api-gateway
      ports:
        - port: 3015
    # 헬스체크: Prometheus에서 수신 허용
    - from:
        - namespaceSelector:
            matchLabels:
              name: monitoring
      ports:
        - port: 3015  # /metrics 경로

  egress:
    # PostgreSQL 접근 허용
    - to:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: postgresql
      ports:
        - port: 5432
    # auth-service 호출 허용
    - to:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: auth-service
      ports:
        - port: 3001
    # DNS 허용 (필수)
    - ports:
        - port: 53
          protocol: UDP
```

### 5.5 Linkerd 어노테이션

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: feedback-service
spec:
  template:
    metadata:
      annotations:
        # Linkerd 서비스 메시 사이드카 주입
        linkerd.io/inject: enabled
        # Prometheus 메트릭 수집 설정
        prometheus.io/scrape: "true"
        prometheus.io/port: "3015"
        prometheus.io/path: "/metrics"
```

---

## 6. Gitea Actions 파이프라인 연동

### 6.1 기존 CI/CD가 새 서비스를 자동 감지하는 방법

우리 프로젝트의 CI/CD는 Turborepo DAG를 사용하여 변경된 패키지만 빌드합니다. 새 서비스를 `platform/services/` 아래에 추가하면 자동으로 파이프라인에 포함됩니다.

```yaml
# .gitea/workflows/ci.yml (기존)
- name: Build affected services
  run: |
    pnpm turbo build --filter=...[HEAD^1]
    # ↑ 변경된 패키지와 그 의존성만 빌드
    # feedback-service가 변경되면 자동으로 포함됨
```

### 6.2 Turbo DAG에 새 서비스 추가

`turbo.json`에 명시적 설정이 필요한 경우는 커스텀 빌드 의존성이 있을 때입니다.

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],  // ^: 의존 패키지 먼저 빌드
      "outputs": ["dist/**"]
    },
    "@public-saas/feedback-service#build": {
      "dependsOn": [
        "^build",
        "@public-saas/auth-sdk#build",
        "@public-saas/mesh-ready#build"
      ]
    }
  }
}
```

### 6.3 Q-Gate 자동 적용 확인

기존 Q-Gate 워크플로우는 모든 서비스에 자동 적용됩니다.

```bash
# Q-Gate 확인 (신규 서비스 포함)
pnpm --filter @public-saas/feedback-service lint    # G3
pnpm --filter @public-saas/feedback-service test    # G4
pnpm --filter @public-saas/feedback-service typecheck # G3

# 전체 Q-Gate 실행
pnpm turbo lint test typecheck --filter=@public-saas/feedback-service
```

**CI/CD 파이프라인에서 Q-Gate 통과 조건:**

```yaml
# .gitea/workflows/q-gate.yml
jobs:
  quality-gate:
    steps:
      - name: G3 코드 품질
        run: pnpm turbo lint --filter=...[HEAD^1]

      - name: G4 테스트 커버리지
        run: |
          pnpm turbo test --filter=...[HEAD^1]
          # 커버리지 80% 미달 시 실패

      - name: G5 보안 스캔
        run: pnpm turbo audit:security --filter=...[HEAD^1]
```

---

## 7. CSAP 신규 서비스 등록 절차

### 7.1 CSAP 시스템 목록 업데이트

CSAP 인증을 유지하려면 새 서비스를 시스템 목록에 등록해야 합니다.

```bash
# 시스템 목록 파일 업데이트
docs/07-security/csap-system-inventory.yaml
```

```yaml
# 추가 내용
services:
  - name: feedback-service
    version: "0.1.0"
    port: 3015
    dataGrade: "O"          # 처리 데이터 최고 등급
    externalConnections: [] # 외부 연동 없음
    addedDate: "2026-04-12"
    owner: "플랫폼팀"
    csapControls:
      - D-08  # 접근 통제
      - D-06  # 감사 로그
      - D-12  # 개발 보안
```

### 7.2 감사 로그 이벤트 코드 등록

새 서비스의 감사 이벤트 코드를 중앙 레지스트리에 등록합니다.

```bash
# 이벤트 코드 레지스트리
docs/07-security/audit-event-registry.yaml
```

```yaml
# feedback-service 이벤트 코드 추가
events:
  FEEDBACK_CREATE:
    service: feedback-service
    severity: INFO
    description: "사용자가 피드백을 제출함"
    retentionDays: 365    # CSAP D-06: 1년 보존
    piiIncluded: false

  FEEDBACK_DELETE:
    service: feedback-service
    severity: WARN
    description: "관리자가 피드백을 삭제함"
    retentionDays: 365
    piiIncluded: false
    requiresApproval: true  # 삭제는 결재 필요

  FEEDBACK_RESPOND:
    service: feedback-service
    severity: INFO
    description: "담당자가 피드백에 답변함"
    retentionDays: 365
    piiIncluded: false
```

### 7.3 보안 위협 모델 문서 작성

```bash
# 파일 생성
docs/07-security/threat-models/feedback-service-threat-model.md
```

최소 포함 내용:

```markdown
# feedback-service 위협 모델

## 처리 데이터
- 피드백 내용 (O 등급, PII 포함 가능)
- 사용자 ID, 테넌트 ID (UUID — 개인 식별 불가)

## 위협 목록 (STRIDE 분석)
| 위협 | 설명 | 완화 방법 |
|------|------|-----------|
| Spoofing | 타인 명의 피드백 제출 | JWT 토큰 검증 (auth-sdk) |
| Tampering | 피드백 내용 변조 | 불변 데이터 모델 + 감사 로그 |
| Information Disclosure | 타 테넌트 피드백 노출 | tenantId 기반 격리 쿼리 |
| Elevation of Privilege | 일반 사용자가 삭제 권한 획득 | RBAC + 권한 검사 |

## 보안 통제
- CSAP D-08: 모든 엔드포인트 인증/인가 적용
- CSAP D-12: Zod 입력 검증 + Prisma 매개변수화 쿼리
- N2SF: PII 포함 피드백은 AI 전송 전 마스킹 필수
```

---

## 8. 실습: "feedback-service" 추가해보기

### 8.1 피드백 서비스 스펙

이 실습에서 구현할 피드백 서비스의 최종 API 스펙입니다.

| 엔드포인트 | 기능 | 접근 권한 |
|-----------|------|-----------|
| `POST /feedback` | 피드백 제출 | 인증된 사용자 |
| `GET /feedback/:id` | 피드백 조회 | 작성자 또는 관리자 |
| `GET /feedback` | 피드백 목록 | 관리자 |
| `DELETE /feedback/:id` | 피드백 삭제 | 관리자 |
| `POST /feedback/:id/respond` | 담당자 답변 | 담당자 역할 |
| `GET /feedback/analytics` | 통계 조회 | 관리자 |

### 8.2 단계별 구현 가이드

**단계 1: 디렉토리 + package.json 생성 (15분)**

```bash
mkdir -p /data/ai-saas/platform/services/feedback-service/src/{handlers,lib}
mkdir -p /data/ai-saas/platform/services/feedback-service/tests
mkdir -p /data/ai-saas/platform/services/feedback-service/prisma

# package.json 생성 (섹션 2.3 내용 사용)
# tsconfig.json 생성 (notification-service의 tsconfig.json 복사 후 수정)
cp /data/ai-saas/platform/services/notification-service/tsconfig.json \
   /data/ai-saas/platform/services/feedback-service/tsconfig.json

# 의존성 설치
cd /data/ai-saas && pnpm install
```

**단계 2: Prisma 스키마 + 마이그레이션 (20분)**

```bash
cd /data/ai-saas/platform/services/feedback-service

# schema.prisma 생성 (섹션 4.4 내용 사용)
# 마이그레이션 실행
pnpm prisma migrate dev --name init-feedback-schema
pnpm prisma generate
```

**단계 3: 핵심 파일 구현 (60분)**

구현 순서:
1. `src/lib/prisma.ts` — Prisma 클라이언트 싱글톤
2. `src/lib/audit.ts` — 감사 로그 유틸
3. `src/handlers/feedback.handler.ts` — CRUD 핸들러
4. `src/handlers/response.handler.ts` — 답변 핸들러
5. `src/routes.ts` — 라우트 등록
6. `src/index.ts` — 서비스 진입점

```typescript
// src/lib/prisma.ts (가장 먼저 구현)
import { PrismaClient } from '@prisma/client';

// 싱글톤 패턴: 프로세스 당 1개의 DB 연결 풀
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env['NODE_ENV'] === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

**단계 4: 테스트 작성 (30분)**

```typescript
// tests/feedback.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prisma 모킹
vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    feedback: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe('피드백 핸들러 단위 테스트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('유효한 피드백 제출이 201을 반환한다', async () => {
    const { prisma } = await import('../src/lib/prisma.js');
    (prisma.feedback.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'uuid-1',
      status: 'open',
      createdAt: new Date(),
    });

    // 핸들러 직접 테스트 (Fastify inject 사용)
    // ...
  });

  it('rating이 1~5 범위를 벗어나면 400을 반환한다', async () => {
    // Zod 스키마 검증 테스트
    // ...
  });

  it('인증 토큰이 없으면 401을 반환한다', async () => {
    // auth-sdk 모킹 후 401 반환 확인
    // ...
  });
});
```

**단계 5: 로컬 실행 + 검증 (20분)**

```bash
cd /data/ai-saas/platform/services/feedback-service

# 로컬 개발 서버 실행
DATABASE_URL="postgresql://user:pass@localhost:5432/saas_dev" \
INTERNAL_SERVICE_KEY="dev-key" \
NODE_ENV="development" \
pnpm dev

# 다른 터미널에서 테스트
curl -X POST http://localhost:3015/feedback \
  -H "Content-Type: application/json" \
  -H "x-internal-service-key: dev-key" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -d '{
    "tenantId": "00000000-0000-0000-0000-000000000001",
    "content": "서비스 이용이 편리합니다",
    "rating": 5
  }'
```

### 8.3 최종 PR 제출 체크리스트

PR 제출 전 다음 항목을 모두 완료하십시오.

```
PR 제출 체크리스트 — feedback-service
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[준비 단계]
[ ] Plan 문서 작성 완료: docs/01-plan/mtus/SVC-FEEDBACK-R1.plan.md
[ ] Design 문서 작성 완료: docs/02-design/mtus/SVC-FEEDBACK-R1.design.md
[ ] 보안팀 사전 통보 완료

[코드 품질]
[ ] pnpm typecheck 오류 없음
[ ] pnpm lint 오류 없음 (경고 0개)
[ ] 함수 길이 80줄 이하
[ ] 하드코딩된 시크릿 없음 (환경 변수 사용)

[보안 (CSAP D-08, D-12)]
[ ] 모든 엔드포인트에 JWT 검증 있음
[ ] 모든 엔드포인트에 RBAC 검사 있음
[ ] 모든 입력에 Zod 스키마 검증 있음
[ ] 에러 메시지에 민감 정보 없음
[ ] 내부 서비스 키 검증 있음

[감사 로그 (CSAP D-06)]
[ ] 모든 민감 작업에 logFeedbackEvent() 호출
[ ] 감사 이벤트 코드 레지스트리 등록

[테스트]
[ ] pnpm test 모두 통과
[ ] 정상 경로 테스트
[ ] 에러 경로 테스트 (400, 401, 403, 404)
[ ] N2SF 등급 관련 테스트 (해당 시)

[인프라]
[ ] Dockerfile 작성
[ ] Helm values.yaml 작성
[ ] NetworkPolicy 작성
[ ] ServiceMonitor 작성

[문서]
[ ] API 스펙 OpenAPI 주석 완비
[ ] CSAP 시스템 목록 업데이트
[ ] README.md 업데이트

[Conventional Commit 메시지]
feat(feedback): SVC-FEEDBACK-R1 피드백 서비스 최초 구현
- FR-FB.1~FR-FB.6 전체 구현
- CSAP D-06/D-08/D-12 준수
- Vitest 단위 테스트 커버리지 85%
```

**PR 제출 명령어:**

```bash
git checkout -b feat/feedback-service
git add platform/services/feedback-service/
git add docs/01-plan/mtus/SVC-FEEDBACK-R1.plan.md
git add docs/07-security/csap-system-inventory.yaml
git add docs/07-security/audit-event-registry.yaml

git commit -m "feat(feedback): SVC-FEEDBACK-R1 피드백 서비스 신규 구현

피드백 제출, 조회, 관리자 응답 API (FR-FB.1~FR-FB.6)
CSAP D-06 감사 로그 + D-08 RBAC + D-12 Zod 검증 준수
mesh-ready 플러그인 통합 (추적 + 셧다운)
Vitest 단위 테스트 커버리지 85%"

gh pr create \
  --title "feat(feedback): 피드백 서비스 신규 추가" \
  --body "## 변경 내용
- platform/services/feedback-service 신규 서비스 추가
- 피드백 CRUD + 담당자 답변 + 통계 API

## 보안 검토
- [ ] CSAP D-08: 모든 엔드포인트 인증/인가 적용
- [ ] CSAP D-06: 감사 로그 기록
- [ ] N2SF: O 등급 데이터만 처리

## 테스트
- [ ] pnpm test 통과 확인
- [ ] 로컬 curl 테스트 통과"
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 — notification-service 기반 feedback-service 가이드 | 공공 SaaS Dev |
