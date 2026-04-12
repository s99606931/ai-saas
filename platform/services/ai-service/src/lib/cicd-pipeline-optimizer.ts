/**
 * AI 기반 CI/CD 파이프라인 최적화 — SVC-AI-ADV-R186
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R186/SVC-AI-ADV-R186.design.md
 * Plan SC: FR-R186.1 ~ FR-R186.5
 *
 * CI/CD 파이프라인 단계 성능 통계 + 병목 탐지 + 최적화 권고.
 * CSAP D-12, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface PipelineStage {
  id: string
  name: string
  expectedDurationMs: number
  parallelizable: boolean
  cacheable: boolean
}

export interface Pipeline {
  id: string
  name: string
  stages: PipelineStage[]
  targetTotalMs: number
}

export interface PipelineRun {
  pipelineId: string
  runId: string
  stageDurations: Record<string, number>
  startedAt: number
}

export interface StageStats {
  stageId: string
  stageName: string
  avgMs: number
  p95Ms: number
  maxMs: number
  sampleCount: number
  isBottleneck: boolean
}

export interface OptimizationTip {
  stageId: string
  stageName: string
  tip: string
}

export interface PipelineAnalysis {
  pipelineId: string
  stageStats: StageStats[]
  avgTotalMs: number
  bottlenecks: StageStats[]
  tips: OptimizationTip[]
  analysisAt: number
}

export interface CICDAuditEntry {
  action: 'pipelineRegistered' | 'runRecorded' | 'analyzed'
  timestamp: number
  details: Record<string, unknown>
}

export class CICDPipelineOptimizer {
  private readonly pipelines = new Map<string, Pipeline>()
  private readonly runs = new Map<string, PipelineRun[]>()
  private readonly auditLog: CICDAuditEntry[] = []

  constructor(grade: DataGrade) {
    if (grade !== DataGrade.O) {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 CI/CD 최적화 사용 금지 (N2SF N-05)`,
      )
    }
  }

  /** FR-R186.1 */
  registerPipeline(pipeline: Pipeline): void {
    if (!pipeline.id.trim()) throw new Error('pipeline id must not be empty')
    if (pipeline.stages.length === 0) throw new Error('at least one stage required')
    this.pipelines.set(pipeline.id, {
      ...pipeline,
      stages: pipeline.stages.map((s) => ({ ...s })),
    })
    this.audit('pipelineRegistered', { id: pipeline.id, stages: pipeline.stages.length })
  }

  /** FR-R186.2 */
  recordRun(run: PipelineRun): void {
    if (!this.pipelines.has(run.pipelineId)) {
      throw new Error(`unknown pipeline: ${run.pipelineId}`)
    }
    const arr = this.runs.get(run.pipelineId) ?? []
    arr.push({ ...run, stageDurations: { ...run.stageDurations } })
    this.runs.set(run.pipelineId, arr)
    this.audit('runRecorded', { pipelineId: run.pipelineId, runId: run.runId })
  }

  /** FR-R186.3 ~ FR-R186.4 */
  analyze(pipelineId: string): PipelineAnalysis {
    const pipeline = this.pipelines.get(pipelineId)
    if (!pipeline) throw new Error(`unknown pipeline: ${pipelineId}`)

    const pipelineRuns = this.runs.get(pipelineId) ?? []
    const stageStats: StageStats[] = []
    let totalAvgMs = 0

    for (const stage of pipeline.stages) {
      const durations = pipelineRuns
        .map((r) => r.stageDurations[stage.id])
        .filter((d): d is number => d !== undefined)

      if (durations.length === 0) continue

      const avg = durations.reduce((a, b) => a + b, 0) / durations.length
      const sorted = [...durations].sort((a, b) => a - b)
      const p95 = this.percentile(sorted, 95)
      const max = Math.max(...durations)
      const isBottleneck = avg > stage.expectedDurationMs * 1.5

      stageStats.push({
        stageId: stage.id,
        stageName: stage.name,
        avgMs: avg,
        p95Ms: p95,
        maxMs: max,
        sampleCount: durations.length,
        isBottleneck,
      })

      totalAvgMs += avg
    }

    const bottlenecks = stageStats.filter((s) => s.isBottleneck)

    const tips: OptimizationTip[] = []
    for (const stat of bottlenecks) {
      const stage = pipeline.stages.find((s) => s.id === stat.stageId)!
      if (stage.parallelizable) {
        tips.push({ stageId: stage.id, stageName: stage.name, tip: `${stage.name}: 병렬 실행 적용 권고 — 독립적 단계임` })
      } else if (stage.cacheable) {
        tips.push({ stageId: stage.id, stageName: stage.name, tip: `${stage.name}: 캐시 적용 권고 — 반복 실행 비용 절감 가능` })
      } else {
        tips.push({ stageId: stage.id, stageName: stage.name, tip: `${stage.name}: 병목 단계 — 단계 분리 또는 리소스 증가 검토` })
      }
    }

    const report: PipelineAnalysis = {
      pipelineId,
      stageStats,
      avgTotalMs: totalAvgMs,
      bottlenecks,
      tips,
      analysisAt: Date.now(),
    }

    this.audit('analyzed', { pipelineId, stages: stageStats.length, bottlenecks: bottlenecks.length })
    return report
  }

  /** FR-R186.5 */
  getAuditLog(): readonly CICDAuditEntry[] {
    return [...this.auditLog]
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0
    const idx = (p / 100) * (sorted.length - 1)
    const lo = Math.floor(idx)
    const hi = Math.ceil(idx)
    return lo === hi ? (sorted[lo] ?? 0) : (sorted[lo] ?? 0) + ((sorted[hi] ?? 0) - (sorted[lo] ?? 0)) * (idx - lo)
  }

  private audit(action: CICDAuditEntry['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ action, timestamp: Date.now(), details })
  }
}
