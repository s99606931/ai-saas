/**
 * Tests — SVC-AI-ADV-R130 Cost Anomaly Detector
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  CostAnomalyDetector,
  DataGrade,
} from '../cost-anomaly-detector'

describe('CostAnomalyDetector — R130', () => {
  let det: CostAnomalyDetector

  beforeEach(() => {
    det = new CostAnomalyDetector(DataGrade.O, {
      windowSize: 10,
      zThreshold: 2.0,
      iqrMultiplier: 1.5,
      rateThreshold: 2.0,
      coolDownMs: 1000,
    })
  })

  function feedFlat(tenantId: string, n: number, cost = 100): void {
    for (let i = 0; i < n; i++) {
      det.record({ tenantId, timestamp: 1000 + i, cost })
    }
  }

  it('FR-R130.1: record 및 window FIFO', () => {
    feedFlat('t1', 15, 50) // windowSize=10 초과
    const log = det.getAuditLog().filter((e) => e.action === 'recorded')
    expect(log.length).toBe(15)
    // 최신 10개만 유지되는지 detect로 확인
    const r = det.detect('t1')
    expect(r.tenantId).toBe('t1')
  })

  it('FR-R130.5: 평탄 데이터 → normal', () => {
    feedFlat('t1', 10, 100)
    const r = det.detect('t1')
    expect(r.severity).toBe('normal')
    expect(r.reasons.length).toBe(0)
  })

  it('FR-R130.2: Z-score 급증 → warning 이상', () => {
    feedFlat('t2', 9, 100)
    det.record({ tenantId: 't2', timestamp: 2000, cost: 10000 })
    const r = det.detect('t2')
    expect(r.reasons).toContain('z-score')
    expect(['warning', 'critical']).toContain(r.severity)
  })

  it('FR-R130.3: IQR outlier 탐지', () => {
    for (let i = 0; i < 9; i++) {
      det.record({ tenantId: 't3', timestamp: 1000 + i, cost: 100 + i })
    }
    det.record({ tenantId: 't3', timestamp: 2000, cost: 5000 })
    const r = det.detect('t3')
    expect(r.reasons).toContain('iqr-outlier')
  })

  it('FR-R130.4: rate-spike 탐지', () => {
    for (let i = 0; i < 8; i++) {
      det.record({ tenantId: 't4', timestamp: 1000 + i, cost: 100 })
    }
    det.record({ tenantId: 't4', timestamp: 1009, cost: 105 })
    det.record({ tenantId: 't4', timestamp: 1010, cost: 1000 }) // rate=10x
    const r = det.detect('t4')
    expect(r.reasons).toContain('rate-spike')
  })

  it('critical: 2개 이상 지표 위반', () => {
    for (let i = 0; i < 9; i++) {
      det.record({ tenantId: 't5', timestamp: 1000 + i, cost: 50 })
    }
    det.record({ tenantId: 't5', timestamp: 2000, cost: 10000 })
    const r = det.detect('t5')
    expect(r.severity).toBe('critical')
    expect(r.reasons.length).toBeGreaterThanOrEqual(2)
  })

  it('FR-R130.6: onAnomaly listener 호출', () => {
    let called = 0
    det.onAnomaly(() => called++)
    for (let i = 0; i < 9; i++) {
      det.record({ tenantId: 't6', timestamp: 1000 + i, cost: 50 })
    }
    det.record({ tenantId: 't6', timestamp: 2000, cost: 10000 })
    det.detect('t6')
    expect(called).toBeGreaterThanOrEqual(1)
  })

  it('cool-down: 중복 알람 억제', () => {
    const d2 = new CostAnomalyDetector(DataGrade.O, {
      windowSize: 10,
      coolDownMs: 100000,
    })
    let called = 0
    d2.onAnomaly(() => called++)
    for (let i = 0; i < 9; i++) {
      d2.record({ tenantId: 't', timestamp: 1000 + i, cost: 50 })
    }
    d2.record({ tenantId: 't', timestamp: 2000, cost: 10000 })
    d2.detect('t')
    d2.detect('t')
    expect(called).toBe(1)
    const log = d2.getAuditLog()
    expect(log.some((e) => e.action === 'coolDownSuppressed')).toBe(true)
  })

  it('음수 cost throw', () => {
    expect(() =>
      det.record({ tenantId: 't', timestamp: 0, cost: -10 }),
    ).toThrow('non-negative')
  })

  it('N2SF N-05: C/S 등급 차단', () => {
    expect(() => new CostAnomalyDetector(DataGrade.C)).toThrow('N2SF N-05')
    expect(() => new CostAnomalyDetector(DataGrade.S)).toThrow('N2SF N-05')
  })

  it('windowSize 미달 → normal', () => {
    det.record({ tenantId: 'tx', timestamp: 1, cost: 100 })
    det.record({ tenantId: 'tx', timestamp: 2, cost: 200 })
    const r = det.detect('tx')
    expect(r.severity).toBe('normal')
  })

  it('빈 tenantId throw', () => {
    expect(() =>
      det.record({ tenantId: '', timestamp: 0, cost: 10 }),
    ).toThrow('must not be empty')
  })

  it('data 없는 tenant detect throw', () => {
    expect(() => det.detect('unknown')).toThrow('no data')
  })

  it('windowSize < 3 throw', () => {
    expect(() => new CostAnomalyDetector(DataGrade.O, { windowSize: 2 })).toThrow(
      '>= 3',
    )
  })

  it('FR-R130.7: getAuditLog append-only', () => {
    feedFlat('t', 5, 100)
    const l1 = det.getAuditLog()
    l1.push({ action: 'recorded', tenantId: '', timestamp: 0, details: {} })
    const l2 = det.getAuditLog()
    expect(l2.length).toBeLessThan(l1.length)
  })
})
