# SVC-WEBHOOK-R52 Report — Webhook Dispatcher

> **라운드**: R52 (3회차 고도화 루프 #3)
> **작성일**: 2026-04-11
> **matchRate**: 100%

---

## Executive Summary

| 관점 | 목표 | 달성 |
|------|------|------|
| 비즈니스 | 공통 Webhook 발송 모듈 | billing/subscription/audit에서 재사용 가능 |
| 기술 | HMAC-SHA256 + 지수 백오프 | 37 테스트 통과 |
| 보안 | replay 방지 + 타이밍 공격 방지 | timingSafeEqual + 300초 tolerance |
| 감리 | 감사 가능한 결과 객체 | DispatchResult (attempts, lastStatus, durationMs) |

---

## Key Decisions

1. **내장 지수 백오프**: `@public-saas/backoff` 의존 대신 경량 내장 로직 사용 — 독립성 확보
2. **Stripe/GitHub 스타일 서명 포맷**: `sha256=<hex>` — 외부 시스템 호환성
3. **재시도 분류**: 5xx + 408 + 429만 재시도. 기타 4xx는 즉시 중단 (무의미한 반복 방지)
4. **각 시도 새 타임스탬프**: replay 방지 + 시간 이동 대응
5. **AbortSignal.any**: 외부 cancel + 타임아웃 병합

---

## 품질 증거

```
Test Files  2 passed (2)
Tests  37 passed (37)
  - signature.test.ts:  18 tests (FR-WH.1, .2, .7, .8)
  - dispatcher.test.ts: 19 tests (FR-WH.3~.6)
```

- typecheck: 에러 0
- 순수 노드 내장 모듈(crypto, fetch)만 사용 → 의존성 0

---

## CSAP/N2SF 매핑

| 항목 | 영역 | 달성 |
|------|------|------|
| D-09-02 | 암호화 | HMAC-SHA256 |
| D-12-02 | 입력 검증 | timestamp 유효성 + tolerance |
| D-06 | 감사 | DispatchResult attempts/status |
| D-14 | 가용성 | 재시도 + 타임아웃 |

---

## 사용 예시

```ts
import { dispatchWebhook, verifySignature, SIGNATURE_HEADER, TIMESTAMP_HEADER } from '@public-saas/webhook-dispatcher';

// 발송자 (예: billing-service)
const result = await dispatchWebhook(
  'https://partner.gov.kr/hooks/billing',
  { event: 'invoice.paid', invoiceId: 'INV-001' },
  { secret: process.env.WEBHOOK_SECRET!, maxAttempts: 5 },
);
console.log(result.attempts, result.durationMs);

// 수신자 검증
const ts = Number(request.headers[TIMESTAMP_HEADER]);
const sig = request.headers[SIGNATURE_HEADER];
const check = verifySignature(rawBody, sig, secret, ts);
if (!check.valid) return reply.status(401);
```

---

## 변경 이력

| 버전 | 일자 | 내용 |
|------|------|------|
| 1.0.0 | 2026-04-11 | 최초 작성 |
