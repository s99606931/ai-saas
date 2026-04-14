// Plan SC: SVC-AI-ADV-R491-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceMeshSecurityAIV2, type MeshService } from '../service-mesh-security-ai-v2'

describe('ServiceMeshSecurityAIV2', () => {
  let analyzer: ServiceMeshSecurityAIV2

  const secureSvc: MeshService = {
    serviceId: 'SVC-SECURE',
    name: '안전 서비스',
    namespace: 'production',
    mtlsEnabled: true,
    egressRules: ['SVC-DB', 'SVC-CACHE'],
    certExpiryDaysRemaining: 90,
    ingressPolicies: ['POLICY-A'],
  }

  beforeEach(() => {
    analyzer = new ServiceMeshSecurityAIV2()
  })

  it('서비스 없을 때 → COMPLIANT, complianceScore=100', () => {
    const report = analyzer.analyze()
    expect(report.overallStatus).toBe('COMPLIANT')
    expect(report.complianceScore).toBe(100)
  })

  it('보안 서비스 → 이슈 없음, COMPLIANT', () => {
    analyzer.registerService(secureSvc)
    const report = analyzer.analyze()
    expect(report.issues.filter((i) => i.serviceId === 'SVC-SECURE')).toHaveLength(0)
    expect(report.overallStatus).toBe('COMPLIANT')
  })

  it('mTLS 비활성화 → CRITICAL MISSING_MTLS 이슈, VIOLATION', () => {
    analyzer.registerService({ ...secureSvc, serviceId: 'SVC-NOMTLS', mtlsEnabled: false })
    const report = analyzer.analyze()
    expect(report.issues.some((i) => i.type === 'MISSING_MTLS' && i.severity === 'CRITICAL')).toBe(true)
    expect(report.overallStatus).toBe('VIOLATION')
  })

  it('인증서 7일 이하 → CRITICAL CERT_EXPIRY 이슈', () => {
    analyzer.registerService({ ...secureSvc, serviceId: 'SVC-CERT', certExpiryDaysRemaining: 5 })
    const report = analyzer.analyze()
    expect(report.issues.some((i) => i.type === 'CERT_EXPIRY' && i.severity === 'CRITICAL')).toBe(true)
  })

  it('개방형 Egress (규칙 없음 + 인바운드 있음) → HIGH OPEN_EGRESS', () => {
    analyzer.registerService({ ...secureSvc, serviceId: 'SVC-EGRESS', egressRules: [], ingressPolicies: ['POL-A'] })
    const report = analyzer.analyze()
    expect(report.issues.some((i) => i.type === 'OPEN_EGRESS' && i.severity === 'HIGH')).toBe(true)
  })

  it('nonCompliantServices에 위반 서비스 포함', () => {
    analyzer.registerService({ ...secureSvc, serviceId: 'SVC-BAD', mtlsEnabled: false })
    const report = analyzer.analyze()
    expect(report.nonCompliantServices).toContain('SVC-BAD')
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    analyzer.registerService(secureSvc)
    analyzer.analyze()
    const log1 = analyzer.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', serviceId: 'X', detail: {} })
    const log2 = analyzer.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
