/**
 * Unit tests for AI Model Health Monitor — SVC-AI-ADV-R142
 */

import { describe, it, expect } from 'vitest'
import {
  AiModelHealthMonitor,
  type InferenceMetric,
} from '../ai-model-health-monitor'

const MODEL_ID = 'bert-public-ko-v1'

function metric(
  overrides: Partial<InferenceMetric> = {},
): InferenceMetric {
  return {
    modelId: MODEL_ID,
    ts: 1000,
    latencyMs: 100,
    correct: true,
    confidence: 0.9,
    ...overrides,
  }
}

describe('SVC-AI-ADV-R142 AiModelHealthMonitor', () => {
  it('[FR-R142.1] records valid metric', () => {
    const m = new AiModelHealthMonitor({ now: () => 1000 })
    expect(() => m.record(metric())).not.toThrow()
  })

  it('[FR-R142.1] rejects invalid confidence', () => {
    const m = new AiModelHealthMonitor()
    expect(() => m.record(metric({ confidence: 1.5 }))).toThrow(/INVALID_METRIC/)
  })

  it('[FR-R142.1] rejects negative latency', () => {
    const m = new AiModelHealthMonitor()
    expect(() => m.record(metric({ latencyMs: -1 }))).toThrow(/INVALID_METRIC/)
  })

  it('[FR-R142.1] enforces buffer cap', () => {
    const m = new AiModelHealthMonitor({ maxBufferPerModel: 2, now: () => 5000 })
    m.record(metric({ ts: 1 }))
    m.record(metric({ ts: 2 }))
    m.record(metric({ ts: 3 }))
    const health = m.evaluate(MODEL_ID)
    expect(health.sampleSize).toBe(2)
  })

  it('[FR-R142.2] computes accuracy over window', () => {
    const m = new AiModelHealthMonitor({ now: () => 5000 })
    m.record(metric({ correct: true }))
    m.record(metric({ correct: true }))
    m.record(metric({ correct: false }))
    m.record(metric({ correct: false }))
    const health = m.evaluate(MODEL_ID)
    expect(health.accuracy).toBe(0.5)
    expect(health.sampleSize).toBe(4)
  })

  it('[FR-R142.2] computes avg latency and confidence', () => {
    const m = new AiModelHealthMonitor({ now: () => 5000 })
    m.record(metric({ latencyMs: 100, confidence: 0.8 }))
    m.record(metric({ latencyMs: 200, confidence: 1.0 }))
    const health = m.evaluate(MODEL_ID)
    expect(health.avgLatencyMs).toBe(150)
    expect(health.avgConfidence).toBeCloseTo(0.9, 5)
  })

  it('[FR-R142.3] computes drift score with baseline', () => {
    const m = new AiModelHealthMonitor({ now: () => 5000 })
    m.setBaseline(MODEL_ID, { accuracy: 0.95, avgConfidence: 0.9 })
    const drift = m.computeDriftScore(
      { accuracy: 0.8, avgConfidence: 0.85 },
      { accuracy: 0.95, avgConfidence: 0.9 },
    )
    // 0.15 * 0.7 + 0.05 * 0.3 = 0.105 + 0.015 = 0.12
    expect(drift).toBeCloseTo(0.12, 5)
  })

  it('[FR-R142.4] status HEALTHY when drift low', () => {
    const m = new AiModelHealthMonitor({ now: () => 5000 })
    m.setBaseline(MODEL_ID, { accuracy: 0.95, avgConfidence: 0.9 })
    for (let i = 0; i < 10; i++) {
      m.record(metric({ correct: true, confidence: 0.9 }))
    }
    const health = m.evaluate(MODEL_ID)
    expect(health.status).toBe('HEALTHY')
  })

  it('[FR-R142.4] status CRITICAL when drift high', () => {
    const m = new AiModelHealthMonitor({ now: () => 5000 })
    m.setBaseline(MODEL_ID, { accuracy: 0.95, avgConfidence: 0.9 })
    for (let i = 0; i < 10; i++) {
      m.record(metric({ correct: false, confidence: 0.3 }))
    }
    const health = m.evaluate(MODEL_ID)
    expect(health.status).toBe('CRITICAL')
  })

  it('[FR-R142.4] status without baseline uses accuracy threshold', () => {
    const m = new AiModelHealthMonitor({ now: () => 5000 })
    for (let i = 0; i < 10; i++) {
      m.record(metric({ correct: i < 3 })) // 30%
    }
    const health = m.evaluate(MODEL_ID)
    expect(health.status).toBe('CRITICAL')
  })

  it('[FR-R142.4] returns CRITICAL on empty buffer', () => {
    const m = new AiModelHealthMonitor({ now: () => 5000 })
    const health = m.evaluate(MODEL_ID)
    expect(health.status).toBe('CRITICAL')
    expect(health.sampleSize).toBe(0)
  })

  it('[FR-R142.2] window filters old metrics', () => {
    const m = new AiModelHealthMonitor({ now: () => 10_000 })
    m.record(metric({ ts: 1000 }))
    m.record(metric({ ts: 9500 }))
    // window 1000ms: cutoff = 9000
    const health = m.evaluate(MODEL_ID, 1000)
    expect(health.sampleSize).toBe(1)
  })

  it('[FR-R142.5] getAuditLog records evaluations', () => {
    const m = new AiModelHealthMonitor({ now: () => 5000 })
    m.record(metric())
    m.evaluate(MODEL_ID)
    const logs = m.getAuditLog()
    expect(logs).toHaveLength(1)
    expect(logs[0]!.event).toBe('model.health.evaluated')
  })

  it('[FR-R142.6] blocks C/S grade', () => {
    const m = new AiModelHealthMonitor()
    expect(() => m.record(metric(), 'C')).toThrow(/BLOCKED/)
    expect(() => m.record(metric(), 'S')).toThrow(/BLOCKED/)
  })

  it('setBaseline rejects invalid baseline', () => {
    const m = new AiModelHealthMonitor()
    expect(() => m.setBaseline(MODEL_ID, { accuracy: 1.5, avgConfidence: 0.9 })).toThrow()
  })
})
