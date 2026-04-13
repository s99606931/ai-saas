// Plan SC: SVC-AI-ADV-R432-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { ApiBackwardCompatibilityCheckerV2, type ApiSchema } from '../api-backward-compatibility-checker-v2'

describe('ApiBackwardCompatibilityCheckerV2', () => {
  let checker: ApiBackwardCompatibilityCheckerV2

  const v1Schema: ApiSchema = {
    apiId: 'API-1',
    version: 'v1',
    endpoints: [{
      path: '/users',
      method: 'GET',
      requestFields: [],
      responseFields: [
        { name: 'id', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
      ],
      statusCodes: [200, 404],
    }],
  }

  beforeEach(() => {
    checker = new ApiBackwardCompatibilityCheckerV2()
    checker.registerSchema(v1Schema)
  })

  it('미등록 버전 검사 시 오류 발생', () => {
    expect(() => checker.check('API-1', 'v1', 'v999')).toThrow('Unknown schema version')
  })

  it('변경 없는 스키마 → COMPATIBLE', () => {
    checker.registerSchema({ ...v1Schema, version: 'v2' })
    const report = checker.check('API-1', 'v1', 'v2')
    expect(report.status).toBe('COMPATIBLE')
    expect(report.breakingCount).toBe(0)
  })

  it('응답 필드 제거 → BREAKING', () => {
    checker.registerSchema({
      ...v1Schema,
      version: 'v2',
      endpoints: [{
        path: '/users',
        method: 'GET',
        requestFields: [],
        responseFields: [
          { name: 'id', type: 'string' },
          // name 필드 제거됨
        ],
        statusCodes: [200, 404],
      }],
    })
    const report = checker.check('API-1', 'v1', 'v2')
    expect(report.status).toBe('BREAKING')
    const issue = report.issues.find((i) => i.type === 'FIELD_REMOVED')
    expect(issue).toBeDefined()
  })

  it('엔드포인트 제거 → BREAKING', () => {
    checker.registerSchema({ apiId: 'API-1', version: 'v2', endpoints: [] })
    const report = checker.check('API-1', 'v1', 'v2')
    expect(report.status).toBe('BREAKING')
    const issue = report.issues.find((i) => i.type === 'ENDPOINT_REMOVED')
    expect(issue).toBeDefined()
    expect(issue?.severity).toBe('CRITICAL')
  })

  it('필수 요청 필드 추가 → BREAKING', () => {
    checker.registerSchema({
      ...v1Schema,
      version: 'v2',
      endpoints: [{
        path: '/users',
        method: 'GET',
        requestFields: [{ name: 'tenantId', type: 'string', required: true }],
        responseFields: v1Schema.endpoints[0]!.responseFields,
        statusCodes: [200, 404],
      }],
    })
    const report = checker.check('API-1', 'v1', 'v2')
    const issue = report.issues.find((i) => i.type === 'REQUIRED_FIELD_ADDED')
    expect(issue).toBeDefined()
  })

  it('타입 변경 → BREAKING', () => {
    checker.registerSchema({
      ...v1Schema,
      version: 'v2',
      endpoints: [{
        path: '/users',
        method: 'GET',
        requestFields: [],
        responseFields: [
          { name: 'id', type: 'number' },  // string → number
          { name: 'name', type: 'string' },
          { name: 'email', type: 'string' },
        ],
        statusCodes: [200, 404],
      }],
    })
    const report = checker.check('API-1', 'v1', 'v2')
    const issue = report.issues.find((i) => i.type === 'TYPE_CHANGED')
    expect(issue).toBeDefined()
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    checker.registerSchema({ ...v1Schema, version: 'v2' })
    checker.check('API-1', 'v1', 'v2')
    const log1 = checker.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', apiId: 'X', detail: {} })
    const log2 = checker.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
