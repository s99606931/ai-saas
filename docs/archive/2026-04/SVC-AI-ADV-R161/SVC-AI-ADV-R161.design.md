# SVC-AI-ADV-R161 — 워크플로우 병목 분석기 (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export interface WorkflowStep {
  id: string
  name: string
  expectedMinutes: number
}

export interface StepEvent {
  stepId: string
  instanceId: string
  startAt: number
  endAt: number
}

export interface StepStats {
  stepId: string
  name: string
  avgMinutes: number
  p95Minutes: number
  maxMinutes: number
  sampleCount: number
  zScore: number          // 대비 전체 평균
}

export interface BottleneckReport {
  bottlenecks: StepStats[]
  suggestions: Array<{ stepId: string; suggestion: string }>
  overallAvgMinutes: number
  analysisAt: number
}

class WorkflowBottleneckAnalyzer {
  constructor(grade: DataGrade, options?: { zThreshold?: number })
  registerStep(step: WorkflowStep): void
  recordEvent(event: StepEvent): void
  analyze(): BottleneckReport
  getAuditLog(): readonly AuditEntry[]
}
```

## 알고리즘

- 각 단계 처리시간 = endAt - startAt (ms → 분)
- p95: 정렬 후 95번째 백분위수
- z-score: (단계 평균 - 전체 평균) / 전체 표준편차
- 병목: z-score > zThreshold(기본 1.5)
- 제안: expected 대비 실제 > 2배 → "병렬 처리 검토", > 1.5배 → "자동화 검토"
