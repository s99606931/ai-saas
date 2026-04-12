# SVC-OUTBOX-R43 DESIGN: Transactional Outbox

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead

## 상태 전이

```
pending → published (성공)
pending → pending (실패 + retry++)
pending → dead_letter (retry > maxRetries)
```

## API

```ts
Outbox {
  append(event: OutboxEvent): Promise<string>  // returns eventId
  fetchPending(limit): Promise<OutboxEntry[]>
  markPublished(id): Promise<void>
  markFailed(id, error): Promise<'retry' | 'dead'>
  getDeadLetter(): Promise<OutboxEntry[]>
}
```

## Session Guide
- `src/outbox.ts` → `src/index.ts` → `tests/outbox.test.ts`
