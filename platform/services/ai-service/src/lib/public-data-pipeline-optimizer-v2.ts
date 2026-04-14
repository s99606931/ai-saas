// Design Ref: §R563 — AI기반 공공 데이터 파이프라인 최적화 v2
// Plan SC: SVC-AI-ADV-R563-SC01

export type PipelineIssueType = 'BOTTLENECK' | 'ERROR_PRONE' | 'HIGH_LATENCY' | 'UNDER_UTILIZED'
export type OptimizationStrategy = 'PARALLELIZE' | 'CACHE' | 'RETRY_POLICY' | 'SCALE_WORKERS' | 'OPTIMIZE_QUERY'

export interface PipelineStage {
  stageId: string
  name: string
  avgLatencyMs: number
  throughputRecordsPerSec: number
  expectedThroughputRecordsPerSec: number
  errorRatePct: number
  workerCount: number
}

export interface DataPipeline {
  pipelineId: string
  name: string
  sourceSystem: string
  targetSystem: string
  stages: PipelineStage[]
  scheduleCronExpr: string
}

export interface PipelineIssue {
  issueId: string
  pipelineId: string
  stageId: string
  issueType: PipelineIssueType
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  detail: string
}

export interface PipelineOptimization {
  pipelineId: string
  stageId: string
  strategy: OptimizationStrategy
  expectedImprovementPct: number
  reason: string
}

export interface PipelineOptimizationReport {
  totalPipelines: number
  issuesFound: PipelineIssue[]
  optimizations: PipelineOptimization[]
  healthyPipelineCount: number
  recommendations: string[]
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  pipelineId: string
  detail: Record<string, unknown>
}

export class PublicDataPipelineOptimizerV2 {
  private pipelines = new Map<string, DataPipeline>()
  private auditLog: AuditEntry[] = []

  registerPipeline(pipeline: DataPipeline): void {
    this.pipelines.set(pipeline.pipelineId, pipeline)
    this.appendAudit('pipeline.register', pipeline.pipelineId, { name: pipeline.name, stageCount: pipeline.stages.length })
  }

  analyze(): PipelineIssue[] {
    const allIssues: PipelineIssue[] = []
    for (const pipeline of this.pipelines.values()) {
      for (const stage of pipeline.stages) {
        allIssues.push(...this.analyzeStage(pipeline.pipelineId, stage))
      }
    }
    this.appendAudit('pipeline.analyze', 'system', { pipelineCount: this.pipelines.size, issueCount: allIssues.length })
    return allIssues
  }

  optimize(): PipelineOptimization[] {
    const optimizations: PipelineOptimization[] = []
    for (const pipeline of this.pipelines.values()) {
      for (const stage of pipeline.stages) {
        const stageOpts = this.buildOptimizations(pipeline.pipelineId, stage)
        optimizations.push(...stageOpts)
      }
    }
    this.appendAudit('pipeline.optimize', 'system', { optimizationCount: optimizations.length })
    return optimizations
  }

  generateReport(): PipelineOptimizationReport {
    const issues = this.analyze()
    const optimizations = this.optimize()
    const allPipelines = Array.from(this.pipelines.values())

    const affectedPipelineIds = new Set(issues.map((i) => i.pipelineId))
    const healthyPipelineCount = allPipelines.filter((p) => !affectedPipelineIds.has(p.pipelineId)).length

    const criticalCount = issues.filter((i) => i.severity === 'CRITICAL').length
    const highCount = issues.filter((i) => i.severity === 'HIGH').length
    const recommendations: string[] = []
    if (criticalCount > 0) recommendations.push(`CRITICAL 병목 ${criticalCount}건 즉시 처리 필요`)
    if (highCount > 0) recommendations.push(`HIGH 이슈 ${highCount}건 — 48시간 내 최적화 권장`)

    this.appendAudit('report.generate', 'system', { totalPipelines: allPipelines.length, issueCount: issues.length })
    return {
      totalPipelines: allPipelines.length,
      issuesFound: issues,
      optimizations,
      healthyPipelineCount,
      recommendations,
      generatedAt: new Date().toISOString(),
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private analyzeStage(pipelineId: string, stage: PipelineStage): PipelineIssue[] {
    const issues: PipelineIssue[] = []

    if (stage.throughputRecordsPerSec < stage.expectedThroughputRecordsPerSec * 0.7) {
      issues.push({
        issueId: `ISS-${pipelineId}-${stage.stageId}-BTL`,
        pipelineId,
        stageId: stage.stageId,
        issueType: 'BOTTLENECK',
        severity: 'CRITICAL',
        detail: `처리량 ${stage.throughputRecordsPerSec}/s — 기대치(${stage.expectedThroughputRecordsPerSec}/s)의 70% 미달`,
      })
    }
    if (stage.errorRatePct > 5) {
      issues.push({
        issueId: `ISS-${pipelineId}-${stage.stageId}-ERR`,
        pipelineId,
        stageId: stage.stageId,
        issueType: 'ERROR_PRONE',
        severity: 'HIGH',
        detail: `오류율 ${stage.errorRatePct}% — 임계값(5%) 초과`,
      })
    }
    if (stage.avgLatencyMs > 1000) {
      issues.push({
        issueId: `ISS-${pipelineId}-${stage.stageId}-LAT`,
        pipelineId,
        stageId: stage.stageId,
        issueType: 'HIGH_LATENCY',
        severity: 'MEDIUM',
        detail: `평균 지연 ${stage.avgLatencyMs}ms — 임계값(1000ms) 초과`,
      })
    }
    return issues
  }

  private buildOptimizations(pipelineId: string, stage: PipelineStage): PipelineOptimization[] {
    const opts: PipelineOptimization[] = []

    if (stage.throughputRecordsPerSec < stage.expectedThroughputRecordsPerSec * 0.7) {
      opts.push({ pipelineId, stageId: stage.stageId, strategy: 'PARALLELIZE', expectedImprovementPct: 40, reason: '병목 단계 병렬 처리로 처리량 개선' })
    }
    if (stage.errorRatePct > 5) {
      opts.push({ pipelineId, stageId: stage.stageId, strategy: 'RETRY_POLICY', expectedImprovementPct: 30, reason: '오류 재시도 정책 적용으로 안정성 향상' })
    }
    if (stage.avgLatencyMs > 1000) {
      opts.push({ pipelineId, stageId: stage.stageId, strategy: 'CACHE', expectedImprovementPct: 25, reason: '중간 결과 캐싱으로 지연 감소' })
    }
    return opts
  }

  private appendAudit(action: string, pipelineId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, pipelineId, detail })
  }
}
