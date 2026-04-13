// Plan SC: SVC-AI-ADV-R632
import { describe, it, expect, beforeEach } from 'vitest'
import { DisabilityMobilitySupportAI } from '../disability-mobility-support-ai'

describe('DisabilityMobilitySupportAI', () => {
  let ai: DisabilityMobilitySupportAI

  beforeEach(() => {
    ai = new DisabilityMobilitySupportAI()
    ai.registerSegment({
      segmentId: 'seg1',
      hasRamp: true,
      hasElevator: true,
      hasTactilePaving: true,
      hasAudioGuide: true,
      surfaceQuality: 5,
    })
  })

  it('registerSegment — 감사 로그 기록', () => {
    const log = ai.getAuditLog()
    expect(log[0]!.action).toBe('segment.register')
  })

  it('evaluateRoute — 완전 무장애 segment은 accessible', () => {
    const result = ai.evaluateRoute({
      requestId: 'r1',
      userId: 'u1',
      disabilityType: 'wheelchair',
      segments: ['seg1'],
    })
    expect(result.accessible).toBe(true)
  })

  it('evaluateRoute — ramp 없는 segment은 wheelchair blocker', () => {
    ai.registerSegment({
      segmentId: 'seg2',
      hasRamp: false,
      hasElevator: false,
      hasTactilePaving: false,
      hasAudioGuide: false,
      surfaceQuality: 3,
    })
    const result = ai.evaluateRoute({
      requestId: 'r2',
      userId: 'u1',
      disabilityType: 'wheelchair',
      segments: ['seg2'],
    })
    expect(result.blockers.some((b) => b.includes('no-ramp'))).toBe(true)
  })

  it('evaluateRoute — visual 유형은 촉지 포장 필수', () => {
    ai.registerSegment({
      segmentId: 'seg3',
      hasRamp: true,
      hasElevator: true,
      hasTactilePaving: false,
      hasAudioGuide: false,
      surfaceQuality: 4,
    })
    const result = ai.evaluateRoute({
      requestId: 'r3',
      userId: 'u2',
      disabilityType: 'visual',
      segments: ['seg3'],
    })
    expect(result.blockers.some((b) => b.includes('no-tactile'))).toBe(true)
  })

  it('evaluateRoute — 존재하지 않는 segment은 blocker', () => {
    const result = ai.evaluateRoute({
      requestId: 'r4',
      userId: 'u3',
      disabilityType: 'hearing',
      segments: ['unknown'],
    })
    expect(result.blockers.some((b) => b.includes('segment-missing'))).toBe(true)
  })

  it('evaluateRoute — S등급 차단', () => {
    expect(() =>
      ai.evaluateRoute(
        { requestId: 'r5', userId: 'u4', disabilityType: 'wheelchair', segments: ['seg1'] },
        'S',
      ),
    ).toThrow('BLOCKED')
  })
})
