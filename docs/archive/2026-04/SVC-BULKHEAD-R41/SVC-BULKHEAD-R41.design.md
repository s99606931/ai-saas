# SVC-BULKHEAD-R41 DESIGN: Bulkhead Isolation

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead

## 아키텍처

```
Bulkhead
  groups: Map<name, GroupState>
    GroupState = {
      maxConcurrent, maxQueue,
      active: number,
      waiting: Array<{resolve, reject}>,
      metrics: {accepted, rejected, queued}
    }

  execute(group, fn) →
    if active < maxConcurrent → run
    elif waiting < maxQueue → enqueue
    else → throw BulkheadRejectedError
```

## Session Guide
- `src/bulkhead.ts` → `src/index.ts` → `tests/bulkhead.test.ts`
