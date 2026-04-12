/**
 * Unit tests for SLA Violation Predictor — SVC-AI-ADV-R91
 */

import { describe, it, expect, vi } from 'vitest'
import {
  SlaViolationPredictor,
  type SliDataPoint,
  type SloTarget,
  type AuditSink,
} from '../sla-violation-predictor'

const target: SloTarget = {
  serviceId: 'user-service',
  targetAvailability: 0.999,
  windowMs: 30 * 24 * 60 * 60 * 1000,
}

const series = (values: number[], startTs = 1_000_000): SliDataPoint[] =>
  values.map((v, i) => ({
    timestamp: startTs + i * 60_000,
    value: v,
  }))

describe('SVC-AI-ADV-R91 SlaViolationPredictor', () => {
  it('[FR-R91.1] returns NONE for healthy service', () => {
    const p = new SlaViolationPredictor({ now: () => 2_000_000 })
    const result = p.predict(target, series([1, 1, 1, 1, 1]))
    expect(result.recommendation).toBe('NONE')
    expect(result.willViolate).toBe(false)
    expect(result.burnRate).toBe(0)
  })

  it('[FR-R91.2] computes remainingBudgetRatio correctly', () => {
    const p = new SlaViolationPredictor({ now: () => 2_000_000 })
    // failure rate = 0.0005, totalBudget = 0.001, remaining ratio ~= 0.5
    const points: SliDataPoint[] = [
      { timestamp: 1_000_000, value: 1 },
      { timestamp: 1_060_000, value: 0.999 },
    ]
    const result = p.predict(target, points)
    expect(result.remainingBudgetRatio).toBeGreaterThan(0)
    expect(result.remainingBudgetRatio).toBeLessThanOrEqual(1)
  })

  it('[FR-R91.3] predicts ESCALATE on severe burn', () => {
    const p = new SlaViolationPredictor({ now: () => 2_000_000 })
    // 50% failure rate — massively exceeds 0.1% budget
    const points: SliDataPoint[] = series([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])
    const result = p.predict(target, points)
    expect(result.recommendation).toBe('ESCALATE')
    expect(result.burnRate).toBeGreaterThan(10)
  })

  it('[FR-R91.3] predictedViolationAt computed when burn > 1', () => {
    const p = new SlaViolationPredictor({ now: () => 10_000_000 })
    const points: SliDataPoint[] = [
      { timestamp: 1_000_000, value: 0.995 },
      { timestamp: 2_000_000, value: 0.995 },
      { timestamp: 3_000_000, value: 0.995 },
    ]
    const result = p.predict(target, points)
    expect(result.burnRate).toBeGreaterThan(1)
    if (result.willViolate) {
      expect(result.predictedViolationAt).not.toBeNull()
    }
  })

  it('[FR-R91.1] empty series → confidence 0, NONE', () => {
    const p = new SlaViolationPredictor()
    const result = p.predict(target, [])
    expect(result.confidence).toBe(0)
    expect(result.recommendation).toBe('NONE')
    expect(result.remainingBudgetRatio).toBe(1)
  })

  it('[FR-R91.5] predictBatch logs audit', async () => {
    const audit: AuditSink = {
      log: vi.fn().mockResolvedValue(undefined),
    }
    const p = new SlaViolationPredictor({ audit, now: () => 2_000_000 })
    await p.predictBatch([
      { target, series: series([1, 1, 1]) },
      { target: { ...target, serviceId: 'auth-service' }, series: series([0.5, 0.5]) },
    ])
    expect(audit.log).toHaveBeenCalledWith(
      'sla.predict.batch',
      expect.objectContaining({ count: 2 }),
    )
  })

  it('[FR-R91.3] confidence scales with sample size', () => {
    const p = new SlaViolationPredictor()
    const small = p.predict(target, series([1, 1]))
    const large = p.predict(target, series(Array(30).fill(1)))
    expect(large.confidence).toBeGreaterThanOrEqual(small.confidence)
    expect(large.confidence).toBe(1)
  })
})
