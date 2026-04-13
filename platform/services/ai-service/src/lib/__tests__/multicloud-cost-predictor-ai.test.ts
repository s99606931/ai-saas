import { describe, it, expect, beforeEach } from 'vitest'
import { MulticloudCostPredictorAi, type CloudResource, type CostHistory } from '../multicloud-cost-predictor-ai'

describe('MulticloudCostPredictorAi', () => {
  let predictor: MulticloudCostPredictorAi

  const resource1: CloudResource = { resourceId: 'RES001', provider: 'AWS', resourceType: 'EC2', region: 'ap-northeast-2', monthlyCost: 500000, usagePercent: 30 }
  const resource2: CloudResource = { resourceId: 'RES002', provider: 'NCP', resourceType: 'Server', region: 'KR', monthlyCost: 300000, usagePercent: 80 }

  beforeEach(() => {
    predictor = new MulticloudCostPredictorAi()
    predictor.registerResource(resource1)
    predictor.registerResource(resource2)
  })

  it('리소스 등록 감사 로그', () => {
    const log = predictor.getAuditLog()
    expect(log.some((e) => e.action === 'resource.register')).toBe(true)
  })

  it('예측 총 비용 > 0', () => {
    const prediction = predictor.predict('2026-05')
    expect(prediction.predictedTotalCost).toBeGreaterThan(0)
  })

  it('비용 증가 추세 → INCREASING', () => {
    const histories: CostHistory[] = [
      { month: '2026-01', totalCost: 500000, byProvider: {} },
      { month: '2026-02', totalCost: 700000, byProvider: {} },
    ]
    histories.forEach((h) => predictor.recordHistory(h))
    const prediction = predictor.predict('2026-03')
    expect(prediction.costTrend).toBe('INCREASING')
  })

  it('저활용 리소스 절감 기회 감지 (사용률 < 50%)', () => {
    const prediction = predictor.predict('2026-05')
    expect(prediction.savingOpportunities.some((o) => o.resourceId === 'RES001')).toBe(true)
  })

  it('고활용 리소스는 절감 기회 없음', () => {
    const prediction = predictor.predict('2026-05')
    expect(prediction.savingOpportunities.some((o) => o.resourceId === 'RES002')).toBe(false)
  })

  it('제공자별 예측 비용 집계', () => {
    const prediction = predictor.predict('2026-05')
    expect(prediction.predictedByProvider['AWS']).toBeGreaterThan(0)
    expect(prediction.predictedByProvider['NCP']).toBeGreaterThan(0)
  })

  it('예측 후 감사 로그', () => {
    predictor.predict('2026-05')
    const log = predictor.getAuditLog()
    expect(log.some((e) => e.action === 'cost.predict')).toBe(true)
  })
})
