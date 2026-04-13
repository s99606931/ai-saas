import { describe, it, expect, beforeEach } from 'vitest'
import { DataPipelineAutomatorAi, type PipelineConfig, type PipelineRun } from '../data-pipeline-automator-ai'

describe('DataPipelineAutomatorAi', () => {
  let ai: DataPipelineAutomatorAi

  const config: PipelineConfig = {
    pipelineId: 'PIPE001',
    name: '민원 데이터 파이프라인',
    sourceDataGrade: 'O',
    steps: ['EXTRACT', 'TRANSFORM', 'VALIDATE', 'LOAD'],
    scheduleIntervalMinutes: 60,
  }

  const makeRun = (status: PipelineRun['status'], durationMs: number, errors: number): PipelineRun => ({
    pipelineId: 'PIPE001',
    runId: `RUN_${Date.now()}`,
    startedAt: Date.now(),
    durationMs,
    recordsProcessed: 1000,
    errors,
    status,
  })

  beforeEach(() => {
    ai = new DataPipelineAutomatorAi()
    ai.registerPipeline(config)
  })

  it('C등급 파이프라인 등록 차단', () => {
    expect(() => ai.registerPipeline({ ...config, pipelineId: 'P_C', sourceDataGrade: 'C' })).toThrow('BLOCKED')
  })

  it('S등급 파이프라인 등록 차단', () => {
    expect(() => ai.registerPipeline({ ...config, pipelineId: 'P_S', sourceDataGrade: 'S' })).toThrow('BLOCKED')
  })

  it('파이프라인 등록 감사 로그', () => {
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'pipeline.register')).toBe(true)
  })

  it('실행 없으면 IDLE + 알림', () => {
    const result = ai.analyze('PIPE001')
    expect(result.lastStatus).toBe('IDLE')
    expect(result.alerts.length).toBeGreaterThan(0)
  })

  it('정상 실행 → COMPLETED', () => {
    for (let i = 0; i < 3; i++) ai.recordRun(makeRun('COMPLETED', 5000, 0))
    const result = ai.analyze('PIPE001')
    expect(result.lastStatus).toBe('COMPLETED')
  })

  it('최근 실행 실패 → FAILED 알림', () => {
    ai.recordRun(makeRun('FAILED', 3000, 50))
    const result = ai.analyze('PIPE001')
    expect(result.lastStatus).toBe('FAILED')
    expect(result.alerts.some((a) => a.includes('실패'))).toBe(true)
  })

  it('VALIDATE 단계 누락 → 알림', () => {
    ai.registerPipeline({ ...config, pipelineId: 'PIPE002', steps: ['EXTRACT', 'LOAD'] })
    ai.recordRun({ ...makeRun('COMPLETED', 3000, 0), pipelineId: 'PIPE002' })
    const result = ai.analyze('PIPE002')
    expect(result.alerts.some((a) => a.includes('VALIDATE'))).toBe(true)
  })

  it('미등록 파이프라인 에러', () => {
    expect(() => ai.analyze('UNKNOWN')).toThrow()
  })

  it('분석 후 감사 로그', () => {
    ai.recordRun(makeRun('COMPLETED', 3000, 0))
    ai.analyze('PIPE001')
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'pipeline.analyze')).toBe(true)
  })
})
