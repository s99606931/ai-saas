import { describe, it, expect, beforeEach } from 'vitest'
import { SecurityTestGeneratorAi, type ApiEndpoint } from '../security-test-generator-ai'

describe('SecurityTestGeneratorAi', () => {
  let generator: SecurityTestGeneratorAi

  const endpoint: ApiEndpoint = {
    endpointId: 'EP001',
    path: '/api/v1/complaints',
    method: 'POST',
    authRequired: true,
    inputFields: [
      { name: 'title', type: 'string', sensitive: false },
      { name: 'ssn', type: 'string', sensitive: true },
    ],
  }

  beforeEach(() => {
    generator = new SecurityTestGeneratorAi()
    generator.registerEndpoint(endpoint)
  })

  it('엔드포인트 등록 감사 로그', () => {
    const log = generator.getAuditLog()
    expect(log.some((e) => e.action === 'endpoint.register')).toBe(true)
  })

  it('문자열 필드 → SQL_INJECTION 테스트 생성', () => {
    const suite = generator.generate('EP001')
    expect(suite.testCases.some((t) => t.testType === 'SQL_INJECTION')).toBe(true)
    expect(suite.testCases.some((t) => t.testType === 'SQL_INJECTION' && t.severity === 'CRITICAL')).toBe(true)
  })

  it('인증 필요 엔드포인트 → AUTH_BYPASS 테스트', () => {
    const suite = generator.generate('EP001')
    expect(suite.testCases.some((t) => t.testType === 'AUTH_BYPASS')).toBe(true)
  })

  it('민감 필드 → SENSITIVE_EXPOSURE 테스트', () => {
    const suite = generator.generate('EP001')
    expect(suite.testCases.some((t) => t.testType === 'SENSITIVE_EXPOSURE')).toBe(true)
  })

  it('GET 엔드포인트 → IDOR 테스트', () => {
    generator.registerEndpoint({ ...endpoint, endpointId: 'EP002', method: 'GET', inputFields: [] })
    const suite = generator.generate('EP002')
    expect(suite.testCases.some((t) => t.testType === 'IDOR')).toBe(true)
  })

  it('인증 불필요 + 비문자열 필드 → AUTH_BYPASS/XSS 없음', () => {
    generator.registerEndpoint({
      ...endpoint,
      endpointId: 'EP003',
      method: 'GET',
      authRequired: false,
      inputFields: [{ name: 'count', type: 'number', sensitive: false }],
    })
    const suite = generator.generate('EP003')
    expect(suite.testCases.every((t) => t.testType !== 'AUTH_BYPASS')).toBe(true)
    expect(suite.testCases.every((t) => t.testType !== 'XSS')).toBe(true)
  })

  it('미등록 엔드포인트 에러', () => {
    expect(() => generator.generate('UNKNOWN')).toThrow()
  })

  it('생성 후 감사 로그', () => {
    generator.generate('EP001')
    const log = generator.getAuditLog()
    expect(log.some((e) => e.action === 'test.generate')).toBe(true)
  })
})
