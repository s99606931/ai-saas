// Plan SC: SVC-AI-ADV-R462-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { InfraCostPredictorV2 } from '../infra-cost-predictor-v2'

describe('InfraCostPredictorV2', () => {
  let predictor: InfraCostPredictorV2

  beforeEach(() => {
    predictor = new InfraCostPredictorV2()
  })

  it('데이터 없을 때 → confidence=0, STABLE 반환', () => {
    const result = predictor.predict('SVC-1', 'COMPUTE')
    expect(result.confidence).toBe(0)
    expect(result.trend).toBe('STABLE')
    expect(result.predictedNextMonthKrw).toBe(0)
  })

  it('단일 레코드 → confidence=0.5, 전월 비용으로 예측', () => {
    predictor.ingestRecord({ recordId: 'R1', serviceId: 'SVC-1', resourceType: 'COMPUTE', periodMonth: '2026-03', costKrw: 100_000, usageUnits: 10 })
    const result = predictor.predict('SVC-1', 'COMPUTE')
    expect(result.confidence).toBe(0.5)
    expect(result.predictedNextMonthKrw).toBe(100_000)
  })

  it('비용 50% 이상 급증 → anomalyDetected=true', () => {
    predictor.ingestRecord({ recordId: 'R1', serviceId: 'SVC-2', resourceType: 'STORAGE', periodMonth: '2026-02', costKrw: 100_000, usageUnits: 10 })
    predictor.ingestRecord({ recordId: 'R2', serviceId: 'SVC-2', resourceType: 'STORAGE', periodMonth: '2026-03', costKrw: 160_000, usageUnits: 16 })
    const result = predictor.predict('SVC-2', 'STORAGE')
    expect(result.anomalyDetected).toBe(true)
    expect(result.trendPercent).toBeGreaterThan(50)
  })

  it('5% 초과 증가 → INCREASING trend', () => {
    predictor.ingestRecord({ recordId: 'R1', serviceId: 'SVC-3', resourceType: 'NETWORK', periodMonth: '2026-02', costKrw: 100_000, usageUnits: 10 })
    predictor.ingestRecord({ recordId: 'R2', serviceId: 'SVC-3', resourceType: 'NETWORK', periodMonth: '2026-03', costKrw: 110_000, usageUnits: 11 })
    const result = predictor.predict('SVC-3', 'NETWORK')
    expect(result.trend).toBe('INCREASING')
  })

  it('5% 초과 감소 → DECREASING trend', () => {
    predictor.ingestRecord({ recordId: 'R1', serviceId: 'SVC-4', resourceType: 'DATABASE', periodMonth: '2026-02', costKrw: 100_000, usageUnits: 10 })
    predictor.ingestRecord({ recordId: 'R2', serviceId: 'SVC-4', resourceType: 'DATABASE', periodMonth: '2026-03', costKrw: 80_000, usageUnits: 8 })
    const result = predictor.predict('SVC-4', 'DATABASE')
    expect(result.trend).toBe('DECREASING')
  })

  it('레코드 많을수록 confidence 높아짐 (최대 0.95)', () => {
    for (let i = 1; i <= 10; i++) {
      predictor.ingestRecord({
        recordId: `R${i}`,
        serviceId: 'SVC-5',
        resourceType: 'COMPUTE',
        periodMonth: `2026-${String(i).padStart(2, '0')}`,
        costKrw: 100_000,
        usageUnits: 10,
      })
    }
    const result = predictor.predict('SVC-5', 'COMPUTE')
    expect(result.confidence).toBeLessThanOrEqual(0.95)
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    predictor.ingestRecord({ recordId: 'R1', serviceId: 'SVC-6', resourceType: 'CACHE', periodMonth: '2026-03', costKrw: 50_000, usageUnits: 5 })
    predictor.predict('SVC-6', 'CACHE')
    const log1 = predictor.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', serviceId: 'X', detail: {} })
    const log2 = predictor.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
