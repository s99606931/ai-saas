/**
 * Unit tests for Service Mesh Optimizer — SVC-AI-ADV-R138
 */
import { describe, it, expect } from 'vitest'
import { ServiceMeshOptimizer, DataGrade } from '../service-mesh-optimizer'

const makeSample = (overrides = {}) => ({
  sourceService: 'frontend',
  destService: 'api',
  timestamp: '2026-04-12T10:00:00Z',
  latencyMs: 120,
  errorRate: 0.01,
  rps: 50,
  grade: DataGrade.O,
  ...overrides,
})

describe('SVC-AI-ADV-R138 ServiceMeshOptimizer', () => {
  it('[FR-R138.1] adds traffic sample', () => {
    const opt = new ServiceMeshOptimizer()
    opt.addTrafficSample(makeSample())
    const report = opt.optimize()
    expect(report.recommendations.length + report.highLatencyRoutes.length + report.highErrorRoutes.length).toBeGreaterThanOrEqual(0)
  })

  it('[FR-R138.1] blocks C/S grade samples', () => {
    const opt = new ServiceMeshOptimizer()
    expect(() => opt.addTrafficSample(makeSample({ grade: DataGrade.C }))).toThrow('BLOCKED')
    expect(() => opt.addTrafficSample(makeSample({ grade: DataGrade.S }))).toThrow('BLOCKED')
  })

  it('[FR-R138.5] high latency routes flagged', () => {
    const opt = new ServiceMeshOptimizer()
    opt.addTrafficSample(makeSample({ latencyMs: 800, destService: 'slow-svc' }))
    const report = opt.optimize()
    expect(report.highLatencyRoutes).toContain('slow-svc')
  })

  it('[FR-R138.5] high error routes flagged', () => {
    const opt = new ServiceMeshOptimizer()
    opt.addTrafficSample(makeSample({ errorRate: 0.15, destService: 'error-svc' }))
    const report = opt.optimize()
    expect(report.highErrorRoutes).toContain('error-svc')
  })

  it('[FR-R138.3] recommends LEAST_CONN for high error rate service', () => {
    const opt = new ServiceMeshOptimizer()
    opt.registerRoute({ service: 'svc-a', subsets: [], lbPolicy: 'ROUND_ROBIN', timeoutMs: 5000, retryAttempts: 1 })
    for (let i = 0; i < 5; i++) {
      opt.addTrafficSample(makeSample({ destService: 'svc-a', errorRate: 0.2, latencyMs: 200 }))
    }
    const report = opt.optimize()
    const rec = report.recommendations.find(r => r.destService === 'svc-a')
    expect(rec?.recommendedLbPolicy).toBe('LEAST_CONN')
  })

  it('[FR-R138.6] throws when no samples', () => {
    const opt = new ServiceMeshOptimizer()
    expect(() => opt.optimize()).toThrow('샘플이 없습니다')
  })

  it('audit log records addTrafficSample and optimize', () => {
    const opt = new ServiceMeshOptimizer()
    opt.addTrafficSample(makeSample())
    opt.optimize()
    const log = opt.getAuditLog()
    expect(log.some(e => e.action === 'addTrafficSample')).toBe(true)
    expect(log.some(e => e.action === 'optimize')).toBe(true)
  })
})
