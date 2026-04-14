// Plan SC: SVC-AI-ADV-R612
import { describe, it, expect, beforeEach } from 'vitest'
import { InfrastructureCostPredictorV3 } from '../infrastructure-cost-predictor-v3'

describe('InfrastructureCostPredictorV3', () => {
  let p: InfrastructureCostPredictorV3

  beforeEach(() => {
    p = new InfrastructureCostPredictorV3()
  })

  it('register — 감사 로그 기록', () => {
    p.register('r1', 'Compute', 100000)
    const log = p.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('resource.register')
  })

  it('forecast — 선형회귀 상승 추세 예측', () => {
    p.register('r1', 'Compute', 500000)
    p.record('r1', 100)
    p.record('r1', 200)
    p.record('r1', 300)
    p.record('r1', 400)
    // slope=100, next(x=4)=500
    const f = p.forecast('r1')
    expect(f.slope).toBe(100)
    expect(f.predictedNextMonth).toBe(500)
    expect(f.status).toBe('OK')
  })

  it('forecast — OVER_BUDGET 판정', () => {
    p.register('r1', 'Compute', 100)
    p.record('r1', 200)
    p.record('r1', 250)
    const f = p.forecast('r1')
    expect(f.status).toBe('OVER_BUDGET')
  })

  it('record — C/S 등급 차단', () => {
    p.register('r1', 'Compute', 1000)
    expect(() => p.record('r1', 500, 'C')).toThrow(/BLOCKED/)
    expect(() => p.record('r1', 500, 'S')).toThrow(/BLOCKED/)
  })

  it('getAlerts — OK 제외하고 반환', () => {
    p.register('r1', 'A', 1000)
    p.register('r2', 'B', 1000)
    p.record('r1', 100)
    p.record('r1', 100)
    p.record('r2', 1200)
    p.record('r2', 1300)
    const alerts = p.getAlerts()
    expect(alerts.some((a) => a.resourceId === 'r2')).toBe(true)
    expect(alerts.some((a) => a.resourceId === 'r1')).toBe(false)
  })

  it('forecast — 히스토리 없음 시 0 반환', () => {
    p.register('r1', 'A', 1000)
    const f = p.forecast('r1')
    expect(f.predictedNextMonth).toBe(0)
    expect(f.status).toBe('OK')
  })
})
