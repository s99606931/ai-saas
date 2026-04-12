# SVC-BILLR2-R55 Design — Billing Service R2

> **작성일**: 2026-04-11

## 1. 아키텍처 옵션

| 옵션 | 설명 | 결정 |
|------|------|------|
| A: 전역 errorHandler | fastify setErrorHandler 만 설정 | 부분적 — 비즈니스 에러는 핸들러 직접 |
| B: 헬퍼 함수 | `problemReply(req, reply, opts)` | **선정** (auth R2 동형) |
| C: 클래스 래퍼 | BillingError 예외 throw | over-engineering |

## 2. 모듈 구조

```
src/lib/problem-reply.ts           (신규)
src/lib/audit.ts                   (sanitize 추가)
src/handlers/billing.handler.ts    (9개 포인트 전환)
tests/unit/problem-reply.test.ts   (신규)
tests/unit/audit-sanitize.test.ts  (신규)
```

## 3. problem-reply.ts

```ts
import { problem, withTraceId } from '@public-saas/problem-details';
import type { FastifyRequest, FastifyReply } from 'fastify';

export const BILLING_ERROR_BASE = 'https://problems.public-saas.kr/errors/billing';

export const BillingProblemTypes = {
  validation: `${BILLING_ERROR_BASE}/validation`,
  invoiceNotFound: `${BILLING_ERROR_BASE}/invoice-not-found`,
  subscriptionNotFound: `${BILLING_ERROR_BASE}/subscription-not-found`,
  forbidden: `${BILLING_ERROR_BASE}/forbidden`,
  alreadyPaid: `${BILLING_ERROR_BASE}/already-paid`,
} as const;

function extractTraceId(req: FastifyRequest): string | undefined {
  const h = req.headers['x-request-id'];
  if (typeof h === 'string' && h.length > 0) return h;
  const tp = req.headers['traceparent'];
  if (typeof tp === 'string') {
    const parts = tp.split('-');
    if (parts.length >= 2 && parts[1]) return parts[1];
  }
  return undefined;
}

export async function problemReply(req, reply, opts: {
  type: string; title: string; status: number; detail?: string; instance?: string; extensions?: Record<string, unknown>;
}): Promise<void> {
  const instance = opts.instance ?? req.url;
  let pd = problem({ ...opts, instance });
  const tid = extractTraceId(req);
  if (tid) pd = withTraceId(pd, tid);
  void reply.status(opts.status).header('content-type', 'application/problem+json; charset=utf-8');
  await reply.send(pd);
}
```

## 4. 핸들러 전환 맵

| 위치 | 이전 | 이후 |
|------|------|------|
| generateInvoice validation | `{success:false, error:{code:'VALIDATION_ERROR'}}` | `problemReply(...BillingProblemTypes.validation, 400)` |
| getInvoice 404 | `{code:'INVOICE_NOT_FOUND'}` | `BillingProblemTypes.invoiceNotFound, 404` |
| getInvoice 403 | `{code:'FORBIDDEN'}` | `BillingProblemTypes.forbidden, 403` |
| generateInvoice 404 | subscription-not-found | `BillingProblemTypes.subscriptionNotFound, 404` |
| payInvoice validation 400 | | `BillingProblemTypes.validation, 400` |
| payInvoice 404 | | `BillingProblemTypes.invoiceNotFound, 404` |
| payInvoice 403 | | `BillingProblemTypes.forbidden, 403` |
| payInvoice 409 | | `BillingProblemTypes.alreadyPaid, 409` |
| generateTaxInvoice 404 | | `BillingProblemTypes.invoiceNotFound, 404` |

## 5. audit.ts sanitize

```ts
export function sanitizeUserAgent(ua: string | undefined): string {
  if (!ua) return 'unknown';
  // eslint-disable-next-line no-control-regex
  const stripped = ua.replace(/[\u0000-\u001f\u007f]/g, '');
  return stripped.length > 500 ? stripped.slice(0, 500) : stripped;
}

export function sanitizeIp(ip: string | undefined): string {
  if (!ip) return 'unknown';
  if (/^[0-9a-fA-F:.]{3,45}$/.test(ip)) return ip;
  return 'invalid';
}
```

`logBillingEvent` 내부에서 user-agent/ip 파라미터를 sanitize 후 기록.

## 6. 테스트 (12+)

- problem-reply: 6 (traceId from x-request-id, from traceparent, both missing, validation flow, not-found flow, forbidden flow)
- audit-sanitize: 6 (ua undefined, ua control chars, ua too long, ip valid, ip invalid, ip undefined)

## 변경 이력

| 버전 | 일자 | 내용 |
|------|------|------|
| 1.0.0 | 2026-04-11 | 최초 작성 |
