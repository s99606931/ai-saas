// Plan SC: SVC-AI-ADV-R345
import { describe, it, expect, beforeEach } from 'vitest'
import { DevSecOpsPipelineAI } from '../devsecops-pipeline-ai'

describe('DevSecOpsPipelineAI', () => {
  let pipeline: DevSecOpsPipelineAI

  beforeEach(() => {
    pipeline = new DevSecOpsPipelineAI()
  })

  it('registerPipeline — 감사 로그에 pipeline.register 기록', () => {
    pipeline.registerPipeline('pl-1', 'CI Pipeline', ['build', 'test', 'sast'])
    const log = pipeline.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('pipeline.register')
    expect(log[0]!.detail).toBe('pl-1')
  })

  it('getPipelineScore — 모든 단계 통과 시 pipelineScore=100', () => {
    pipeline.registerPipeline('pl-1', 'CI Pipeline', ['build', 'test', 'sast'])
    pipeline.recordStepResult('pl-1', 'build', true, 0)
    pipeline.recordStepResult('pl-1', 'test', true, 0)
    pipeline.recordStepResult('pl-1', 'sast', true, 0)
    const result = pipeline.getPipelineScore('pl-1')
    expect(result.pipelineScore).toBe(100)
    expect(result.pipelineStatus).toBe('passed')
    expect(result.passCount).toBe(3)
    expect(result.totalSteps).toBe(3)
  })

  it('getPipelineScore — 일부 실패 시 pipelineStatus=failed', () => {
    pipeline.registerPipeline('pl-1', 'CI Pipeline', ['build', 'test', 'sast'])
    pipeline.recordStepResult('pl-1', 'build', true, 0)
    pipeline.recordStepResult('pl-1', 'test', false, 5)
    pipeline.recordStepResult('pl-1', 'sast', true, 0)
    const result = pipeline.getPipelineScore('pl-1')
    expect(result.pipelineStatus).toBe('failed')
    // passCount=2, totalSteps=3 → 66%
    expect(result.pipelineScore).toBe(67)
  })

  it('getFailedSteps — 실패한 단계만 반환', () => {
    pipeline.registerPipeline('pl-1', 'CI Pipeline', ['build', 'test', 'sast'])
    pipeline.recordStepResult('pl-1', 'build', true, 0)
    pipeline.recordStepResult('pl-1', 'test', false, 3)
    pipeline.recordStepResult('pl-1', 'sast', false, 2)
    const failed = pipeline.getFailedSteps('pl-1')
    expect(failed).toHaveLength(2)
    expect(failed.map((f) => f.stepName)).toContain('test')
    expect(failed.map((f) => f.stepName)).toContain('sast')
  })

  it('recordStepResult — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    pipeline.registerPipeline('pl-1', 'CI Pipeline', ['build'])
    expect(() => pipeline.recordStepResult('pl-1', 'build', true, 0, 'C')).toThrow('BLOCKED')
  })

  it('recordStepResult — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    pipeline.registerPipeline('pl-1', 'CI Pipeline', ['build'])
    expect(() => pipeline.recordStepResult('pl-1', 'build', true, 0, 'S')).toThrow('N2SF N-05')
  })

  it('registerPipeline — steps 없을 때 에러', () => {
    expect(() => pipeline.registerPipeline('pl-1', 'CI Pipeline', [])).toThrow('1개 이상')
  })

  it('getPipelineScore — 단계 결과 없을 때 pipelineScore=0, pipelineStatus=passed', () => {
    pipeline.registerPipeline('pl-1', 'CI Pipeline', ['build', 'test'])
    const result = pipeline.getPipelineScore('pl-1')
    expect(result.pipelineScore).toBe(0)
    expect(result.pipelineStatus).toBe('passed')
    expect(result.passCount).toBe(0)
  })
})
