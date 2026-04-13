// Design Ref: §R363 — AI기반 데이터 파이프라인 최적화
// Plan SC: SC-R363

export interface PipelineStage {
  stageId: string
  name: string
  avgThroughputPerSec: number
  avgLatencyMs: number
  errorRate: number
  dataGrade: 'C' | 'S' | 'O'
}

export interface Pipeline {
  pipelineId: string
  name: string
  stages: PipelineStage[]
}

export interface PipelineOptimizationReport {
  pipelineId: string
  overallThroughputPerSec: number
  bottleneckStageId: string | null
  blockedStages: string[]
  recommendations: string[]
  estimatedImprovementPercent: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class DataPipelineOptimizerAi {
  private pipelines = new Map<string, Pipeline>()
  private auditLog: AuditEntry[] = []

  registerPipeline(pipeline: Pipeline): void {
    // N2SF: C/S 등급 스테이지 포함 파이프라인 차단
    const blockedStage = pipeline.stages.find((s) => s.dataGrade === 'C' || s.dataGrade === 'S')
    if (blockedStage) {
      throw new Error(`BLOCKED: ${blockedStage.dataGrade}등급 스테이지 포함 파이프라인 차단 (N2SF N-05)`)
    }
    this.pipelines.set(pipeline.pipelineId, pipeline)
    this.auditLog.push({ action: 'pipeline.register', timestamp: new Date().toISOString(), detail: pipeline.pipelineId })
  }

  optimize(pipelineId: string): PipelineOptimizationReport {
    const pipeline = this.pipelines.get(pipelineId)
    if (!pipeline) throw new Error(`Pipeline not found: ${pipelineId}`)

    const stages = pipeline.stages
    if (stages.length === 0) {
      this.auditLog.push({ action: 'pipeline.optimize', timestamp: new Date().toISOString(), detail: `${pipelineId}:empty` })
      return { pipelineId, overallThroughputPerSec: 0, bottleneckStageId: null, blockedStages: [], recommendations: [], estimatedImprovementPercent: 0 }
    }

    // 전체 처리량: 파이프라인 병목(최소 처리량)에 의해 결정
    const bottleneckStage = stages.reduce((min, s) => s.avgThroughputPerSec < min.avgThroughputPerSec ? s : min, stages[0]!)
    const overallThroughputPerSec = bottleneckStage.avgThroughputPerSec

    // 고에러율 스테이지 차단 목록
    const blockedStages = stages.filter((s) => s.errorRate >= 0.05).map((s) => s.stageId)

    const recommendations: string[] = []
    if (blockedStages.length > 0) {
      recommendations.push(`고에러율 스테이지 ${blockedStages.join(', ')} — 에러 원인 분석 필요`)
    }

    // 최대 처리량 스테이지 대비 병목 개선 시 예상 향상률
    const maxThroughput = Math.max(...stages.map((s) => s.avgThroughputPerSec))
    const estimatedImprovementPercent = overallThroughputPerSec > 0
      ? Math.round(((maxThroughput - overallThroughputPerSec) / overallThroughputPerSec) * 100)
      : 0

    if (estimatedImprovementPercent > 0) {
      recommendations.push(`병목 스테이지 '${bottleneckStage.stageId}' 개선 시 최대 ${estimatedImprovementPercent}% 처리량 향상 가능`)
    }

    // 고레이턴시 단계 권고
    const highLatency = stages.filter((s) => s.avgLatencyMs >= 1000)
    if (highLatency.length > 0) {
      recommendations.push(`고레이턴시 스테이지 ${highLatency.map((s) => s.stageId).join(', ')} — 캐시 또는 병렬 처리 검토`)
    }

    this.auditLog.push({ action: 'pipeline.optimize', timestamp: new Date().toISOString(), detail: `${pipelineId}:throughput=${overallThroughputPerSec}` })
    return { pipelineId, overallThroughputPerSec, bottleneckStageId: bottleneckStage.stageId, blockedStages, recommendations, estimatedImprovementPercent }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
