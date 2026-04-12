# SVC-SAGA-R44 Design — 분산 트랜잭션 Saga 오케스트레이터

| 항목 | 값 |
|------|-----|
| MTU ID | SVC-SAGA-R44 |
| Plan Ref | docs/01-plan/mtus/SVC-SAGA-R44.plan.md |
| 작성일 | 2026-04-11 |
| 복잡도 | MED |

---

## Design Anchor

- **아키텍처 선택**: Orchestration 방식 Saga (Choreography 대비 가시성 우수, 디버깅 용이, 공공 SaaS 감리 친화)
- **상태 저장**: `SagaStore` 추상화 + `MemorySagaStore` 기본 구현. PostgreSQL·Redis 등은 adapter로 주입.
- **이벤트 훅**: `onTransition(event)` 콜백으로 모든 상태 전이 전달. 감사 로거가 구독하여 `audit.jsonl` 기록.
- **타임아웃**: 각 step에 optional `timeoutMs` 필드. Promise.race로 구현.
- **보상 순서**: 스택(LIFO) — 성공한 단계만 역순 보상.
- **재시도**: 이 패키지는 재시도하지 않음. 재시도는 호출측이 `@platform/backoff`로 래핑 (관심사 분리).

---

## 상태 머신

```
              ┌─────────┐
              │ pending │
              └────┬────┘
                   │ execute()
                   ▼
              ┌─────────┐  step n 성공   ┌───────────┐
              │ running │ ───────────▶  │ completed │
              └────┬────┘                └───────────┘
                   │ step n 실패
                   ▼
              ┌──────────────┐ 모든 보상 성공 ┌──────────────┐
              │ compensating │ ───────────▶  │ compensated  │
              └──────┬───────┘                └──────────────┘
                     │ 보상 실패
                     ▼
              ┌──────────────────────┐
              │ failed_compensation  │
              └──────────────────────┘
```

---

## 타입 정의

```typescript
export type SagaStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'compensating'
  | 'compensated'
  | 'failed_compensation';

export interface SagaStep<TContext> {
  name: string;
  execute: (ctx: TContext) => Promise<void>;
  compensate?: (ctx: TContext) => Promise<void>;
  timeoutMs?: number;
}

export interface SagaDefinition<TContext> {
  id: string;
  steps: SagaStep<TContext>[];
}

export interface SagaState<TContext> {
  sagaId: string;
  status: SagaStatus;
  currentStep: number;
  completedSteps: string[];
  compensatedSteps: string[];
  error?: string;
  compensationError?: string;
  context: TContext;
  startedAt: number;
  updatedAt: number;
}

export interface SagaTransitionEvent {
  type:
    | 'start'
    | 'step_ok'
    | 'step_fail'
    | 'compensate_ok'
    | 'compensate_fail'
    | 'end';
  sagaId: string;
  step?: string;
  status: SagaStatus;
  error?: string;
  timestamp: number;
}

export interface SagaStore<TContext> {
  save(state: SagaState<TContext>): Promise<void>;
  load(sagaId: string): Promise<SagaState<TContext> | undefined>;
}

export interface SagaOptions<TContext> {
  store?: SagaStore<TContext>;
  onTransition?: (event: SagaTransitionEvent) => void;
}
```

---

## 핵심 알고리즘 (의사 코드)

```
execute(def, initialContext):
  if store.load(def.id) exists and status ∈ {running, compensating}:
    throw "재진입 불가"

  state ← newState(def.id, initialContext)
  emit('start')
  state.status = 'running'

  for i, step in def.steps:
    state.currentStep = i
    try:
      await runWithTimeout(step.execute, state.context, step.timeoutMs)
      state.completedSteps.push(step.name)
      emit('step_ok', step.name)
    catch err:
      state.error = err.message
      emit('step_fail', step.name, err)
      compensate(def, state)
      emit('end')
      throw SagaExecutionError(err, compensationErrors)

  state.status = 'completed'
  emit('end')
  return state

compensate(def, state):
  state.status = 'compensating'
  compensationErrors = []

  // 성공한 단계만 역순 보상 (completedSteps 기준)
  for stepName in state.completedSteps.reverse():
    step = def.steps.find(s => s.name === stepName)
    if !step.compensate: continue
    try:
      await runWithTimeout(step.compensate, state.context, step.timeoutMs)
      state.compensatedSteps.push(stepName)
      emit('compensate_ok', stepName)
    catch compErr:
      compensationErrors.push({step: stepName, error: compErr})
      emit('compensate_fail', stepName, compErr)

  state.status = compensationErrors.length === 0
    ? 'compensated'
    : 'failed_compensation'
  state.compensationError = JSON.stringify(compensationErrors) || undefined
```

---

## 파일 구조

```
platform/packages/saga/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts        # public exports
│   └── saga.ts         # Saga, MemorySagaStore, 타입
└── tests/
    └── saga.test.ts    # 12개 이상 테스트
```

---

## 테스트 계획

| # | 케이스 | FR |
|---|--------|------|
| 1 | 단일 단계 성공 → completed | FR-SAGA.2 |
| 2 | 3단계 모두 성공 → completed + completedSteps 순서 | FR-SAGA.2 |
| 3 | 2단계 중 2번째 실패 → 1번째 보상 호출 | FR-SAGA.3 |
| 4 | 3단계 중 3번째 실패 → 2,1 역순 보상 | FR-SAGA.3 |
| 5 | 보상 성공 → compensated 상태 | FR-SAGA.4 |
| 6 | 보상 실패 → failed_compensation + 에러 집계 | FR-SAGA.4, FR-SAGA.10 |
| 7 | onTransition 훅 모든 이벤트 호출 순서 | FR-SAGA.5 |
| 8 | 컨텍스트 공유 (step1 결과 → step2 소비) | FR-SAGA.6 |
| 9 | 타임아웃 초과 → 실패 + 보상 | FR-SAGA.7 |
| 10 | 동일 Saga 재실행 → 예외 | FR-SAGA.8 |
| 11 | 커스텀 store 주입 → save 호출 검증 | FR-SAGA.9 |
| 12 | 보상 없는 단계(compensate 미정의) 스킵 | FR-SAGA.3 |
| 13 | 단계 이름 중복 → 정의 시 예외 | 입력검증 |
| 14 | 빈 steps → 예외 | 입력검증 |

---

## 감사 로그 포맷 (CSAP D-06)

```json
{
  "timestamp": "2026-04-11T12:34:56.789Z",
  "actor": "svc-billing",
  "action": "SAGA_TRANSITION",
  "sagaId": "saga-abc123",
  "type": "step_fail",
  "step": "chargeCard",
  "status": "compensating",
  "error": "payment gateway timeout"
}
```

---

## Session Guide

1. `package.json`, `tsconfig.json` 작성 (outbox 패키지 참조).
2. `src/saga.ts` 타입 + `SagaExecutionError` + `MemorySagaStore` + `Saga` 클래스.
3. `src/index.ts` re-export.
4. `tests/saga.test.ts` 14개 케이스 구현 (Node built-in test runner).
5. 빌드 + 테스트 수행.
