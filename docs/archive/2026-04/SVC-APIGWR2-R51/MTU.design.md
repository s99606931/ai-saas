# SVC-APIGWR2-R51 Design — API Gateway R2

> **Plan Ref**: `docs/01-plan/mtus/SVC-APIGWR2-R51.plan.md`
> **작성일**: 2026-04-11
> **작성자**: PM Lead
> **상태**: Design 완료

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 게이트웨이 에러 응답 표준화 |
| 기술 | Fastify 플러그인 `problemErrorPlugin` + 개별 핸들러 패치 병행 |
| 보안 | Problem Details traceId 주입 + 로그 상관관계 |
| 감리 | 5개 에러 지점 100% 전환 |

---

## Design Anchor

- **WHY**: 일관된 에러 규약 확립 → 모든 호출자 파싱 단순화
- **제약**: 프록시 본체 응답(하위 서비스 JSON)은 절대 변경하지 않음 — 하위 호환
- **전제**: `@public-saas/problem-details`는 프레임워크 독립적인 순수 라이브러리

---

## 1. 아키텍처 옵션

| 옵션 | 설명 | 선정 |
|------|------|------|
| A. 전역 훅만 | `setErrorHandler` + `setNotFoundHandler`만 등록 | 부분 — uncaught 에러만 해결 |
| **B. 전역 훅 + 개별 핸들러 수정** | 전역 훅으로 uncaught 처리, 개별 에러 지점은 직접 Problem Details 반환 | **선정** |
| C. 응답 리라이터 미들웨어 | onSend에서 기존 `{success:false}` 감지 후 변환 | 탈락 — 프록시 본체 false positive |

---

## 2. 상세 설계

### 2.1 전역 에러 핸들러 (`plugins/problem-error.ts`)

```ts
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import {
  problem,
  withTraceId,
  internalError,
  notFound,
  type ProblemDetails,
} from '@public-saas/problem-details';

const ERROR_BASE = 'https://problems.public-saas.kr/errors/gateway';

async function problemErrorPlugin(app: FastifyInstance): Promise<void> {
  app.setErrorHandler(async (err, request, reply) => {
    const traceId = (request.headers['x-request-id'] as string | undefined) ?? request.id;
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;

    let pd: ProblemDetails;
    if (status >= 500) {
      pd = internalError('처리 중 오류가 발생했습니다');
    } else {
      pd = problem({
        type: `${ERROR_BASE}/client-error`,
        title: err.name || 'Client Error',
        status,
        detail: err.message,
      });
    }
    if (traceId) pd = withTraceId(pd, traceId);

    request.log.error({ err, traceId, status }, 'gateway error handler');
    void reply.status(status).header('content-type', 'application/problem+json; charset=utf-8');
    await reply.send(pd);
  });

  app.setNotFoundHandler(async (request, reply) => {
    const traceId = (request.headers['x-request-id'] as string | undefined) ?? request.id;
    let pd: ProblemDetails = notFound(`경로 ${request.url}를 찾을 수 없습니다`);
    if (traceId) pd = withTraceId(pd, traceId);
    void reply.status(404).header('content-type', 'application/problem+json; charset=utf-8');
    await reply.send(pd);
  });
}

export default fp(problemErrorPlugin, { name: 'problem-error', fastify: '5.x' });
```

### 2.2 Admin 403 전환 (`index.ts`)

기존:
```ts
await reply.status(403).send({
  success: false,
  error: { code: 'ADMIN_AUTH_REQUIRED', ... }
});
```

변경:
```ts
import { forbidden, withTraceId } from '@public-saas/problem-details';

let pd = forbidden('관리 엔드포인트 접근 권한이 없습니다');
const traceId = (request.headers['x-request-id'] as string) ?? request.id;
if (traceId) pd = withTraceId(pd, traceId);
void reply.status(403).header('content-type', 'application/problem+json; charset=utf-8');
await reply.send(pd);
```

### 2.3 동적 플러그인 프록시 에러 (`routes/proxy.ts`)

- 404 (서비스 없음): `notFound()`
- 403 (권한): `forbidden()`
- 502 (프록시 실패): `badGateway()`
- 503 (Circuit Open): `serviceUnavailable()` + extension `retryAfterMs`

각 지점에서 traceId 주입.

### 2.4 Problem Types URI

```
https://problems.public-saas.kr/errors/gateway/plugin-not-found     (404)
https://problems.public-saas.kr/errors/gateway/plugin-forbidden     (403)
https://problems.public-saas.kr/errors/gateway/proxy-error          (502)
https://problems.public-saas.kr/errors/gateway/circuit-open         (503)
https://problems.public-saas.kr/errors/gateway/admin-forbidden      (403)
```

---

## 3. 테스트 전략

### 단위 테스트 (`tests/unit/problem-error.test.ts`)

| 케이스 | 수 |
|--------|---|
| 전역 에러 핸들러 - 500 응답 | 1 |
| 전역 에러 핸들러 - 400 응답 | 1 |
| 전역 404 핸들러 | 1 |
| traceId x-request-id 주입 | 1 |
| traceId fallback request.id | 1 |
| Content-Type: application/problem+json | 1 |
| Problem type URI 포맷 | 1 |
| 에러 detail 메시지 포함 | 1 |

최소 8개.

---

## 4. Session Guide

1. `package.json`에 `@public-saas/problem-details` workspace 의존성 추가
2. `src/plugins/problem-error.ts` 신규 작성
3. `src/index.ts`에 플러그인 등록 + admin 403 전환
4. `src/routes/proxy.ts`의 plugin 프록시 에러 4개 지점 전환
5. 테스트 작성
6. `pnpm --filter @public-saas/api-gateway typecheck build test` 통과

---

## 5. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|-------|
| 1.0.0 | 2026-04-11 | 최초 작성 | PM Lead |
