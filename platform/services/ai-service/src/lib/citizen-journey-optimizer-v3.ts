// Design Ref: §설계 결정 — 세션 단계별 이탈률/소요 기반 병목 제안
// Plan SC: SVC-AI-ADV-R616
import { createHash } from 'crypto'

export type DataGrade = 'O' | 'C' | 'S'

export interface JourneyStepEvent {
  citizenId: string
  stepId: string
  durationMs: number
  completed: boolean
}

export interface StepMetrics {
  stepId: string
  totalCount: number
  dropCount: number
  dropRate: number
  avgDurationMs: number
  expectedDurationMs: number
  bottleneck: boolean
  suggestion?: string
}

export interface AuditEntry {
  timestamp: string
  action: string
  details?: Record<string, unknown>
}

interface StepAgg {
  stepId: string
  expectedDurationMs: number
  totalCount: number
  dropCount: number
  durations: number[]
}

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16)
}

export class CitizenJourneyOptimizerV3 {
  private steps = new Map<string, StepAgg>()
  private auditLog: AuditEntry[] = []

  defineStep(stepId: string, expectedDurationMs: number): void {
    if (!stepId) throw new Error('stepId는 필수')
    if (expectedDurationMs <= 0) throw new Error('expectedDurationMs는 양수여야 합니다')
    this.steps.set(stepId, {
      stepId,
      expectedDurationMs,
      totalCount: 0,
      dropCount: 0,
      durations: [],
    })
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'step.define',
      details: { stepId },
    })
  }

  recordEvent(ev: JourneyStepEvent, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    const s = this.steps.get(ev.stepId)
    if (!s) throw new Error(`stepId 없음: ${ev.stepId}`)
    s.totalCount++
    if (!ev.completed) s.dropCount++
    else s.durations.push(ev.durationMs)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'event.record',
      details: { citizen: maskPII(ev.citizenId), stepId: ev.stepId },
    })
  }

  analyzeStep(stepId: string): StepMetrics {
    const s = this.steps.get(stepId)
    if (!s) throw new Error(`stepId 없음: ${stepId}`)
    const dropRate = s.totalCount === 0 ? 0 : s.dropCount / s.totalCount
    const avg =
      s.durations.length === 0
        ? 0
        : s.durations.reduce((a, b) => a + b, 0) / s.durations.length
    const bottleneck = dropRate > 0.3 || avg > s.expectedDurationMs * 1.5
    let suggestion: string | undefined
    if (bottleneck) {
      suggestion =
        dropRate > 0.3
          ? '단계 단순화 또는 설명 개선 검토'
          : '자동화 또는 사전입력 지원 검토'
    }
    return {
      stepId,
      totalCount: s.totalCount,
      dropCount: s.dropCount,
      dropRate: Math.round(dropRate * 10000) / 10000,
      avgDurationMs: Math.round(avg * 100) / 100,
      expectedDurationMs: s.expectedDurationMs,
      bottleneck,
      suggestion,
    }
  }

  analyzeAll(): StepMetrics[] {
    return Array.from(this.steps.keys()).map((id) => this.analyzeStep(id))
  }

  getBottlenecks(): StepMetrics[] {
    return this.analyzeAll().filter((m) => m.bottleneck)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
