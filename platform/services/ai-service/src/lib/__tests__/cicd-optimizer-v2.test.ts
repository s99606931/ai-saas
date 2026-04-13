// Plan SC: SVC-AI-ADV-R401-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { CicdOptimizerV2, type PipelineRun } from '../cicd-optimizer-v2'

describe('CicdOptimizerV2', () => {
  let optimizer: CicdOptimizerV2

  beforeEach(() => {
    optimizer = new CicdOptimizerV2()
  })

  const makeRun = (overrides: Partial<PipelineRun> = {}): PipelineRun => ({
    runId: 'RUN-1',
    pipelineId: 'PIPE-1',
    stages: [
      { stage: 'BUILD', durationMs: 60000, cached: false, success: true, parallelizable: true },
      { stage: 'TEST', durationMs: 120000, cached: false, success: true, parallelizable: true },
      { stage: 'SECURITY_SCAN', durationMs: 30000, cached: false, success: true, parallelizable: false },
      { stage: 'DEPLOY', durationMs: 20000, cached: false, success: true, parallelizable: false },
    ],
    totalDurationMs: 230000,
    triggeredBy: 'PUSH',
    branchName: 'main',
    ...overrides,
  })

  it('실행 데이터 없을 때 빈 제안 반환', () => {
    const result = optimizer.optimize('PIPE-1')
    expect(result.suggestions).toHaveLength(0)
    expect(result.estimatedTotalSavingMs).toBe(0)
    expect(result.avgDurationMs).toBe(0)
  })

  it('병렬화 가능 스테이지 2개 이상 → PARALLELIZE 제안', () => {
    optimizer.ingestRun(makeRun())
    const result = optimizer.optimize('PIPE-1')
    const parallelSuggestion = result.suggestions.find((s) => s.action === 'PARALLELIZE')
    expect(parallelSuggestion).toBeDefined()
    expect(parallelSuggestion?.estimatedSavingMs).toBeGreaterThan(0)
  })

  it('캐시 미적용 BUILD/TEST → CACHE_ENABLE 제안', () => {
    optimizer.ingestRun(makeRun())
    const result = optimizer.optimize('PIPE-1')
    const cacheSuggestions = result.suggestions.filter((s) => s.action === 'CACHE_ENABLE')
    expect(cacheSuggestions.length).toBeGreaterThanOrEqual(1)
  })

  it('병목 스테이지 탐지 → INCREASE_RESOURCES 제안', () => {
    optimizer.ingestRun(makeRun({
      runId: 'RUN-BTN',
      stages: [
        { stage: 'BUILD', durationMs: 200000, cached: false, success: true, parallelizable: false },
        { stage: 'TEST', durationMs: 30000, cached: false, success: true, parallelizable: false },
        { stage: 'DEPLOY', durationMs: 20000, cached: false, success: true, parallelizable: false },
      ],
      totalDurationMs: 250000,
    }))
    const result = optimizer.optimize('PIPE-1')
    const resourceSuggestion = result.suggestions.find((s) => s.action === 'INCREASE_RESOURCES')
    expect(resourceSuggestion).toBeDefined()
    expect(result.bottleneckStage).toBe('BUILD')
  })

  it('avgDurationMs 정확히 계산', () => {
    optimizer.ingestRun(makeRun({ runId: 'R1', totalDurationMs: 100000 }))
    optimizer.ingestRun(makeRun({ runId: 'R2', totalDurationMs: 200000 }))
    const result = optimizer.optimize('PIPE-1')
    expect(result.avgDurationMs).toBe(150000)
  })

  it('캐시된 스테이지는 PARALLELIZE 제안에서 제외', () => {
    optimizer.ingestRun(makeRun({
      runId: 'RUN-CACHED',
      stages: [
        { stage: 'BUILD', durationMs: 60000, cached: true, success: true, parallelizable: true },
        { stage: 'TEST', durationMs: 120000, cached: true, success: true, parallelizable: true },
      ],
      totalDurationMs: 180000,
    }))
    const result = optimizer.optimize('PIPE-1')
    const parallelSuggestion = result.suggestions.find((s) => s.action === 'PARALLELIZE')
    expect(parallelSuggestion).toBeUndefined()
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    optimizer.ingestRun(makeRun())
    optimizer.optimize('PIPE-1')
    const log1 = optimizer.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', pipelineId: 'X', detail: {} })
    const log2 = optimizer.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
