# SVC-AUTHR2-R50 Design — Auth Service R2

> **Plan Ref**: `docs/01-plan/mtus/SVC-AUTHR2-R50.plan.md`
> **작성일**: 2026-04-11
> **작성자**: PM Lead
> **상태**: Design 완료

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 인증 에러 API 표준화 |
| 기술 | 3개 옵션 검토 → Pragmatic Balance(Fastify 훅 아닌 공용 헬퍼 라이브러리) 선택 |
| 보안 | 입력 위생화 + 감사 로그 필드 정규화 |
| 감리 | RFC 7807 준수 → 외부 감사 자동화 가능 |

---

## Design Anchor

- **WHY**: 서비스 간 에러 응답 규약 표준화
- **제약**: 기존 success 응답 호환 유지, 기존 라우트/미들웨어 서명 불변
- **전제**: `@public-saas/problem-details`, `@public-saas/input-sanitizer`, `@public-saas/trace-context` 이미 구현됨

---

## 1. 아키텍처 옵션 평가

| 옵션 | 설명 | 장점 | 단점 | 선정 |
|------|------|------|------|------|
| A. Fastify setErrorHandler 전역 훅 | throw로 에러 올리면 훅이 변환 | 코드량 최소 | 기존 핸들러 throw 아닌 reply.send 패턴과 충돌 | - |
| B. 공용 헬퍼 `problemReply(reply, preset, opts)` 도입 | 각 핸들러에서 호출 | 점진 도입 가능, 호환 리스크 낮음 | 핸들러별 반복 | **선정** |
| C. 커스텀 Reply 데코레이터 `reply.problem(...)` | Fastify 플러그인으로 확장 | DX 우수 | 타입 확장 필요 | 차순위 |

→ **Pragmatic Balance = 옵션 B**. Plan SC FR-AUTHR2.1~.6 모두 충족 가능.

---

## 2. 상세 설계

### 2.1 Problem Wrapper (`lib/problem-reply.ts`)

```ts
// 신규 파일
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  problem,
  withTraceId,
  type ProblemDetails,
  type ProblemOptions,
} from '@public-saas/problem-details';

export interface ProblemReplyOptions extends Omit<ProblemOptions, 'status'> {
  status: number;
}

export async function problemReply(
  request: FastifyRequest,
  reply: FastifyReply,
  opts: ProblemReplyOptions,
): Promise<void> {
  const traceId =
    (request.headers['x-request-id'] as string | undefined) ??
    (request.headers['traceparent'] as string | undefined)?.split('-')[1] ??
    undefined;

  let pd: ProblemDetails = problem({
    ...opts,
    instance: opts.instance ?? request.routerPath ?? request.url,
  });

  if (traceId) {
    pd = withTraceId(pd, traceId);
  }

  await reply
    .status(opts.status)
    .header('Content-Type', 'application/problem+json; charset=utf-8')
    .send(pd);
}
```

### 2.2 TraceId 우선순위

1. `request.headers['x-request-id']`
2. `traceparent` 헤더 파싱 (W3C Trace Context 형식: `00-{traceId}-{spanId}-{flags}`)
3. 없으면 undefined (응답에 미포함)

> `trace-context` 패키지의 `getCurrentTraceId()`는 AsyncLocalStorage 기반으로 Fastify 요청 훅 이전에 설정돼야 동작하므로, 헤더 기반 추출이 더 안정적.

### 2.3 에러 타입 URI (auth-service 전용)

```
https://public-saas.gov.kr/errors/auth/invalid-credentials    (401)
https://public-saas.gov.kr/errors/auth/account-locked          (423)
https://public-saas.gov.kr/errors/auth/tenant-not-found        (401)
https://public-saas.gov.kr/errors/auth/mfa-required            (403)
https://public-saas.gov.kr/errors/auth/mfa-invalid             (401)
https://public-saas.gov.kr/errors/auth/validation              (400)
```

### 3.1 Email 정규화

```ts
import { stripControlChars, truncate } from '@public-saas/input-sanitizer';

const rawEmail = parseResult.data.email;
const email = truncate(stripControlChars(rawEmail), 320).trim().toLowerCase();
```

- 320자는 RFC 5321 이메일 최대 길이
- 제어문자(0x00-0x1F, 0x7F) 제거 → 로그 인젝션 방지 (D-06)

### 3.2 UA/IP 감사 로그 위생화 (`lib/audit.ts`)

```ts
import { stripControlChars, truncate } from '@public-saas/input-sanitizer';

function sanitizeUa(ua: string | undefined): string {
  if (!ua) return 'unknown';
  return truncate(stripControlChars(ua), 500);
}

function sanitizeIp(ip: string): string {
  // 기본 유효성만. IPv4/IPv6 이외는 'unknown'
  if (!/^[0-9a-fA-F:.]{3,45}$/.test(ip)) return 'unknown';
  return ip;
}
```

`logAuthEvent` 내부 호출 지점에 적용.

---

## 3. 테스트 전략

### 단위 테스트 (최소 15개)

| 파일 | 케이스 |
|------|--------|
| `problem-reply.test.ts` | traceId 헤더 있음/없음 (2), instance 기본값 (1), Content-Type 검증 (1), 상태코드 반영 (3) |
| `login-sanitize.test.ts` | 제어문자 제거 (1), 이메일 정규화 trim/lowercase (2), 최대 길이 (1) |
| `login-errors.test.ts` | 4xx 각 케이스의 type URI 검증 (5) |
| `audit-sanitize.test.ts` | UA 제어문자 (1), UA 500자 초과 truncate (1), IP 패턴 검증 (1) |

> 총 16개 이상. Q-Gate G4 커버리지 80% 목표.

---

## 4. Session Guide

**구현 순서**:
1. `platform/services/auth-service/package.json`에 3개 workspace 의존성 추가
2. `src/lib/problem-reply.ts` 신규 작성
3. `src/handlers/login.handler.ts` 수정 (4xx 5개 지점)
4. `src/handlers/refresh.handler.ts`, `logout.handler.ts`, `verify.handler.ts` 수정
5. `src/lib/audit.ts`의 UA/IP 위생화 적용
6. 테스트 파일 4개 작성
7. `pnpm -F @public-saas/auth-service typecheck test` 전수 통과

**차단 조건**:
- 기존 테스트 회귀 발생 시 STOP → 재설계

---

## 5. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|-------|
| 1.0.0 | 2026-04-11 | 최초 작성 | PM Lead |
