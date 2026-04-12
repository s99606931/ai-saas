# SVC-IDEMPOTENT-R39 DESIGN: Idempotency Manager

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead

## 상태 머신

```
(신규 요청) → begin(key, reqHash)
  ├─ 없음        → 상태: inProgress, 실행
  ├─ inProgress  → 대기 또는 LOCKED 반환
  ├─ completed   → 저장된 응답 반환
  └─ 해시 불일치 → CONFLICT 에러
```

## API

```ts
IdempotencyManager {
  begin(key: string, requestHash: string): Promise<BeginResult>
  complete(key: string, result: unknown): Promise<void>
  fail(key: string, error: Error): Promise<void>
}

BeginResult =
  | { state: 'fresh' }
  | { state: 'completed', result: unknown }
  | { state: 'inProgress' }
  | { state: 'conflict', existingHash: string }
```

## Session Guide
- `src/idempotency.ts` → `src/index.ts` → `tests/idempotency.test.ts`
