import { describe, it, expect, beforeEach } from 'vitest'
import { ApiSecurityPolicyAutomator, type ApiEndpoint } from '../api-security-policy-automator'

describe('ApiSecurityPolicyAutomator', () => {
  let automator: ApiSecurityPolicyAutomator

  const safeEndpoint: ApiEndpoint = {
    endpointId: 'EP001',
    path: '/api/v1/complaints',
    method: 'GET',
    requiresAuth: true,
    rateLimitPerMin: 100,
    isAdminOnly: false,
    exposesSensitiveData: false,
  }

  beforeEach(() => {
    automator = new ApiSecurityPolicyAutomator()
    automator.registerEndpoint(safeEndpoint)
  })

  it('엔드포인트 등록 감사 로그', () => {
    const log = automator.getAuditLog()
    expect(log.some((e) => e.action === 'endpoint.register')).toBe(true)
  })

  it('안전한 엔드포인트 → LOW 위험', () => {
    const report = automator.audit('EP001')
    expect(report.overallRisk).toBe('LOW')
    expect(report.violations.length).toBe(0)
  })

  it('인증 없는 POST → CRITICAL NO_AUTH + PUBLIC_WRITE', () => {
    automator.registerEndpoint({
      endpointId: 'EP002', path: '/api/submit', method: 'POST',
      requiresAuth: false, rateLimitPerMin: 100, isAdminOnly: false, exposesSensitiveData: false,
    })
    const report = automator.audit('EP002')
    expect(report.overallRisk).toBe('CRITICAL')
    expect(report.violations.some((v) => v.violationType === 'NO_AUTH')).toBe(true)
    expect(report.violations.some((v) => v.violationType === 'PUBLIC_WRITE')).toBe(true)
  })

  it('Rate Limit 없음 → NO_RATE_LIMIT HIGH', () => {
    automator.registerEndpoint({
      endpointId: 'EP003', path: '/api/data', method: 'GET',
      requiresAuth: true, rateLimitPerMin: 0, isAdminOnly: false, exposesSensitiveData: false,
    })
    const report = automator.audit('EP003')
    expect(report.violations.some((v) => v.violationType === 'NO_RATE_LIMIT')).toBe(true)
    expect(report.autoAppliedPolicies).toContain('RATE_LIMIT')
  })

  it('관리자 전용 + 인증 없음 → ADMIN_UNPROTECTED CRITICAL', () => {
    automator.registerEndpoint({
      endpointId: 'EP004', path: '/admin/users', method: 'GET',
      requiresAuth: false, rateLimitPerMin: 50, isAdminOnly: true, exposesSensitiveData: false,
    })
    const report = automator.audit('EP004')
    expect(report.violations.some((v) => v.violationType === 'ADMIN_UNPROTECTED')).toBe(true)
    expect(report.autoAppliedPolicies).toContain('REQUIRE_ADMIN')
  })

  it('민감 데이터 + 미인증 → SENSITIVE_EXPOSED', () => {
    automator.registerEndpoint({
      endpointId: 'EP005', path: '/api/personal', method: 'GET',
      requiresAuth: false, rateLimitPerMin: 50, isAdminOnly: false, exposesSensitiveData: true,
    })
    const report = automator.audit('EP005')
    expect(report.violations.some((v) => v.violationType === 'SENSITIVE_EXPOSED')).toBe(true)
  })

  it('미등록 엔드포인트 에러', () => {
    expect(() => automator.audit('UNKNOWN')).toThrow()
  })

  it('감사 후 로그 기록', () => {
    automator.audit('EP001')
    const log = automator.getAuditLog()
    expect(log.some((e) => e.action === 'endpoint.audit')).toBe(true)
  })
})
