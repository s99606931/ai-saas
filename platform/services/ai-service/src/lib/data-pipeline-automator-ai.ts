// Design Ref: §R254 — AI기반 데이터 파이프라인 자동화
// Plan SC: SVC-AI-ADV-R254-SC01
// CSAP D-06: 감사 로그, N2SF N-05: C/S등급 차단

export type DataGrade = 'C' | 'S' | 'O'
export type PipelineStatus = 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'BLOCKED'
export type StepType = 'EXTRACT' | 'TRANSFORM' | 'VALIDATE' | 'LOAD' | 'MASK'

export interface PipelineConfig {
  pipelineId: string
  name: string
  sourceDataGrade: DataGrade
  steps: StepType[]
  scheduleIntervalMinutes: number
}

export interface PipelineRun {
  pipelineId: string
  runId: string
  startedAt: number
  durationMs: number
  recordsProcessed: number
  errors: number
  status: PipelineStatus
}

export interface PipelineAnalysis {
  pipelineId: string
  lastStatus: PipelineStatus
  avgDurationMs: number
  avgRecordsPerRun: number
  errorRate: number
  recommendation: string
  alerts: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  pipelineId: string
  detail: Record<string, unknown>
}

export class DataPipelineAutomatorAi {
  private pipelines = new Map<string, PipelineConfig>()
  private runs = new Map<string, PipelineRun[]>()
  private auditLog: AuditEntry[] = []

  registerPipeline(config: PipelineConfig): void {
    // N2SF: C/S 등급 원천 데이터 파이프라인 차단
    if (config.sourceDataGrade === 'C' || config.sourceDataGrade === 'S') {
      throw new Error(`BLOCKED: ${config.sourceDataGrade}등급 데이터 파이프라인 자동화 금지 (N2SF N-05)`)
    }
    this.pipelines.set(config.pipelineId, config)
    this.runs.set(config.pipelineId, [])
    this.appendAudit('pipeline.register', config.pipelineId, { name: config.name, steps: config.steps })
  }

  recordRun(run: PipelineRun): void {
    if (!this.pipelines.has(run.pipelineId)) throw new Error(`Unknown pipeline: ${run.pipelineId}`)
    const list = this.runs.get(run.pipelineId) ?? []
    list.push(run)
    this.runs.set(run.pipelineId, list)
  }

  analyze(pipelineId: string): PipelineAnalysis {
    const pipeline = this.pipelines.get(pipelineId)
    if (!pipeline) throw new Error(`Unknown pipeline: ${pipelineId}`)

    const history = this.runs.get(pipelineId) ?? []
    const alerts: string[] = []

    if (history.length === 0) {
      return {
        pipelineId,
        lastStatus: 'IDLE',
        avgDurationMs: 0,
        avgRecordsPerRun: 0,
        errorRate: 0,
        recommendation: '파이프라인 실행 기록 없음 — 첫 실행 확인 필요',
        alerts: ['실행 기록 없음'],
      }
    }

    const recent = history.slice(-5)
    const lastRun = recent[recent.length - 1]!
    const avgDurationMs = recent.reduce((s, r) => s + r.durationMs, 0) / recent.length
    const avgRecords = recent.reduce((s, r) => s + r.recordsProcessed, 0) / recent.length
    const totalErrors = recent.reduce((s, r) => s + r.errors, 0)
    const totalRecords = recent.reduce((s, r) => s + r.recordsProcessed, 0)
    const errorRate = totalRecords > 0 ? totalErrors / totalRecords : 0

    if (lastRun.status === 'FAILED') alerts.push('최근 실행 실패 — 파이프라인 점검 필요')
    if (errorRate > 0.05) alerts.push(`오류율 ${Math.round(errorRate * 100)}% — 데이터 품질 점검 필요`)
    if (avgDurationMs > pipeline.scheduleIntervalMinutes * 60_000 * 0.8) {
      alerts.push('실행 시간이 스케줄 간격의 80% 초과 — 파이프라인 최적화 필요')
    }

    // VALIDATE 단계 없으면 경고
    if (!pipeline.steps.includes('VALIDATE')) {
      alerts.push('VALIDATE 단계 누락 — 데이터 품질 보증 불가')
    }

    const recommendation =
      lastRun.status === 'FAILED' ? '즉시 원인 분석 및 재실행 필요' :
      alerts.length > 0 ? '파이프라인 최적화 및 검증 단계 보강 권고' :
      '현재 파이프라인 정상 운영 중'

    this.appendAudit('pipeline.analyze', pipelineId, { lastStatus: lastRun.status, errorRate: Math.round(errorRate * 100) / 100 })

    return {
      pipelineId,
      lastStatus: lastRun.status,
      avgDurationMs: Math.round(avgDurationMs),
      avgRecordsPerRun: Math.round(avgRecords),
      errorRate: Math.round(errorRate * 100) / 100,
      recommendation,
      alerts,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, pipelineId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, pipelineId, detail })
  }
}
