/**
 * Unit tests for Chaos Engineering AI — SVC-AI-ADV-R139
 */
import { describe, it, expect } from 'vitest'
import { ChaosEngineeringAi, DataGrade } from '../chaos-engineering-ai'

const makeProfile = (overrides = {}) => ({
  name: 'api-service',
  replicas: 3,
  hasPdb: true,
  hasCircuitBreaker: true,
  hasRetry: true,
  sloTargetMs: 200,
  grade: DataGrade.O,
  ...overrides,
})

describe('SVC-AI-ADV-R139 ChaosEngineeringAi', () => {
  it('[FR-R139.1] registers service', () => {
    const engine = new ChaosEngineeringAi()
    engine.registerService(makeProfile())
    const report = engine.analyzeService('api-service')
    expect(report.service).toBe('api-service')
  })

  it('[FR-R139.1] blocks C/S grade services', () => {
    const engine = new ChaosEngineeringAi()
    expect(() => engine.registerService(makeProfile({ grade: DataGrade.C }))).toThrow('BLOCKED')
    expect(() => engine.registerService(makeProfile({ grade: DataGrade.S }))).toThrow('BLOCKED')
  })

  it('[FR-R139.2] detects missing PDB as vulnerability', () => {
    const engine = new ChaosEngineeringAi()
    engine.registerService(makeProfile({ hasPdb: false }))
    const report = engine.analyzeService('api-service')
    expect(report.vulnerabilities.some(v => v.includes('PodDisruptionBudget'))).toBe(true)
  })

  it('[FR-R139.3] designs experiment for missing circuit breaker', () => {
    const engine = new ChaosEngineeringAi()
    engine.registerService(makeProfile({ hasCircuitBreaker: false }))
    const report = engine.analyzeService('api-service')
    expect(report.experiments.some(e => e.faultType === 'network-delay')).toBe(true)
  })

  it('[FR-R139.4] single replica → HIGH overall risk', () => {
    const engine = new ChaosEngineeringAi()
    engine.registerService(makeProfile({ replicas: 1, hasPdb: false, hasCircuitBreaker: false, hasRetry: false }))
    const report = engine.analyzeService('api-service')
    expect(['HIGH', 'CRITICAL']).toContain(report.overallRisk)
  })

  it('[FR-R139.5] analyzeAll returns all registered services', () => {
    const engine = new ChaosEngineeringAi()
    engine.registerService(makeProfile({ name: 'svc-a' }))
    engine.registerService(makeProfile({ name: 'svc-b' }))
    const reports = engine.analyzeAll()
    expect(reports).toHaveLength(2)
  })

  it('throws on unknown service', () => {
    const engine = new ChaosEngineeringAi()
    expect(() => engine.analyzeService('unknown')).toThrow('not registered')
  })

  it('audit log records analyze', () => {
    const engine = new ChaosEngineeringAi()
    engine.registerService(makeProfile())
    engine.analyzeService('api-service')
    expect(engine.getAuditLog().some(e => e.action === 'analyzeService')).toBe(true)
  })
})
