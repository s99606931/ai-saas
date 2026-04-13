// Plan SC: SVC-AI-ADV-R346
import { describe, it, expect, beforeEach } from 'vitest'
import { CloudCostPredictorV2 } from '../cloud-cost-predictor-v2'

describe('CloudCostPredictorV2', () => {
  let predictor: CloudCostPredictorV2

  beforeEach(() => {
    predictor = new CloudCostPredictorV2()
  })

  it('registerService — 감사 로그에 service.register 기록', () => {
    predictor.registerService('svc-1', 'Compute', 100000)
    const log = predictor.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('service.register')
    expect(log[0]!.detail).toBe('svc-1')
  })

  it('predictCost — 이동평균 예산 초과 탐지', () => {
    predictor.registerService('svc-1', 'Compute', 100000)
    predictor.recordCost('svc-1', 110000, '2026-01')
    predictor.recordCost('svc-1', 120000, '2026-02')
    predictor.recordCost('svc-1', 130000, '2026-03')
    const pred = predictor.predictCost('svc-1', 3)
    // (110000+120000+130000)/3 = 120000
    expect(pred.predictedCost).toBe(120000)
    expect(pred.overBudget).toBe(true)
    expect(pred.samplesUsed).toBe(3)
  })

  it('predictCost — 예산 미초과 시 overBudget=false', () => {
    predictor.registerService('svc-1', 'Compute', 200000)
    predictor.recordCost('svc-1', 80000, '2026-01')
    predictor.recordCost('svc-1', 90000, '2026-02')
    const pred = predictor.predictCost('svc-1', 5)
    expect(pred.overBudget).toBe(false)
  })

  it('getBudgetAlerts — 예산 초과 서비스만 반환', () => {
    predictor.registerService('svc-1', 'Compute', 100000)
    predictor.registerService('svc-2', 'Storage', 200000)
    predictor.recordCost('svc-1', 150000, '2026-01') // 초과
    predictor.recordCost('svc-2', 100000, '2026-01') // 미초과
    const alerts = predictor.getBudgetAlerts()
    expect(alerts).toHaveLength(1)
    expect(alerts[0]!.serviceId).toBe('svc-1')
  })

  it('getBudgetAlerts — overagePercent 계산 정확성', () => {
    predictor.registerService('svc-1', 'Compute', 100000)
    predictor.recordCost('svc-1', 150000, '2026-01')
    const alerts = predictor.getBudgetAlerts()
    // (150000/100000 - 1) * 100 = 50%
    expect(alerts[0]!.overagePercent).toBe(50)
  })

  it('recordCost — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    predictor.registerService('svc-1', 'Compute', 100000)
    expect(() => predictor.recordCost('svc-1', 80000, '2026-01', 'C')).toThrow('BLOCKED')
  })

  it('recordCost — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    predictor.registerService('svc-1', 'Compute', 100000)
    expect(() => predictor.recordCost('svc-1', 80000, '2026-01', 'S')).toThrow('N2SF N-05')
  })

  it('predictCost — 히스토리 없을 때 predictedCost=0, overBudget=false', () => {
    predictor.registerService('svc-1', 'Compute', 100000)
    const pred = predictor.predictCost('svc-1')
    expect(pred.predictedCost).toBe(0)
    expect(pred.overBudget).toBe(false)
    expect(pred.samplesUsed).toBe(0)
  })
})
