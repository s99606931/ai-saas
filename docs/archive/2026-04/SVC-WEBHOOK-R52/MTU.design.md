# SVC-WEBHOOK-R52 Design — Webhook Dispatcher

> **Plan Ref**: `docs/01-plan/mtus/SVC-WEBHOOK-R52.plan.md`
> **작성일**: 2026-04-11

---

## 1. 아키텍처 결정

| 옵션 | 장점 | 단점 | 선정 |
|------|------|------|------|
| A. backoff 패키지 재사용 | DRY | 의존성 순환 위험 | - |
| **B. 내장 지수 백오프 로직** | 독립성, 작은 API | 로직 중복 | **선정** |
| C. Node-fetch 래핑 클래스 | OO 스타일 | fetch 전역 있음 | - |

---

## 2. 서명 모듈 (`src/signature.ts`)

### 2.1 signPayload

```ts
import { createHmac } from 'node:crypto';

export interface SignaturePayload {
  body: string;
  timestamp: number; // epoch seconds
}

export function signPayload(
  body: string,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000),
): { signature: string; timestamp: number } {
  const payload = `${timestamp}.${body}`;
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const signature = `sha256=${hmac.digest('hex')}`;
  return { signature, timestamp };
}
```

서명 포맷: `sha256=<hex>` (Stripe/GitHub 스타일 호환)

### 2.2 verifySignature (타임 상수 비교)

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface VerifyOptions {
  toleranceSeconds?: number; // 기본 300
  now?: () => number;
}

export function verifySignature(
  body: string,
  signature: string,
  secret: string,
  timestamp: number,
  options: VerifyOptions = {},
): { valid: boolean; reason?: string } {
  const tolerance = options.toleranceSeconds ?? 300;
  const now = options.now?.() ?? Math.floor(Date.now() / 1000);

  if (!Number.isFinite(timestamp)) {
    return { valid: false, reason: 'invalid-timestamp' };
  }

  if (Math.abs(now - timestamp) > tolerance) {
    return { valid: false, reason: 'timestamp-out-of-tolerance' };
  }

  const payload = `${timestamp}.${body}`;
  const expected = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return { valid: false, reason: 'length-mismatch' };
  if (!timingSafeEqual(a, b)) return { valid: false, reason: 'signature-mismatch' };

  return { valid: true };
}
```

### 2.3 타임스탬프 replay 방지

- 기본 허용 범위: 5분(300초)
- 테스트에서는 `options.now` 주입 가능

### 2.4 헤더 상수

```ts
export const SIGNATURE_HEADER = 'x-public-saas-signature';
export const TIMESTAMP_HEADER = 'x-public-saas-timestamp';
```

---

## 3. Dispatcher 모듈 (`src/dispatcher.ts`)

### 3.1 기본 시그니처

```ts
export interface DispatchOptions {
  secret: string;
  maxAttempts?: number;         // 기본 5
  baseDelayMs?: number;         // 기본 1000
  maxDelayMs?: number;          // 기본 60000
  timeoutMs?: number;           // 기본 10000
  headers?: Record<string, string>;
  now?: () => number;
  fetchImpl?: typeof fetch;     // 테스트 주입
  signal?: AbortSignal;
  // 테스트용: 지연 구현 주입
  sleepImpl?: (ms: number) => Promise<void>;
}

export interface DispatchResult {
  success: boolean;
  attempts: number;
  lastStatus?: number;
  lastError?: string;
  durationMs: number;
}
```

### 3.2 재시도 분류

| 상황 | 재시도 여부 |
|------|----------|
| 2xx | 성공 (중단) |
| 3xx | 성공 처리 (중단) |
| 408 Request Timeout | 재시도 |
| 429 Too Many Requests | 재시도 |
| 기타 4xx | 즉시 중단 |
| 5xx | 재시도 |
| 네트워크 에러 / 타임아웃 | 재시도 |

### 3.3 지수 백오프 계산

```ts
delay(attempt) = min(baseDelayMs * 2^attempt, maxDelayMs)
```

decorrelated jitter: `random(base, delay * 3)` 캡 적용

### 3.4 발송 루프 pseudocode

```
start = now()
attempt = 0
while attempt < maxAttempts:
  body = JSON.stringify(payload)
  { signature, timestamp } = signPayload(body, secret, now())
  try:
    response = fetch(url, {
      method: POST,
      body,
      headers: {
        'content-type': 'application/json',
        [SIGNATURE_HEADER]: signature,
        [TIMESTAMP_HEADER]: String(timestamp),
        ...headers
      },
      signal: AbortSignal.timeout(timeoutMs)
    })
    if response.ok: return { success: true, attempts: attempt+1, lastStatus: status, durationMs }
    if !isRetryable(status): return { success: false, attempts: attempt+1, lastStatus: status }
    lastError = `HTTP ${status}`
  catch e:
    lastError = e.message
  attempt++
  if attempt >= maxAttempts: break
  await sleep(backoff(attempt - 1))
return { success: false, attempts, lastError, durationMs }
```

---

## 4. 테스트 전략

### signature.test.ts (12 케이스)
- signPayload 결정론성
- signPayload 서명 포맷 (sha256=)
- verifySignature 성공
- verifySignature 비밀키 불일치
- verifySignature body 변조
- verifySignature 타임스탬프 변조
- verifySignature tolerance 기본값
- verifySignature tolerance 초과
- verifySignature invalid timestamp
- length mismatch
- 다른 서명 형식
- custom now 주입

### dispatcher.test.ts (13 케이스)
- 2xx 성공 1회 시도
- 5xx → 재시도 → 성공
- 5xx 연속 → maxAttempts 후 실패
- 400 → 즉시 중단
- 429 → 재시도
- 408 → 재시도
- 네트워크 예외 → 재시도
- 타임아웃 에러 분류
- X-Signature 헤더 포함
- X-Signature-Timestamp 헤더 포함
- custom headers 병합
- durationMs 반환
- abort signal 처리

---

## 5. 파일 구조

```
platform/packages/webhook-dispatcher/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── signature.ts
│   ├── dispatcher.ts
│   └── types.ts
└── tests/
    ├── signature.test.ts
    └── dispatcher.test.ts
```

---

## 6. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|-------|
| 1.0.0 | 2026-04-11 | 최초 작성 | PM Lead |
