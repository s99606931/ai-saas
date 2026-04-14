// Plan SC: SVC-AI-ADV-R563-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { PublicDataPipelineOptimizerV2, type DataPipeline } from '../public-data-pipeline-optimizer-v2'

describe('PublicDataPipelineOptimizerV2', () => {
  let optimizer: PublicDataPipelineOptimizerV2

  const healthyPipeline: DataPipeline = {
    pipelineId: 'PIPE-1',
    name: '민원 데이터 수집',
    sourceSystem: 'LEGACY_DB',
    targetSystem: 'DATA_LAKE',
    scheduleCronExpr: '0 2 * * *',
    stages: [
      {
        stageId: 'STG-1', name: '추출',
        avgLatencyMs: 300, throughputRecordsPerSec: 500, expectedThroughputRecordsPerSec: 500,
        errorRatePct: 0.5, workerCount: 2,
      },
    ],
  }

  const bottleneckPipeline: DataPipeline = {
    ...healthyPipeline,
    pipelineId: 'PIPE-BTL',
    stages: [
      {
        stageId: 'STG-BTL', name: '변환',
        avgLatencyMs: 200, throughputRecordsPerSec: 100, expectedThroughputRecordsPerSec: 500,
        errorRatePct: 1, workerCount: 1,
      },
    ],
  }

  beforeEach(() => {
    optimizer = new PublicDataPipelineOptimizerV2()
  })

  it('파이프라인 없을 때 → 이슈 없음', () => {
    const issues = optimizer.analyze()
    expect(issues).toHaveLength(0)
  })

  it('정상 파이프라인 → 이슈 없음', () => {
    optimizer.registerPipeline(healthyPipeline)
    const issues = optimizer.analyze()
    expect(issues).toHaveLength(0)
  })

  it('처리량 70% 미달 → BOTTLENECK CRITICAL 이슈', () => {
    optimizer.registerPipeline(bottleneckPipeline)
    const issues = optimizer.analyze()
    expect(issues.some((i) => i.issueType === 'BOTTLENECK' && i.severity === 'CRITICAL')).toBe(true)
  })

  it('오류율 5% 초과 → ERROR_PRONE HIGH 이슈', () => {
    optimizer.registerPipeline({
      ...healthyPipeline, pipelineId: 'PIPE-ERR',
      stages: [{ ...healthyPipeline.stages[0]!, stageId: 'STG-ERR', errorRatePct: 8 }],
    })
    const issues = optimizer.analyze()
    expect(issues.some((i) => i.issueType === 'ERROR_PRONE' && i.severity === 'HIGH')).toBe(true)
  })

  it('지연 1000ms 초과 → HIGH_LATENCY 이슈', () => {
    optimizer.registerPipeline({
      ...healthyPipeline, pipelineId: 'PIPE-LAT',
      stages: [{ ...healthyPipeline.stages[0]!, stageId: 'STG-LAT', avgLatencyMs: 1500 }],
    })
    const issues = optimizer.analyze()
    expect(issues.some((i) => i.issueType === 'HIGH_LATENCY')).toBe(true)
  })

  it('BOTTLENECK → PARALLELIZE 최적화 권고', () => {
    optimizer.registerPipeline(bottleneckPipeline)
    const opts = optimizer.optimize()
    expect(opts.some((o) => o.strategy === 'PARALLELIZE')).toBe(true)
  })

  it('generateReport: 건강한 파이프라인 카운트 포함', () => {
    optimizer.registerPipeline(healthyPipeline)
    optimizer.registerPipeline(bottleneckPipeline)
    const report = optimizer.generateReport()
    expect(report.totalPipelines).toBe(2)
    expect(report.healthyPipelineCount).toBe(1)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    optimizer.registerPipeline(healthyPipeline)
    optimizer.generateReport()
    const log1 = optimizer.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', pipelineId: 'X', detail: {} })
    const log2 = optimizer.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
