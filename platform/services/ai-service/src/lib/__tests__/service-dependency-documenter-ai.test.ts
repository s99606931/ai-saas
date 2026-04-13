import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceDependencyDocumenterAi, type ServiceDefinition, type ServiceDependency } from '../service-dependency-documenter-ai'

describe('ServiceDependencyDocumenterAi', () => {
  let ai: ServiceDependencyDocumenterAi

  const svc: ServiceDefinition = { serviceId: 'SVC001', name: '민원 API', version: '1.0.0', team: '민원팀' }
  const svc2: ServiceDefinition = { serviceId: 'SVC002', name: 'DB 서비스', version: '2.0.0', team: 'DB팀' }

  beforeEach(() => {
    ai = new ServiceDependencyDocumenterAi()
    ai.registerService(svc)
    ai.registerService(svc2)
  })

  it('서비스 등록 감사 로그', () => {
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'service.register')).toBe(true)
  })

  it('의존성 없는 서비스 문서화', () => {
    const doc = ai.generateDoc('SVC001')
    expect(doc.serviceId).toBe('SVC001')
    expect(doc.dependencies.length).toBe(0)
    expect(doc.healthStatus).toBe('HEALTHY')
  })

  it('의존성 추가 후 문서 반영', () => {
    const dep: ServiceDependency = { fromServiceId: 'SVC001', toServiceId: 'SVC002', dependencyType: 'DATABASE', criticalPath: true }
    ai.addDependency(dep)
    const doc = ai.generateDoc('SVC001')
    expect(doc.dependencies.length).toBe(1)
    expect(doc.criticalPathCount).toBe(1)
  })

  it('역방향 의존성 (dependents) 반영', () => {
    const dep: ServiceDependency = { fromServiceId: 'SVC001', toServiceId: 'SVC002', dependencyType: 'SYNC', criticalPath: false }
    ai.addDependency(dep)
    const doc = ai.generateDoc('SVC002')
    expect(doc.dependents).toContain('SVC001')
  })

  it('크리티컬 패스 4개 이상 → DEGRADED', () => {
    for (let i = 3; i <= 7; i++) {
      const extra: ServiceDefinition = { serviceId: `SVC00${i}`, name: `서비스${i}`, version: '1.0.0', team: '팀' }
      ai.registerService(extra)
      ai.addDependency({ fromServiceId: 'SVC001', toServiceId: `SVC00${i}`, dependencyType: 'SYNC', criticalPath: true })
    }
    const doc = ai.generateDoc('SVC001')
    expect(doc.healthStatus).toBe('DEGRADED')
  })

  it('미등록 서비스 의존성 추가 에러', () => {
    expect(() => ai.addDependency({ fromServiceId: 'UNKNOWN', toServiceId: 'SVC002', dependencyType: 'SYNC', criticalPath: false })).toThrow()
  })

  it('미등록 서비스 문서화 에러', () => {
    expect(() => ai.generateDoc('UNKNOWN')).toThrow()
  })

  it('문서 생성 후 감사 로그', () => {
    ai.generateDoc('SVC001')
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'doc.generate')).toBe(true)
  })
})
