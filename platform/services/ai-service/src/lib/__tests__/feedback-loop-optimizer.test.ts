/**
 * Tests — SVC-AI-ADV-R121 Feedback Loop Optimizer
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  FeedbackLoopOptimizer,
  DataGrade,
  type Rating,
} from '../feedback-loop-optimizer'

describe('FeedbackLoopOptimizer — R121', () => {
  let opt: FeedbackLoopOptimizer

  beforeEach(() => {
    opt = new FeedbackLoopOptimizer({
      minSamples: 10,
      promoteThreshold: 4.0,
      demoteThreshold: 2.5,
      reportTolerance: 2,
    })
    opt.registerVariant({ id: 'v1', description: 'baseline prompt' })
    opt.registerVariant({ id: 'v2', description: 'new prompt' })
    opt.registerVariant({ id: 'v3', description: 'experimental' })
  })

  function feed(variantId: string, rating: Rating, count: number): void {
    for (let i = 0; i < count; i++) {
      opt.recordFeedback({
        variantId,
        rating,
        signal: rating >= 4 ? 'thumbs-up' : 'thumbs-down',
        grade: DataGrade.O,
      })
    }
  }

  it('FR-R121.1: variant 등록', () => {
    expect(opt.listVariants().length).toBe(3)
    expect(opt.listVariants().every((v) => v.status === 'active')).toBe(true)
  })

  it('FR-R121.2: 피드백 기록', () => {
    opt.recordFeedback({
      variantId: 'v1',
      rating: 5,
      signal: 'thumbs-up',
      grade: DataGrade.O,
    })
    const stats = opt.getStats('v1')
    expect(stats?.totalSamples).toBe(1)
    expect(stats?.thumbsUp).toBe(1)
  })

  it('알 수 없는 variant 기록 시 throw', () => {
    expect(() =>
      opt.recordFeedback({
        variantId: 'unknown',
        rating: 3,
        signal: 'neutral',
        grade: DataGrade.O,
      }),
    ).toThrow('Unknown variant')
  })

  it('FR-R121.3: 통계(avg + CI) 계산', () => {
    feed('v1', 5, 10)
    const stats = opt.getStats('v1')
    expect(stats?.avgRating).toBeCloseTo(5, 2)
    expect(stats?.totalSamples).toBe(10)
  })

  it('FR-R121.4: 최소 샘플 미달 시 insufficient', () => {
    feed('v1', 5, 3)
    const decision = opt.optimize()
    expect(decision.insufficient).toContain('v1')
    expect(decision.promoted).toHaveLength(0)
  })

  it('FR-R121.5: 고평가 variant 승격', () => {
    feed('v2', 5, 15)
    const decision = opt.optimize()
    expect(decision.promoted).toContain('v2')
    const v2 = opt.listVariants().find((v) => v.id === 'v2')
    expect(v2?.status).toBe('promoted')
  })

  it('FR-R121.5: 저평가 variant 강등', () => {
    feed('v3', 1, 15)
    const decision = opt.optimize()
    expect(decision.demoted).toContain('v3')
  })

  it('FR-R121.5: report 과다 시 강등', () => {
    for (let i = 0; i < 15; i++) {
      opt.recordFeedback({
        variantId: 'v3',
        rating: 3,
        signal: 'report',
        grade: DataGrade.O,
      })
    }
    const decision = opt.optimize()
    expect(decision.demoted).toContain('v3')
  })

  it('FR-R121.6: comment PII 자동 마스킹', () => {
    opt.recordFeedback({
      variantId: 'v1',
      rating: 4,
      signal: 'thumbs-up',
      comment: '연락처 admin@test.kr 010-1234-5678',
      grade: DataGrade.O,
    })
    const log = opt.getAuditLog()
    expect(log.some((e) => e.action === 'piiScrubbed')).toBe(true)
  })

  it('FR-R121.7: C등급 차단', () => {
    expect(() =>
      opt.recordFeedback({
        variantId: 'v1',
        rating: 5,
        signal: 'thumbs-up',
        grade: DataGrade.C,
      }),
    ).toThrow('BLOCKED')
  })

  it('FR-R121.7: S등급 차단', () => {
    expect(() =>
      opt.recordFeedback({
        variantId: 'v1',
        rating: 5,
        signal: 'thumbs-up',
        grade: DataGrade.S,
      }),
    ).toThrow('N2SF N-05')
  })

  it('FR-R121.8: 감사 로그 기록', () => {
    feed('v1', 5, 10)
    opt.optimize()
    const log = opt.getAuditLog()
    expect(log.some((e) => e.action === 'registerVariant')).toBe(true)
    expect(log.some((e) => e.action === 'recordFeedback')).toBe(true)
    expect(log.some((e) => e.action === 'optimize')).toBe(true)
  })

  it('빈 variant 통계 반환', () => {
    const stats = opt.getStats('v1')
    expect(stats?.totalSamples).toBe(0)
    expect(stats?.avgRating).toBe(0)
  })
})
