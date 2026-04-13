import { describe, it, expect, beforeEach } from 'vitest'
import { DataPipelineOptimizerAi, type Pipeline } from '../data-pipeline-optimizer-ai'

describe('DataPipelineOptimizerAi', () => {
  let optimizer: DataPipelineOptimizerAi

  const pipeline: Pipeline = {
    pipelineId: 'PL001',
    name: '공공 데이터 처리',
    stages: [
      { stageId: 'ST1', name: '수집', avgThroughputPerSec: 1000, avgLatencyMs: 100, errorRate: 0.01, dataGrade: 'O' },
      { stageId: 'ST2', name: '변환', avgThroughputPerSec: 500, avgLatencyMs: 300, errorRate: 0.02, dataGrade: 'O' },
      { stageId: 'ST3', name: '저장', avgThroughputPerSec: 800, avgLatencyMs: 200, errorRate: 0.01, dataGrade: 'O' },
    ],
  }

  beforeEach(() => {
    optimizer = new DataPipelineOptimizerAi()
    optimizer.registerPipeline(pipeline)
  })

  it('C/S 등급 스테이지 포함 → 차단', () => {
    const badPipeline: Pipeline = {
      ...pipeline,
      pipelineId: 'PL_BAD',
      stages: [{ stageId: 'ST_C', name: '기밀', avgThroughputPerSec: 100, avgLatencyMs: 100, errorRate: 0, dataGrade: 'C' }],
    }
    expect(() => optimizer.registerPipeline(badPipeline)).toThrow('BLOCKED')
  })

  it('병목 스테이지 = 최소 처리량 스테이지', () => {
    const report = optimizer.optimize('PL001')
    expect(report.bottleneckStageId).toBe('ST2')
    expect(report.overallThroughputPerSec).toBe(500)
  })

  it('고에러율(≥5%) 스테이지 → blockedStages 포함', () => {
    const errorPipeline: Pipeline = {
      ...pipeline,
      pipelineId: 'PL002',
      stages: [
        { stageId: 'ST_ERR', name: '오류스테이지', avgThroughputPerSec: 200, avgLatencyMs: 100, errorRate: 0.08, dataGrade: 'O' },
      ],
    }
    optimizer.registerPipeline(errorPipeline)
    const report = optimizer.optimize('PL002')
    expect(report.blockedStages).toContain('ST_ERR')
  })

  it('개선 예상률 > 0', () => {
    const report = optimizer.optimize('PL001')
    expect(report.estimatedImprovementPercent).toBeGreaterThan(0)
  })

  it('미등록 파이프라인 에러', () => {
    expect(() => optimizer.optimize('UNKNOWN')).toThrow()
  })

  it('최적화 후 감사 로그', () => {
    optimizer.optimize('PL001')
    const log = optimizer.getAuditLog()
    expect(log.some((e) => e.action === 'pipeline.optimize')).toBe(true)
  })
})
