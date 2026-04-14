import { describe, it, expect, beforeEach } from 'vitest'
import { FailurePatternLearnerV2 } from '../failure-pattern-learner-v2'

describe('FailurePatternLearnerV2', () => {
  let learner: FailurePatternLearnerV2
  beforeEach(() => { learner = new FailurePatternLearnerV2() })

  it('패턴 등록 후 조회 가능', () => {
    const pattern = learner.registerPattern('pat-1', 'OOM', ['메모리 급증', '응답 지연'])
    expect(pattern.patternId).toBe('pat-1')
    expect(pattern.indicators).toHaveLength(2)
  })

  it('발생 빈도 초기값 0', () => {
    learner.registerPattern('pat-1', 'OOM', [])
    expect(learner.getPatternFrequency('pat-1')).toBe(0)
  })

  it('발생 기록 후 빈도 증가', () => {
    learner.registerPattern('pat-1', 'OOM', [])
    learner.recordOccurrence('pat-1', 'svc-1', 'critical')
    learner.recordOccurrence('pat-1', 'svc-2', 'high')
    expect(learner.getPatternFrequency('pat-1')).toBe(2)
  })

  it('getHighFrequencyPatterns: frequency >= threshold', () => {
    learner.registerPattern('pat-1', 'OOM', [])
    learner.registerPattern('pat-2', 'CPU Spike', [])
    learner.recordOccurrence('pat-1', 'svc-1', 'critical')
    learner.recordOccurrence('pat-1', 'svc-1', 'critical')
    learner.recordOccurrence('pat-1', 'svc-1', 'critical')
    const high = learner.getHighFrequencyPatterns(3)
    expect(high.map(p => p.patternId)).toContain('pat-1')
    expect(high.map(p => p.patternId)).not.toContain('pat-2')
  })

  it('C등급 데이터 전송 차단', () => {
    learner.registerPattern('pat-1', 'OOM', [])
    expect(() => learner.recordOccurrence('pat-1', 'svc-1', 'critical', 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    learner.registerPattern('pat-1', 'OOM', [])
    expect(() => learner.recordOccurrence('pat-1', 'svc-1', 'critical', 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    learner.registerPattern('pat-1', 'OOM', [])
    learner.recordOccurrence('pat-1', 'svc-1', 'critical')
    expect(learner.getAuditLog().length).toBeGreaterThanOrEqual(2)
  })
})
