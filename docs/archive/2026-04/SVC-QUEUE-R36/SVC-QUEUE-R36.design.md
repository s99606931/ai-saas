# SVC-QUEUE-R36 DESIGN: Task Queue

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead

## 아키텍처

```
TaskQueue
  queue: Array<{run, priority, resolve, reject}>  (priority 정렬 삽입)
  pending: number
  concurrency: number

  add(fn, {priority}) → enqueue + next()
  next() → while(pending < concurrency && queue.length) dequeue & run
  idle() → Promise (pending==0 && queue.empty)
```

## Session Guide
- `src/task-queue.ts` → `src/index.ts` → `tests/task-queue.test.ts`
- Design Anchor: `// Design Ref: SVC-QUEUE-R36 DESIGN`
