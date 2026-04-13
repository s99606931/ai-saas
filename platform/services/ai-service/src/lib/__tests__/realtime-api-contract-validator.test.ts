import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimeApiContractValidator, type ApiContract } from '../realtime-api-contract-validator'

describe('RealtimeApiContractValidator', () => {
  let validator: RealtimeApiContractValidator

  const contract: ApiContract = {
    contractId: 'CONTRACT001',
    serviceName: '민원 API',
    endpoint: '/api/v1/complaints',
    version: '1.0.0',
    schema: [
      { fieldName: 'title', type: 'string', required: true },
      { fieldName: 'description', type: 'string', required: true },
      { fieldName: 'category', type: 'string', required: false },
      { fieldName: 'legacyId', type: 'number', required: false, deprecated: true },
    ],
  }

  beforeEach(() => {
    validator = new RealtimeApiContractValidator()
    validator.registerContract(contract)
  })

  it('계약 등록 감사 로그', () => {
    const log = validator.getAuditLog()
    expect(log.some((e) => e.action === 'contract.register')).toBe(true)
  })

  it('유효한 페이로드 → isValid true', () => {
    const result = validator.validate('CONTRACT001', { title: '민원 제목', description: '내용' })
    expect(result.isValid).toBe(true)
    expect(result.violations.filter((v) => v.severity === 'CRITICAL').length).toBe(0)
  })

  it('필수 필드 누락 → MISSING_FIELD CRITICAL', () => {
    const result = validator.validate('CONTRACT001', { title: '민원 제목' })
    expect(result.violations.some((v) => v.violationType === 'MISSING_FIELD' && v.fieldName === 'description')).toBe(true)
    expect(result.breakingChangeDetected).toBe(true)
  })

  it('타��� 불일치 → TYPE_MISMATCH HIGH', () => {
    const result = validator.validate('CONTRACT001', { title: 123, description: '내용' })
    expect(result.violations.some((v) => v.violationType === 'TYPE_MISMATCH' && v.fieldName === 'title')).toBe(true)
  })

  it('deprecated 필드 사용 → DEPRECATED_FIELD MEDIUM', () => {
    const result = validator.validate('CONTRACT001', { title: '제목', description: '내용', legacyId: 42 })
    expect(result.violations.some((v) => v.violationType === 'DEPRECATED_FIELD' && v.fieldName === 'legacyId')).toBe(true)
  })

  it('미정의 필드 → SCHEMA_CHANGED LOW', () => {
    const result = validator.validate('CONTRACT001', { title: '제목', description: '내용', unknownField: 'x' })
    expect(result.violations.some((v) => v.violationType === 'SCHEMA_CHANGED' && v.fieldName === 'unknownField')).toBe(true)
  })

  it('미등록 계약 에러', () => {
    expect(() => validator.validate('UNKNOWN', { title: '제목' })).toThrow()
  })

  it('검증 후 감사 로그', () => {
    validator.validate('CONTRACT001', { title: '제목', description: '내용' })
    const log = validator.getAuditLog()
    expect(log.some((e) => e.action === 'contract.validate')).toBe(true)
  })
})
