// Plan SC: SVC-AI-ADV-R590-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { ApiSecurityClassifierV2, type ApiEndpoint } from '../api-security-classifier-v2'

describe('ApiSecurityClassifierV2', () => {
  let classifier: ApiSecurityClassifierV2

  const secureEndpoint: ApiEndpoint = {
    endpointId: 'EP-1', serviceId: 'SVC-1',
    path: '/api/v1/data', method: 'GET',
    authType: 'JWT', requiresAdminRole: false,
    returnsPii: false, dataSensitivity: 'PUBLIC',
    rateLimit: 100, tlsRequired: true,
  }

  beforeEach(() => {
    classifier = new ApiSecurityClassifierV2()
  })

  it('미등록 엔드포인트 분류 시 오류 발생', () => {
    expect(() => classifier.classify('UNKNOWN')).toThrow('Unknown endpoint')
  })

  it('보안 적용 엔드포인트 → LOW 위험, COMPLIANT', () => {
    classifier.registerEndpoint(secureEndpoint)
    const result = classifier.classify('EP-1')
    expect(result.riskLevel).toBe('LOW')
    expect(result.complianceStatus).toBe('COMPLIANT')
  })

  it('인증 없는 엔드포인트 → CRITICAL 위험, NON_COMPLIANT', () => {
    classifier.registerEndpoint({ ...secureEndpoint, endpointId: 'EP-NOAUTH', authType: 'NONE' })
    const result = classifier.classify('EP-NOAUTH')
    expect(result.riskLevel).toBe('CRITICAL')
    expect(result.complianceStatus).toBe('NON_COMPLIANT')
    expect(result.findings.some((f) => f.category === '인증' && f.riskLevel === 'CRITICAL')).toBe(true)
  })

  it('PII 반환 엔드포인트 → HIGH 위험 발견', () => {
    classifier.registerEndpoint({ ...secureEndpoint, endpointId: 'EP-PII', returnsPii: true })
    const result = classifier.classify('EP-PII')
    expect(result.findings.some((f) => f.riskLevel === 'HIGH' && f.category === '데이터 보호')).toBe(true)
  })

  it('TLS 미적용 → HIGH 발견 (전송 보안)', () => {
    classifier.registerEndpoint({ ...secureEndpoint, endpointId: 'EP-NOTLS', tlsRequired: false })
    const result = classifier.classify('EP-NOTLS')
    expect(result.findings.some((f) => f.category === '전송 보안' && f.riskLevel === 'HIGH')).toBe(true)
  })

  it('generateReport: 서비스 전체 엔드포인트 요약', () => {
    classifier.registerEndpoint(secureEndpoint)
    classifier.registerEndpoint({ ...secureEndpoint, endpointId: 'EP-2', authType: 'NONE' })
    const report = classifier.generateReport('SVC-1')
    expect(report.totalEndpoints).toBe(2)
    expect(report.criticalCount).toBe(1)
    expect(report.compliantCount).toBe(1)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    classifier.registerEndpoint(secureEndpoint)
    classifier.classify('EP-1')
    const log1 = classifier.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', endpointId: 'X', detail: {} })
    const log2 = classifier.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
