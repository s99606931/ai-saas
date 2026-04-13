import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceLevelAutoCalibratorAI } from '../service-level-auto-calibrator'

describe('ServiceLevelAutoCalibratorAI', () => {
  let ai: ServiceLevelAutoCalibratorAI

  beforeEach(() => {
    ai = new ServiceLevelAutoCalibratorAI()
    ai.registerSlo('s1', '응답시간 SLO', 99, 200, 'responseTimeMs')
  })

  it('SLO 등록 감사 로그', () => {
    expect(ai.getAuditLog().some((e) => e.action === 'slo.register')).toBe(true)
  })

  it('측정값 없을 때 달성률 100%', () => {
    const status = ai.getSloStatus('s1')
    expect(status.achievementRate).toBe(100)
    expect(status.needsCalibration).toBe(false)
  })

  it('달성률 계산 — 목표값 이상 횟수 / 전체', () => {
    ai.recordMeasurement('s1', 180)
    ai.recordMeasurement('s1', 190)
    ai.recordMeasurement('s1', 250)
    ai.recordMeasurement('s1', 300)
    const status = ai.getSloStatus('s1')
    // 180, 190은 200 미만이므로 달성 (sloTargetValue=200 이상이어야 달성)
    // 실제: 200 이상인 값: 250, 300 → 2/4 = 50%
    expect(status.achievementRate).toBe(50)
    expect(status.needsCalibration).toBe(true)
  })

  it('보정 권고 — gap > 10 → 즉시 용량 증설', () => {
    // sloTargetValue=200 미달(150)인 값 10회 → 달성률=0%, gap=99 > 10
    for (let i = 0; i < 10; i++) ai.recordMeasurement('s1', 150)
    const recs = ai.getCalibrationRecommendations()
    expect(recs.length).toBe(1)
    expect(recs[0]!.recommendation).toBe('즉시 용량 증설 필요')
  })

  it('목표 달성 시 보정 권고 없음', () => {
    for (let i = 0; i < 10; i++) ai.recordMeasurement('s1', 220)
    const recs = ai.getCalibrationRecommendations()
    expect(recs.length).toBe(0)
  })

  it('C등급 데이터 차단', () => {
    expect(() => ai.recordMeasurement('s1', 200, 'C')).toThrow('BLOCKED')
  })

  it('미등록 SLO 에러', () => {
    expect(() => ai.getSloStatus('unknown')).toThrow()
  })
})
