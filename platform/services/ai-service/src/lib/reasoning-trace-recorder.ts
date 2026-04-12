/**
 * Reasoning Trace Recorder — SVC-AI-ADV-R143
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R143.design.md
 * Plan SC: FR-R143.1 ~ FR-R143.6
 *
 * AI 의사결정 단계별 추론 과정을 실시간 기록하고 체인 해시로 무결성 보장.
 * 원문은 저장하지 않고 요약만 저장하여 N2SF O등급 데이터 경계 준수.
 */

import { createHash } from 'node:crypto'

export type DataGrade = 'O' | 'C' | 'S'
export type TraceStatus = 'OPEN' | 'CLOSED'

export interface TraceStep {
  name: string
  inputSummary: string
  outputSummary: string
  confidence: number
  durationMs: number
  at: number
}

export interface ReasoningTrace {
  traceId: string
  label: string
  startedAt: number
  closedAt?: number
  status: TraceStatus
  steps: TraceStep[]
  chainHash?: string
  avgConfidence?: number
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface RecorderOptions {
  now?: () => number
  maxStepsPerTrace?: number
}

export class ReasoningTraceRecorder {
  private readonly traces = new Map<string, ReasoningTrace>()
  private readonly auditLog: AuditEntry[] = []
  private readonly now: () => number
  private readonly maxStepsPerTrace: number
  private seq = 0

  constructor(opts: RecorderOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
    this.maxStepsPerTrace = opts.maxStepsPerTrace ?? 10_000
  }

  /** FR-R143.1: 트레이스 시작 */
  start(label: string, grade: DataGrade = 'O'): string {
    this.assertGrade(grade)
    if (!label || label.length === 0) {
      throw new Error('invalid_label')
    }
    const traceId = this.nextId()
    const trace: ReasoningTrace = {
      traceId,
      label,
      startedAt: this.now(),
      status: 'OPEN',
      steps: [],
    }
    this.traces.set(traceId, trace)
    this.audit('trace_started', { traceId, label })
    return traceId
  }

  /** FR-R143.2: 단계 추가 */
  addStep(
    traceId: string,
    step: Omit<TraceStep, 'at'>,
    grade: DataGrade = 'O',
  ): void {
    this.assertGrade(grade)
    const trace = this.traces.get(traceId)
    if (!trace) {
      throw new Error('trace_not_found')
    }
    if (trace.status === 'CLOSED') {
      throw new Error('trace_closed')
    }
    if (step.confidence < 0 || step.confidence > 1) {
      throw new Error('invalid_confidence')
    }
    if (step.durationMs < 0) {
      throw new Error('invalid_duration')
    }
    if (trace.steps.length >= this.maxStepsPerTrace) {
      throw new Error('step_limit_exceeded')
    }
    trace.steps.push({ ...step, at: this.now() })
    this.audit('step_added', { traceId, name: step.name })
  }

  /** FR-R143.3 + FR-R143.4: 트레이스 종결 및 해시·신뢰도 산출 */
  close(traceId: string): ReasoningTrace {
    const trace = this.traces.get(traceId)
    if (!trace) {
      throw new Error('trace_not_found')
    }
    if (trace.status === 'CLOSED') {
      return trace
    }
    trace.status = 'CLOSED'
    trace.closedAt = this.now()
    trace.chainHash = this.computeChainHash(trace.steps)
    trace.avgConfidence = this.computeAvgConfidence(trace.steps)
    this.audit('trace_closed', {
      traceId,
      steps: trace.steps.length,
      chainHash: trace.chainHash,
    })
    return trace
  }

  get(traceId: string): ReasoningTrace | undefined {
    return this.traces.get(traceId)
  }

  list(): ReasoningTrace[] {
    return Array.from(this.traces.values())
  }

  /** FR-R143.5: 감사 로그 조회 */
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  // === 내부 유틸 ===

  private computeChainHash(steps: TraceStep[]): string {
    let prev = ''
    for (const step of steps) {
      const stepHash = createHash('sha256')
        .update(
          [
            step.name,
            step.inputSummary,
            step.outputSummary,
            step.confidence.toFixed(6),
            String(step.durationMs),
          ].join('|'),
        )
        .digest('hex')
      prev = createHash('sha256').update(prev + stepHash).digest('hex')
    }
    return prev || createHash('sha256').update('empty').digest('hex')
  }

  private computeAvgConfidence(steps: TraceStep[]): number {
    if (steps.length === 0) return 0
    const sum = steps.reduce((acc, s) => acc + s.confidence, 0)
    return sum / steps.length
  }

  /** FR-R143.6: C/S등급 차단 */
  private assertGrade(grade: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error('grade_blocked')
    }
  }

  private audit(event: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ event, detail, at: this.now() })
  }

  private nextId(): string {
    this.seq += 1
    return `trace-${this.now()}-${this.seq}`
  }
}
