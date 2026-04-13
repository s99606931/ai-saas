import { describe, it, expect, beforeEach } from 'vitest'
import { PublicInputValidatorAi, type ValidationSchema } from '../public-input-validator-ai'

describe('PublicInputValidatorAi', () => {
  let validator: PublicInputValidatorAi

  const schema: ValidationSchema = {
    schemaId: 'SCHEMA001',
    name: '민원 신청서',
    rules: [
      { ruleId: 'R001', fieldName: 'title', type: 'REQUIRED', errorMessage: '제목은 필수입니다' },
      { ruleId: 'R002', fieldName: 'email', type: 'FORMAT', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', errorMessage: '이메일 형식 오류' },
      { ruleId: 'R003', fieldName: 'age', type: 'RANGE', minValue: 1, maxValue: 150, errorMessage: '나이 범위 오류' },
      { ruleId: 'R004', fieldName: 'description', type: 'CUSTOM', minLength: 10, maxLength: 500, errorMessage: '설명 길이 오류' },
    ],
  }

  beforeEach(() => {
    validator = new PublicInputValidatorAi()
    validator.registerSchema(schema)
  })

  it('스키마 등록 감사 로그', () => {
    const log = validator.getAuditLog()
    expect(log.some((e) => e.action === 'schema.register')).toBe(true)
  })

  it('유효한 입력 → isValid true', () => {
    const result = validator.validate('SCHEMA001', { title: '민원 제목', email: 'user@gov.kr', age: 30, description: '상세한 민원 내용입니다.' })
    expect(result.isValid).toBe(true)
    expect(result.violations.filter((v) => v.severity === 'CRITICAL').length).toBe(0)
  })

  it('필수 필드 누락 → CRITICAL 위반', () => {
    const result = validator.validate('SCHEMA001', { email: 'user@gov.kr' })
    expect(result.violations.some((v) => v.fieldName === 'title' && v.violationType === 'REQUIRED')).toBe(true)
    expect(result.violations.some((v) => v.severity === 'CRITICAL')).toBe(true)
    expect(result.isValid).toBe(false)
  })

  it('이메일 형식 오류 → FORMAT HIGH 위반', () => {
    const result = validator.validate('SCHEMA001', { title: '제목', email: 'invalid-email' })
    expect(result.violations.some((v) => v.fieldName === 'email' && v.violationType === 'FORMAT')).toBe(true)
  })

  it('범위 초과 → RANGE MEDIUM 위반', () => {
    const result = validator.validate('SCHEMA001', { title: '제목', age: 200 })
    expect(result.violations.some((v) => v.fieldName === 'age' && v.violationType === 'RANGE')).toBe(true)
  })

  it('길이 부족 → CUSTOM MEDIUM 위반', () => {
    const result = validator.validate('SCHEMA001', { title: '제목', description: '짧음' })
    expect(result.violations.some((v) => v.fieldName === 'description' && v.violationType === 'CUSTOM')).toBe(true)
  })

  it('미등록 스키마 에러', () => {
    expect(() => validator.validate('UNKNOWN', {})).toThrow()
  })

  it('검증 후 감사 로그', () => {
    validator.validate('SCHEMA001', { title: '제목' })
    const log = validator.getAuditLog()
    expect(log.some((e) => e.action === 'input.validate')).toBe(true)
  })
})
