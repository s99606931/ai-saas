# SVC-AI-ADV-R127 — Agent Task Scheduler (DAG) (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## Design Anchor

- **아키텍처**: DAG Validator(Kahn) + Parallel Executor + Result Map
- **선정 이유**: Pragmatic Balance — 표준 토폴로지 정렬 + Promise.all 기반 동시성 제어. 분산 큐 미사용
- **대안**:
  1. 직렬 실행 — 단순, 비효율
  2. Kahn DAG(선정) — 결정적, 병렬 가능
  3. 분산 워커 — 확장성↑, 복잡도↑

## 인터페이스

```typescript
type TaskExecutor<T = unknown> = (
  ctx: TaskContext,
) => Promise<T> | T

interface TaskContext {
  taskId: string
  dependencies: Record<string, unknown>  // dep id -> result
}

interface TaskDef<T = unknown> {
  id: string
  dependsOn: string[]
  executor: TaskExecutor<T>
  grade: DataGrade
  skipOnFailure?: boolean
}

interface TaskResult {
  taskId: string
  status: 'success' | 'failed' | 'skipped'
  output?: unknown
  error?: string
  startedAt: number
  finishedAt: number
}

interface ScheduleResult {
  results: TaskResult[]
  successful: string[]
  failed: string[]
  skipped: string[]
  totalDurationMs: number
}

class AgentTaskScheduler {
  constructor(options?: { maxConcurrency?: number; abortOnFailure?: boolean })
  registerTask<T>(task: TaskDef<T>): void
  validateDAG(): void  // throws on cycle
  run(): Promise<ScheduleResult>
  getAuditLog(): readonly SchedulerAuditEntry[]
}
```

## Kahn 토폴로지 정렬

```
inDegree[] 계산
queue = [tasks with inDegree 0]
while queue:
  pop task → 실행 가능 레벨에 추가
  for each downstream:
    inDegree[downstream]--
    if 0: queue.push
if processed < total: cycle detected
```

같은 레벨은 병렬 실행 가능.

## 병렬 실행

```
ready = topological levels
for each level:
  available = ready.filter(not blocked by failed parent)
  chunks of size maxConcurrency
  Promise.all(chunks)
```

`abortOnFailure=true`이면 첫 실패 시 나머지 모두 skip.

`skipOnFailure=true` 태스크는 부모가 실패해도 본인은 skip만 됨(실패 전파 X).
기본은 `skipOnFailure=true`로 동작.

## 결정적 실행 순서

같은 레벨 내에서는 task.id alphabetical 정렬로 결정적 처리.

## Session Guide

1. registerTask로 의존성 있는 태스크 등록 (grade=O)
2. validateDAG()로 사이클 사전 검증 (선택)
3. run() 호출 → 자동 실행
4. ScheduleResult.failed/skipped 검사
5. 부모 결과는 ctx.dependencies[parentId]로 접근
