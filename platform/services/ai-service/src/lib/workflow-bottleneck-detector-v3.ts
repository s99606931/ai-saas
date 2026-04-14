// Design Ref: §설계 결정 — 단계별 기대시간 대비 평균, 큐 임계값
// Plan SC: SVC-AI-ADV-R610
import { createHash } from 'crypto'

export type DataGrade = 'O' | 'C' | 'S'

export interface WorkflowStep {
  stepId: string
  name: string
  expectedMs: number
  samples: number[]
  queueSize: number
  assigneeMasked?: string
}

export type Severity = 'NORMAL' | 'WARNING' | 'BOTTLENECK' | 'CRITICAL'

export interface BottleneckReport {
  stepId: string
  name: string
  avgMs: number
  expectedMs: number
  ratio: number
  queueSize: number
  severity: Severity
}

export interface AuditEntry {
  timestamp: string
  action: string
  actor?: string
  details?: Record<string, unknown>
}

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16)
}

export class WorkflowBottleneckDetectorV3 {
  private steps = new Map<string, WorkflowStep>()
  private auditLog: AuditEntry[] = []

  registerStep(stepId: string, name: string, expectedMs: number, assignee?: string): void {
    if (!stepId || !name) throw new Error('stepId와 name은 필수')
    if (expectedMs <= 0) throw new Error('expectedMs는 양수여야 합니다')
    this.steps.set(stepId, {
      stepId,
      name,
      expectedMs,
      samples: [],
      queueSize: 0,
      assigneeMasked: assignee ? maskPII(assignee) : undefined,
    })
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'step.register',
      details: { stepId },
    })
  }

  recordSample(stepId: string, durationMs: number, queueSize = 0, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    const step = this.steps.get(stepId)
    if (!step) throw new Error(`stepId 없음: ${stepId}`)
    if (durationMs < 0) throw new Error('durationMs는 음수일 수 없습니다')
    step.samples.push(durationMs)
    step.queueSize = queueSize
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'sample.record',
      details: { stepId, durationMs, queueSize },
    })
  }

  detect(stepId: string): BottleneckReport {
    const step = this.steps.get(stepId)
    if (!step) throw new Error(`stepId 없음: ${stepId}`)
    const samples = step.samples
    if (samples.length === 0) {
      return {
        stepId,
        name: step.name,
        avgMs: 0,
        expectedMs: step.expectedMs,
        ratio: 0,
        queueSize: step.queueSize,
        severity: 'NORMAL',
      }
    }
    const avg = samples.reduce((s, v) => s + v, 0) / samples.length
    const ratio = Math.round((avg / step.expectedMs) * 100) / 100
    let severity: Severity = 'NORMAL'
    if (ratio >= 1.5) severity = 'BOTTLENECK'
    else if (ratio >= 1.2) severity = 'WARNING'
    if (ratio >= 2 || step.queueSize > 50) severity = 'CRITICAL'
    return {
      stepId,
      name: step.name,
      avgMs: Math.round(avg * 100) / 100,
      expectedMs: step.expectedMs,
      ratio,
      queueSize: step.queueSize,
      severity,
    }
  }

  detectAll(): BottleneckReport[] {
    return Array.from(this.steps.keys()).map((id) => this.detect(id))
  }

  getAlerts(): BottleneckReport[] {
    return this.detectAll().filter((r) => r.severity !== 'NORMAL')
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
