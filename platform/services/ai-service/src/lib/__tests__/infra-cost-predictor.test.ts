/**
 * Unit tests for Infra Cost Predictor — SVC-AI-ADV-R127
 */
import { describe, it, expect } from 'vitest'
import { InfraCostPredictor, DataGrade } from '../infra-cost-predictor'

const makeUsage = (overrides = {}) => ({
  timestamp: '2026-04-01T00:00:00Z',
  namespace: 'default',
  resourceType: 'cpu' as const,
  usedAmount: 500,
  requestedAmount: 1000,
  limitAmount: 2000,
  grade: DataGrade.O,
  ...overrides,
})

describe('SVC-AI-ADV-R127 InfraCostPredictor', () => {
  it('[FR-R127.1] adds usage data points', () => {
    const predictor = new InfraCostPredictor()
    predictor.addUsage(makeUsage())
    const report = predictor.forecast('2026-04-01', '2026-04-30')
    expect(report.forecasts).toHaveLength(1)
  })

  it('[FR-R127.1] blocks C/S grade usage data', () => {
    const predictor = new InfraCostPredictor()
    expect(() => predictor.addUsage(makeUsage({ grade: DataGrade.C }))).toThrow('BLOCKED')
    expect(() => predictor.addUsage(makeUsage({ grade: DataGrade.S }))).toThrow('BLOCKED')
  })

  it('[FR-R127.3] custom cost rate overrides default', () => {
    const predictor = new InfraCostPredictor()
    predictor.setCostRate({ resourceType: 'cpu', unitCostPerHour: 100, unit: '1000m' })
    predictor.addUsage(makeUsage({ usedAmount: 1000 }))
    const report = predictor.forecast('2026-04-01', '2026-04-30')
    expect(report.forecasts[0]!.projectedMonthly).toBeGreaterThan(0)
  })

  it('[FR-R127.4] detects increasing trend', () => {
    const predictor = new InfraCostPredictor()
    for (let i = 1; i <= 6; i++) {
      predictor.addUsage(makeUsage({ usedAmount: 100 * i, timestamp: `2026-04-0${i}T00:00:00Z` }))
    }
    const report = predictor.forecast('2026-04-01', '2026-04-06')
    expect(report.forecasts[0]!.trend).toBe('increasing')
  })

  it('[FR-R127.5] detects anomaly on high variance', () => {
    const predictor = new InfraCostPredictor()
    predictor.addUsage(makeUsage({ usedAmount: 100 }))
    predictor.addUsage(makeUsage({ usedAmount: 100 }))
    predictor.addUsage(makeUsage({ usedAmount: 5000 }))  // spike
    predictor.addUsage(makeUsage({ usedAmount: 100 }))
    const report = predictor.forecast('2026-04-01', '2026-04-04')
    expect(report.anomalies.length).toBeGreaterThanOrEqual(1)
  })

  it('[FR-R127.6] throws when no usage data', () => {
    const predictor = new InfraCostPredictor()
    expect(() => predictor.forecast('2026-04-01', '2026-04-30')).toThrow('데이터가 없습니다')
  })

  it('multiple namespaces produce separate forecasts', () => {
    const predictor = new InfraCostPredictor()
    predictor.addUsage(makeUsage({ namespace: 'ns-a' }))
    predictor.addUsage(makeUsage({ namespace: 'ns-b' }))
    const report = predictor.forecast('2026-04-01', '2026-04-30')
    const namespaces = new Set(report.forecasts.map(f => f.namespace))
    expect(namespaces.has('ns-a')).toBe(true)
    expect(namespaces.has('ns-b')).toBe(true)
  })

  it('audit log records forecast', () => {
    const predictor = new InfraCostPredictor()
    predictor.addUsage(makeUsage())
    predictor.forecast('2026-04-01', '2026-04-30')
    expect(predictor.getAuditLog().some(e => e.action === 'forecast')).toBe(true)
  })
})
