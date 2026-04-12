import { describe, it, expect, beforeEach } from 'vitest'
import { ApiEndpointSecurityClassifier } from '../api-endpoint-security-classifier'

describe('ApiEndpointSecurityClassifier', () => {
  let classifier: ApiEndpointSecurityClassifier

  beforeEach(() => {
    classifier = new ApiEndpointSecurityClassifier()
  })

  it('인증 없는 공개 경로 → PUBLIC', () => {
    classifier.registerEndpoint({ endpointId: 'E1', path: '/api/health', method: 'GET', description: '헬스체크', hasAuth: false, roles: [] })
    const cls = classifier.classify('E1')
    expect(cls.level).toBe('PUBLIC')
    expect(cls.csapCompliant).toBe(true)
  })

  it('/admin 경로 → INTERNAL + 인증 없으면 위반', () => {
    classifier.registerEndpoint({ endpointId: 'E2', path: '/admin/users', method: 'GET', description: '관리자', hasAuth: false, roles: [] })
    const cls = classifier.classify('E2')
    expect(cls.level).toBe('INTERNAL')
    expect(cls.csapCompliant).toBe(false)
    expect(cls.issues.length).toBeGreaterThan(0)
  })

  it('admin 역할 포함 → PRIVILEGED', () => {
    classifier.registerEndpoint({ endpointId: 'E3', path: '/api/settings', method: 'PUT', description: '설정', hasAuth: true, roles: ['admin'] })
    const cls = classifier.classify('E3')
    expect(cls.level).toBe('PRIVILEGED')
    expect(cls.csapCompliant).toBe(true)
  })

  it('hasAuth=true, 일반 경로 → AUTHENTICATED', () => {
    classifier.registerEndpoint({ endpointId: 'E4', path: '/api/profile', method: 'GET', description: '프로필', hasAuth: true, roles: ['user'] })
    const cls = classifier.classify('E4')
    expect(cls.level).toBe('AUTHENTICATED')
    expect(cls.csapCompliant).toBe(true)
  })

  it('알 수 없는 엔드포인트 분류 시 오류', () => {
    expect(() => classifier.classify('UNKNOWN')).toThrow('Unknown endpoint')
  })

  it('준수 리포트: 미준수 항목 집계', () => {
    classifier.registerEndpoint({ endpointId: 'E5', path: '/internal/debug', method: 'GET', description: '디버그', hasAuth: false, roles: [] })
    classifier.registerEndpoint({ endpointId: 'E6', path: '/api/public', method: 'GET', description: '공개', hasAuth: false, roles: [] })
    const report = classifier.generateComplianceReport()
    expect(report.totalEndpoints).toBe(2)
    expect(report.nonCompliant).toBe(1)
    expect(report.compliant).toBe(1)
  })

  it('감사 로그 복사본 반환', () => {
    classifier.registerEndpoint({ endpointId: 'E7', path: '/api/test', method: 'GET', description: '테스트', hasAuth: false, roles: [] })
    classifier.classify('E7')
    const log = classifier.getAuditLog()
    log.push({ timestamp: '', action: 'injected', endpointId: 'X', detail: {} })
    expect(classifier.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
