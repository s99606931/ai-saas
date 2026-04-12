# MTU Design — SVC-AI-ADV-R143 Reasoning Trace Recorder

> Plan Ref: docs/01-plan/mtus/SVC-AI-ADV-R143.plan.md

## 아키텍처 선택: Pragmatic Balance

인메모리 Map 기반 트레이스 저장 + 결정론적 해시 체인. 외부 DB 의존 제거.

## 타입 정의

```ts
export type DataGrade = 'O' | 'C' | 'S'
export type TraceStatus = 'OPEN' | 'CLOSED'

export interface TraceStep {
  name: string
  inputSummary: string
  outputSummary: string
  confidence: number   // 0..1
  durationMs: number
  at: number
}

export interface ReasoningTrace {
  traceId: string
  startedAt: number
  closedAt?: number
  status: TraceStatus
  steps: TraceStep[]
  chainHash?: string
  avgConfidence?: number
}
```

## 클래스 API

```ts
class ReasoningTraceRecorder {
  start(label: string, grade?: DataGrade): string
  addStep(traceId: string, step: Omit<TraceStep, 'at'>, grade?: DataGrade): void
  close(traceId: string): ReasoningTrace
  get(traceId: string): ReasoningTrace | undefined
  list(): ReasoningTrace[]
  getAuditLog(): AuditEntry[]
}
```

## 해시 산출

각 step: `sha256(name|inputSummary|outputSummary|confidence|durationMs)` 누적 연결.
체인: 이전 해시 || 현재 step 해시 반복. Node `crypto` 사용.

## 예외

- 존재하지 않는 traceId: `trace_not_found`
- 닫힌 trace에 addStep: `trace_closed`
- C/S등급: `grade_blocked`
- confidence 범위 밖: `invalid_confidence`

## 세션 가이드

구현 순서: 타입 → start → addStep(guard+검증) → close(해시) → list/get → audit
