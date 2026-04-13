import { describe, it, expect, beforeEach } from 'vitest'
import { PublicInputValidatorV2 } from '../public-input-validator-v2'

describe('PublicInputValidatorV2', () => {
  let validator: PublicInputValidatorV2

  beforeEach(() => {
    validator = new PublicInputValidatorV2()
  })

  it('규칙 등록 후 조회 가능', () => {
    validator.addRule('email', 'required')
    const rules = validator.getFieldRules('email')
    expect(rules.some((r) => r.ruleType === 'required')).toBe(true)
  })

  it('required 규칙: 빈 값 실패', () => {
    validator.addRule('name', 'required')
    const result = validator.validate('name', '')
    expect(result.valid).toBe(false)
  })

  it('required 규칙: 값 있으면 성공', () => {
    validator.addRule('name', 'required')
    const result = validator.validate('name', '홍길동')
    expect(result.valid).toBe(true)
  })

  it('minLength 규칙: 짧은 값 실패', () => {
    validator.addRule('password', 'minLength', 8)
    const result = validator.validate('password', 'abc')
    expect(result.valid).toBe(false)
  })

  it('maxLength 규칙: 긴 값 실패', () => {
    validator.addRule('name', 'maxLength', 5)
    const result = validator.validate('name', '홍길동홍길동홍')
    expect(result.valid).toBe(false)
  })

  it('pattern 규칙: 이메일 형식 검증', () => {
    validator.addRule('email', 'pattern', undefined, '^[^@]+@[^@]+$')
    expect(validator.validate('email', 'test@example.com').valid).toBe(true)
    expect(validator.validate('email', 'invalid-email').valid).toBe(false)
  })

  it('C등급 데이터 전송 차단', () => {
    validator.addRule('field', 'required')
    expect(() => validator.validate('field', 'value', 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    validator.addRule('field', 'required')
    expect(() => validator.validate('field', 'value', 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    validator.addRule('name', 'required')
    validator.validate('name', '홍길동')
    const log = validator.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
