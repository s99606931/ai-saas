// Plan SC: SVC-AI-ADV-R402-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceDependencyDocumenterV2, type ServiceDefinition } from '../service-dependency-documenter-v2'

describe('ServiceDependencyDocumenterV2', () => {
  let documenter: ServiceDependencyDocumenterV2

  const svcA: ServiceDefinition = { serviceId: 'SVC-A', name: 'AI 서비스', version: '1.0.0', team: '개발팀', description: 'AI 기능 제공' }
  const svcB: ServiceDefinition = { serviceId: 'SVC-B', name: '인증 서비스', version: '2.0.0', team: '보안팀', description: '사용자 인증 처리' }
  const svcC: ServiceDefinition = { serviceId: 'SVC-C', name: 'DB 서비스', version: '1.2.0', team: '데이터팀', description: '데이터 저장' }

  beforeEach(() => {
    documenter = new ServiceDependencyDocumenterV2()
    documenter.registerService(svcA)
    documenter.registerService(svcB)
    documenter.registerService(svcC)
  })

  it('미등록 서비스 의존성 추가 시 오류 발생', () => {
    expect(() =>
      documenter.addDependency({ fromServiceId: 'SVC-A', toServiceId: 'UNKNOWN', type: 'SYNC', critical: false })
    ).toThrow('Unknown service')
  })

  it('미등록 서비스 문서화 시 오류 발생', () => {
    expect(() => documenter.document('NONE', 'MARKDOWN')).toThrow('Unknown service')
  })

  it('MARKDOWN 형식 문서 생성', () => {
    documenter.addDependency({ fromServiceId: 'SVC-A', toServiceId: 'SVC-B', type: 'SYNC', protocol: 'HTTP', critical: true })
    const doc = documenter.document('SVC-A', 'MARKDOWN')
    expect(doc.format).toBe('MARKDOWN')
    expect(doc.content).toContain('AI 서비스')
    expect(doc.content).toContain('인증 서비스')
    expect(doc.dependencyCount).toBe(1)
    expect(doc.criticalDependencies).toContain('인증 서비스')
  })

  it('MERMAID 형식 문서 생성', () => {
    documenter.addDependency({ fromServiceId: 'SVC-A', toServiceId: 'SVC-C', type: 'DATABASE', critical: false })
    const doc = documenter.document('SVC-A', 'MERMAID')
    expect(doc.format).toBe('MERMAID')
    expect(doc.content).toContain('graph LR')
    expect(doc.content).toContain('SVC-A')
    expect(doc.content).toContain('SVC-C')
  })

  it('JSON 형식 문서 생성', () => {
    documenter.addDependency({ fromServiceId: 'SVC-A', toServiceId: 'SVC-B', type: 'ASYNC', critical: false })
    const doc = documenter.document('SVC-A', 'JSON')
    expect(doc.format).toBe('JSON')
    const parsed = JSON.parse(doc.content)
    expect(parsed.service.id).toBe('SVC-A')
    expect(parsed.outbound).toHaveLength(1)
  })

  it('인바운드 의존성 포함 문서화', () => {
    documenter.addDependency({ fromServiceId: 'SVC-B', toServiceId: 'SVC-A', type: 'SYNC', critical: false })
    const doc = documenter.document('SVC-A', 'MARKDOWN')
    expect(doc.content).toContain('인바운드 의존성')
  })

  it('크리티컬 의존성 목록 정확히 반환', () => {
    documenter.addDependency({ fromServiceId: 'SVC-A', toServiceId: 'SVC-B', type: 'SYNC', critical: true })
    documenter.addDependency({ fromServiceId: 'SVC-A', toServiceId: 'SVC-C', type: 'DATABASE', critical: false })
    const doc = documenter.document('SVC-A', 'MARKDOWN')
    expect(doc.criticalDependencies).toContain('인증 서비스')
    expect(doc.criticalDependencies).not.toContain('DB 서비스')
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    documenter.addDependency({ fromServiceId: 'SVC-A', toServiceId: 'SVC-B', type: 'SYNC', critical: false })
    documenter.document('SVC-A', 'JSON')
    const log1 = documenter.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', serviceId: 'X', detail: {} })
    const log2 = documenter.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
