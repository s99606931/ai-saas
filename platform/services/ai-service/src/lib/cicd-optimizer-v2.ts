// Design Ref: §R401 — AI기반 자동 CI/CD 최적화 v2
// Plan SC: SVC-AI-ADV-R401-SC01

export type PipelineStage = 'BUILD' | 'TEST' | 'SECURITY_SCAN' | 'DEPLOY' | 'SMOKE_TEST'
export type OptimizationAction = 'PARALLELIZE' | 'CACHE_ENABLE' | 'SKIP_UNCHANGED' | 'INCREASE_RESOURCES' | 'NONE'

export interface PipelineRun {
  runId: string
  pipelineId: string
  stages: Array<{
    stage: PipelineStage
    durationMs: number
    cached: boolean
    success: boolean
    parallelizable: boolean
  }>
  totalDurationMs: number
  triggeredBy: 'PUSH' | 'PR' | 'SCHEDULE' | 'MANUAL'
  branchName: string
}

export interface OptimizationSuggestion {
  pipelineId: string
  suggestions: Array<{ action: OptimizationAction; stage?: PipelineStage; reason: string; estimatedSavingMs: number }>
  estimatedTotalSavingMs: number
  avgDurationMs: number
  bottleneckStage?: PipelineStage
}

interface AuditEntry {
  timestamp: string
  action: string
  pipelineId: string
  detail: Record<string, unknown>
}

export class CicdOptimizerV2 {
  private runs = new Map<string, PipelineRun[]>()
  private auditLog: AuditEntry[] = []

  ingestRun(run: PipelineRun): void {
    const list = this.runs.get(run.pipelineId) ?? []
    list.push(run)
    this.runs.set(run.pipelineId, list)
  }

  optimize(pipelineId: string): OptimizationSuggestion {
    const runs = this.runs.get(pipelineId) ?? []
    this.appendAudit('pipeline.optimize', pipelineId, { runCount: runs.length })

    if (runs.length === 0) {
      return { pipelineId, suggestions: [], estimatedTotalSavingMs: 0, avgDurationMs: 0 }
    }

    const avgDurationMs = runs.reduce((s, r) => s + r.totalDurationMs, 0) / runs.length
    const suggestions: OptimizationSuggestion['suggestions'] = []

    // 최신 실행 기준 분석
    const latest = runs[runs.length - 1] ?? runs[0]
    if (!latest) {
      return { pipelineId, suggestions: [], estimatedTotalSavingMs: 0, avgDurationMs }
    }

    // 병렬화 가능 스테이지 탐지
    const parallelizable = latest.stages.filter((s) => s.parallelizable && !s.cached)
    if (parallelizable.length >= 2) {
      const saving = parallelizable.reduce((s, st) => s + st.durationMs, 0) * 0.4
      suggestions.push({
        action: 'PARALLELIZE',
        reason: `${parallelizable.length}개 스테이지 병렬 실행 가능`,
        estimatedSavingMs: Math.round(saving),
      })
    }

    // 캐시 미적용 스테이지 탐지
    const uncached = latest.stages.filter((s) => !s.cached && (s.stage === 'BUILD' || s.stage === 'TEST'))
    for (const stage of uncached) {
      suggestions.push({
        action: 'CACHE_ENABLE',
        stage: stage.stage,
        reason: `${stage.stage} 캐시 비활성화 — 캐시 활성화로 시간 단축 가능`,
        estimatedSavingMs: Math.round(stage.durationMs * 0.6),
      })
    }

    // 병목 스테이지 탐지 (전체 시간의 40% 이상)
    const bottleneck = latest.stages.reduce((a, b) => a.durationMs > b.durationMs ? a : b)
    let bottleneckStage: PipelineStage | undefined
    if (bottleneck.durationMs > latest.totalDurationMs * 0.4) {
      bottleneckStage = bottleneck.stage
      suggestions.push({
        action: 'INCREASE_RESOURCES',
        stage: bottleneck.stage,
        reason: `${bottleneck.stage}가 전체 시간의 ${Math.round(bottleneck.durationMs / latest.totalDurationMs * 100)}% 차지 — 리소스 증가 권고`,
        estimatedSavingMs: Math.round(bottleneck.durationMs * 0.3),
      })
    }

    const estimatedTotalSavingMs = suggestions.reduce((s, sg) => s + sg.estimatedSavingMs, 0)

    return { pipelineId, suggestions, estimatedTotalSavingMs, avgDurationMs, bottleneckStage }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, pipelineId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, pipelineId, detail })
  }
}
