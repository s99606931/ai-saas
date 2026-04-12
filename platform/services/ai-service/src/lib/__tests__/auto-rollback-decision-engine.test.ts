/**
 * Unit tests for Auto Rollback Decision Engine — SVC-AI-ADV-R141
 */
import { describe, it, expect } from 'vitest'
import { AutoRollbackDecisionEngine, DataGrade } from '../auto-rollback-decision-engine'

const makeBaseline = (overrides = {}) => ({
  service: 'api',
  baselineErrorRate: 0.01,
  baselineLatencyP99Ms: 200,
  baselineCpuPercent: 30,
  baselineMemPercent: 40,
  grade: DataGrade.O,
  ...overrides,
})

const makeMetric = (overrides = {}) => ({
  service: 'api',
  timestamp: '2026-04-12T10:00:00Z',
  errorRate: 0.01,
  latencyP99Ms: 200,
  cpuPercent: 30,
  memPercent: 40,
  grade: DataGrade.O,
  ...overrides,
})

describe('SVC-AI-ADV-R141 AutoRollbackDecisionEngine', () => {
  it('[FR-R141.1] sets baseline', () => {
    const engine = new AutoRollbackDecisionEngine()
    engine.setBaseline(makeBaseline())
    engine.recordMetric(makeMetric())
    const result = engine.analyze('api')
    expect(result.decision).toBe('OK')
  })

  it('[FR-R141.1] blocks C/S grade baselines', () => {
    const engine = new AutoRollbackDecisionEngine()
    expect(() => engine.setBaseline(makeBaseline({ grade: DataGrade.C }))).toThrow('BLOCKED')
    expect(() => engine.setBaseline(makeBaseline({ grade: DataGrade.S }))).toThrow('BLOCKED')
  })

  it('[FR-R141.4] high error rate triggers ROLLBACK', () => {
    const engine = new AutoRollbackDecisionEngine()
    engine.setBaseline(makeBaseline({ baselineErrorRate: 0.01 }))
    for (let i = 0; i < 5; i++) {
      engine.recordMetric(makeMetric({ errorRate: 0.05 })) // 5x baseline → ROLLBACK
    }
    const result = engine.analyze('api')
    expect(result.decision).toBe('ROLLBACK')
    expect(result.triggers.length).toBeGreaterThan(0)
  })

  it('[FR-R141.4] moderate latency increase triggers WATCH', () => {
    const engine = new AutoRollbackDecisionEngine()
    engine.setBaseline(makeBaseline({ baselineLatencyP99Ms: 200 }))
    for (let i = 0; i < 5; i++) {
      engine.recordMetric(makeMetric({ latencyP99Ms: 300 })) // 1.5x → WATCH
    }
    const result = engine.analyze('api')
    expect(['WATCH', 'ROLLBACK']).toContain(result.decision)
  })

  it('[FR-R141.5] confidence is high for ROLLBACK decision', () => {
    const engine = new AutoRollbackDecisionEngine()
    engine.setBaseline(makeBaseline({ baselineErrorRate: 0.01 }))
    for (let i = 0; i < 5; i++) {
      engine.recordMetric(makeMetric({ errorRate: 0.1, latencyP99Ms: 800, cpuPercent: 90 }))
    }
    const result = engine.analyze('api')
    expect(result.confidence).toBeGreaterThan(0.6)
  })

  it('throws on missing baseline', () => {
    const engine = new AutoRollbackDecisionEngine()
    expect(() => engine.analyze('unknown')).toThrow('no baseline')
  })

  it('throws on missing metrics', () => {
    const engine = new AutoRollbackDecisionEngine()
    engine.setBaseline(makeBaseline())
    expect(() => engine.analyze('api')).toThrow('no metrics')
  })

  it('audit log records analyze', () => {
    const engine = new AutoRollbackDecisionEngine()
    engine.setBaseline(makeBaseline())
    engine.recordMetric(makeMetric())
    engine.analyze('api')
    expect(engine.getAuditLog().some(e => e.action === 'analyze')).toBe(true)
  })
})
