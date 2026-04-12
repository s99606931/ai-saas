/**
 * Unit tests for AI Governance Dashboard Backend — SVC-AI-ADV-R115
 */

import { describe, it, expect } from 'vitest'
import {
  AIGovernanceDashboardBackend,
  DataGrade,
} from '../ai-governance-dashboard-backend'

describe('SVC-AI-ADV-R115 AIGovernanceDashboardBackend', () => {
  it('[FR-R115.1] recordMetric 저장', () => {
    const d = new AIGovernanceDashboardBackend({ role: 'admin' })
    const ok = d.recordMetric({
      category: 'safety',
      name: 'toxicity',
      value: 0.02,
      grade: DataGrade.O,
    })
    expect(ok).toBe(true)
  })

  it('[FR-R115.7] C/S 등급은 마스킹(기록 안 함)', () => {
    const d = new AIGovernanceDashboardBackend({ role: 'admin' })
    const c = d.recordMetric({
      category: 'cost',
      name: 'secret-cost',
      value: 99,
      grade: DataGrade.C,
    })
    const s = d.recordMetric({
      category: 'cost',
      name: 'secret-cost',
      value: 99,
      grade: DataGrade.S,
    })
    expect(c).toBe(false)
    expect(s).toBe(false)
    expect(d.snapshot('cost').metrics['secret-cost']).toBeUndefined()
  })

  it('[FR-R115.3] 시계열 rollup — minute 버킷', () => {
    const d = new AIGovernanceDashboardBackend({ role: 'admin' })
    const base = 1_000_000_000_000
    d.recordMetric(
      { category: 'accuracy', name: 'hit', value: 0.8, grade: DataGrade.O },
      base + 1000,
    )
    d.recordMetric(
      { category: 'accuracy', name: 'hit', value: 0.9, grade: DataGrade.O },
      base + 2000,
    )
    const ts = d.queryTimeseries({
      category: 'accuracy',
      name: 'hit',
      from: base,
      to: base + 60_000,
      resolution: 'minute',
    })
    expect(ts.length).toBe(1)
    expect(ts[0]?.count).toBe(2)
    expect(ts[0]?.value).toBeCloseTo(0.85, 5)
  })

  it('[FR-R115.4] 스냅샷 요약', () => {
    const d = new AIGovernanceDashboardBackend({ role: 'admin' })
    d.recordMetric({
      category: 'safety',
      name: 'refusal',
      value: 0.1,
      grade: DataGrade.O,
    })
    d.recordMetric({
      category: 'safety',
      name: 'refusal',
      value: 0.3,
      grade: DataGrade.O,
    })
    const snap = d.snapshot('safety')
    expect(snap.metrics['refusal']?.latest).toBe(0.3)
    expect(snap.metrics['refusal']?.avg).toBeCloseTo(0.2, 5)
    expect(snap.metrics['refusal']?.count).toBe(2)
  })

  it('[FR-R115.5] 임계값 초과 경고 발행', () => {
    const d = new AIGovernanceDashboardBackend({
      role: 'admin',
      thresholds: { toxicity: 0.5 },
    })
    d.recordMetric({
      category: 'safety',
      name: 'toxicity',
      value: 0.9,
      grade: DataGrade.O,
    })
    expect(d.getAlerts().length).toBe(1)
    expect(d.getAlerts()[0]?.metricName).toBe('toxicity')
  })

  it('[FR-R115.6] RBAC — viewer는 cost 접근 불가', () => {
    const d = new AIGovernanceDashboardBackend({ role: 'viewer' })
    d.recordMetric({
      category: 'cost',
      name: 'tokens',
      value: 100,
      grade: DataGrade.O,
    })
    const snap = d.snapshot('cost')
    expect(Object.keys(snap.metrics).length).toBe(0)
    const ts = d.queryTimeseries({
      category: 'cost',
      name: 'tokens',
      from: 0,
      to: Date.now(),
      resolution: 'hour',
    })
    expect(ts.length).toBe(0)
  })

  it('[FR-R115.6] admin은 전체 카테고리 접근', () => {
    const d = new AIGovernanceDashboardBackend({ role: 'admin' })
    d.recordMetric({
      category: 'utilization',
      name: 'gpu',
      value: 0.75,
      grade: DataGrade.O,
    })
    expect(d.snapshot('utilization').metrics['gpu']?.latest).toBe(0.75)
  })

  it('[FR-R115.8] 감사 로그', () => {
    const d = new AIGovernanceDashboardBackend({ role: 'admin' })
    d.recordMetric({
      category: 'safety',
      name: 'x',
      value: 1,
      grade: DataGrade.O,
    })
    d.snapshot('safety')
    const log = d.getAuditLog()
    expect(log.some((e) => e.action === 'record')).toBe(true)
    expect(log.some((e) => e.action === 'snapshot')).toBe(true)
  })
})
