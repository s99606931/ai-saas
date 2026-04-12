# SVC-TRACECTX-R45 Design — 분산 추적 컨텍스트 헬퍼

| 항목 | 값 |
|------|-----|
| Plan Ref | SVC-TRACECTX-R45.plan.md |
| 복잡도 | LOW-MED |

---

## Design Anchor

- **아키텍처**: 순수 유틸 함수 + `AsyncLocalStorage` 컨텍스트 + OTel adapter(optional).
- **폴백 전략**: 모듈 로드 시 동적 require 시도 → 실패 시 no-op adapter 주입.
- **상관관계**: 16바이트 traceId + 8바이트 spanId (W3C). ID 생성 시 `crypto.randomBytes`.
- **AsyncLocalStorage**: Node.js 내장 — 별도 의존성 없음.
- **속성 검증**: 기본 화이트리스트 + `denyPatterns` (정규식). denyList 우선.

---

## 타입 & 모듈

```typescript
// trace-id.ts
export function generateTraceId(): string; // 32 hex chars
export function generateSpanId(): string;  // 16 hex chars
export function parseTraceparent(header: string): {
  version: string;
  traceId: string;
  spanId: string;
  flags: string;
} | undefined;
export function buildTraceparent(traceId: string, spanId: string, flags?: string): string;

// attributes.ts
export const DEFAULT_DENY_PATTERNS: RegExp[]; // password, token, secret, authorization
export function sanitizeAttributes(
  attrs: Record<string, unknown>,
  opts?: { denyPatterns?: RegExp[]; maxLength?: number },
): Record<string, unknown>;

// context.ts (AsyncLocalStorage)
export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}
export function runWithContext<T>(ctx: TraceContext, fn: () => Promise<T>): Promise<T>;
export function getCurrentContext(): TraceContext | undefined;
export function getCurrentTraceId(): string | undefined;

// span.ts (OTel optional)
export interface SpanAdapter {
  start(name: string, attrs?: Record<string, unknown>): SpanHandle;
}
export interface SpanHandle {
  setAttribute(key: string, value: unknown): void;
  recordException(err: Error): void;
  end(): void;
}
export function withSpan<T>(
  name: string,
  fn: (span: SpanHandle) => Promise<T>,
  attrs?: Record<string, unknown>,
): Promise<T>;
```

---

## 알고리즘 — withSpan

```
withSpan(name, fn, attrs):
  safeAttrs = sanitizeAttributes(attrs)
  span = adapter.start(name, safeAttrs)
  try:
    return await fn(span)
  catch err:
    span.recordException(err)
    throw err
  finally:
    span.end()
```

## 알고리즘 — parseTraceparent

```
parseTraceparent(header):
  parts = header.split('-')
  if parts.length !== 4: return undefined
  [version, traceId, spanId, flags] = parts
  if version.length !== 2: return undefined
  if traceId.length !== 32 or not hex: return undefined
  if spanId.length !== 16 or not hex: return undefined
  if traceId === '00'.repeat(16): return undefined  // invalid
  if spanId === '00'.repeat(8): return undefined
  return { version, traceId, spanId, flags }
```

## 파일 구조

```
platform/packages/trace-context/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── trace-id.ts
│   ├── attributes.ts
│   ├── context.ts
│   └── span.ts
└── tests/
    └── trace-context.test.ts
```

## 테스트 계획

| # | 케이스 | FR |
|---|--------|------|
| 1 | generateTraceId 32 hex 소문자 | FR-TC.3 |
| 2 | generateSpanId 16 hex 소문자 | FR-TC.3 |
| 3 | parseTraceparent 정상 | FR-TC.1 |
| 4 | parseTraceparent 잘못된 길이 → undefined | FR-TC.1 |
| 5 | parseTraceparent 0-traceId → undefined | FR-TC.1 |
| 6 | buildTraceparent 후 parse 재검증 | FR-TC.2 |
| 7 | sanitizeAttributes password/token 차단 | FR-TC.6 |
| 8 | sanitizeAttributes 길이 제한 | FR-TC.6 |
| 9 | withSpan 정상 → end 호출 | FR-TC.4 |
| 10 | withSpan 에러 → recordException + end 호출 + rethrow | FR-TC.4 |
| 11 | OTel 어댑터 미제공 시 no-op span 동작 | FR-TC.5 |
| 12 | runWithContext 중첩 → getCurrentContext 반환 | FR-TC.8 |
| 13 | getCurrentTraceId 컨텍스트 없을 시 undefined | FR-TC.7 |
