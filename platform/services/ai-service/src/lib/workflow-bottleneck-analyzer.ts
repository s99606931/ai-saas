/**
 * 워크플로우 병목 분석기 — SVC-AI-ADV-R161
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R161/SVC-AI-ADV-R161.design.md
 * Plan SC: FR-R161.1 ~ FR-R161.6
 *
 * 업무 프로세스 단계별 처리 시간 통계 + z-score 기반 병목 탐지 + 개선 제안.
 * CSAP D-12, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

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
  zScore: number
}

export interface BottleneckReport {
  bottlenecks: StepStats[]
  suggestions: Array<{ stepId: string; suggestion: string }>
  overallAvgMinutes: number
  analysisAt: number
}

export interface BNAAuditEntry {
  action: 'stepRegistered' | 'eventRecorded' | 'analyzed'
  timestamp: number
  details: Record<string, unknown>
}

export class WorkflowBottleneckAnalyzer {
  private readonly steps = new Map<string, WorkflowStep>()
  private readonly events = new Map<string, StepEvent[]>()
  private readonly zThreshold: number
  private readonly auditLog: BNAAuditEntry[] = []

  constructor(grade: DataGrade, options: { zThreshold?: number } = {}) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 워크플로우 분석기 사용 금지 (N2SF N-05)`,
      )
    }
    this.zThreshold = options.zThreshold ?? 1.5
  }

  /** FR-R161.1 */
  registerStep(step: WorkflowStep): void {
    if (!step.id.trim()) throw new Error('step id must not be empty')
    if (step.expectedMinutes <= 0) throw new Error('expectedMinutes must be > 0')
    this.steps.set(step.id, { ...step })
    this.audit('stepRegistered', { id: step.id, name: step.name })
  }

  /** FR-R161.2 */
  recordEvent(event: StepEvent): void {
    if (!this.steps.has(event.stepId)) {
      throw new Error(`unknown step: ${event.stepId}`)
    }
    if (event.endAt < event.startAt) {
      throw new Error('endAt must be >= startAt')
    }
    const arr = this.events.get(event.stepId) ?? []
    arr.push({ ...event })
    this.events.set(event.stepId, arr)
    this.audit('eventRecorded', { stepId: event.stepId, instanceId: event.instanceId })
  }

  /** FR-R161.3 ~ FR-R161.5 */
  analyze(): BottleneckReport {
    const allStats: StepStats[] = []
    let overallSum = 0
    let overallCount = 0

    for (const [stepId, stepEvents] of this.events.entries()) {
      if (stepEvents.length === 0) continue
      const step = this.steps.get(stepId)!
      const durations = stepEvents.map((e) => (e.endAt - e.startAt) / 60000)
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length
      const p95 = this.percentile(durations, 95)
      const max = Math.max(...durations)
      overallSum += avg * durations.length
      overallCount += durations.length
      allStats.push({
        stepId,
        name: step.name,
        avgMinutes: avg,
        p95Minutes: p95,
        maxMinutes: max,
        sampleCount: durations.length,
        zScore: 0, // filled after overall mean/std
      })
    }

    const overallAvg = overallCount > 0 ? overallSum / overallCount : 0
    const allAvgs = allStats.map((s) => s.avgMinutes)
    const std = this.stddev(allAvgs)

    for (const stat of allStats) {
      stat.zScore = std > 0 ? (stat.avgMinutes - overallAvg) / std : 0
    }

    const bottlenecks = allStats.filter((s) => s.zScore > this.zThreshold)

    const suggestions = bottlenecks.map((stat) => {
      const step = this.steps.get(stat.stepId)!
      let suggestion: string
      if (stat.avgMinutes > step.expectedMinutes * 2) {
        suggestion = `${stat.name}: 평균 처리 시간이 예상의 2배 이상 — 병렬 처리 또는 자동화 검토 권고`
      } else if (stat.avgMinutes > step.expectedMinutes * 1.5) {
        suggestion = `${stat.name}: 처리 시간이 예상 대비 50% 초과 — 절차 간소화 또는 자동화 검토`
      } else {
        suggestion = `${stat.name}: 병목 단계 — 프로세스 재설계 검토`
      }
      return { stepId: stat.stepId, suggestion }
    })

    const report: BottleneckReport = {
      bottlenecks,
      suggestions,
      overallAvgMinutes: overallAvg,
      analysisAt: Date.now(),
    }

    this.audit('analyzed', { bottlenecks: bottlenecks.length, overallAvg })
    return report
  }

  /** FR-R161.6 */
  getAuditLog(): readonly BNAAuditEntry[] {
    return [...this.auditLog]
  }

  // ---------- private ----------

  private percentile(sorted: number[], p: number): number {
    const arr = [...sorted].sort((a, b) => a - b)
    if (arr.length === 0) return 0
    const idx = (p / 100) * (arr.length - 1)
    const lo = Math.floor(idx)
    const hi = Math.ceil(idx)
    return lo === hi ? (arr[lo] ?? 0) : (arr[lo] ?? 0) + ((arr[hi] ?? 0) - (arr[lo] ?? 0)) * (idx - lo)
  }

  private stddev(values: number[]): number {
    if (values.length === 0) return 0
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
    return Math.sqrt(variance)
  }

  private audit(action: BNAAuditEntry['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ action, timestamp: Date.now(), details })
  }
}
