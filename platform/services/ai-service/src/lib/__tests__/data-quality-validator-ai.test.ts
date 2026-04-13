import { describe, it, expect, beforeEach } from 'vitest'
import { DataQualityValidatorAI } from '../data-quality-validator-ai'

describe('DataQualityValidatorAI', () => {
  let validator: DataQualityValidatorAI

  beforeEach(() => {
    validator = new DataQualityValidatorAI()
    validator.registerSchema('DS-1', [
      { fieldName: 'name', type: 'STRING', required: true, minLength: 2, maxLength: 50 },
      { fieldName: 'email', type: 'EMAIL', required: true },
      { fieldName: 'age', type: 'NUMBER', required: false },
    ])
  })

  it('N2SF C등급 차단', () => {
    expect(() => validator.validate({ datasetId: 'DS-1', grade: 'C', fields: { name: '홍길동', email: 'a@b.com' } })).toThrow('BLOCKED')
  })

  it('알 수 없는 스키마 오류', () => {
    expect(() => validator.validate({ datasetId: 'UNKNOWN', grade: 'O', fields: {} })).toThrow('Unknown schema')
  })

  it('정상 데이터 — PASSED', () => {
    const result = validator.validate({ datasetId: 'DS-1', grade: 'O', fields: { name: '홍길동', email: 'hong@gov.kr', age: 35 } })
    expect(result.status).toBe('PASSED')
    expect(result.qualityScore).toBe(100)
  })

  it('이메일 형식 오류 — FAILED', () => {
    const result = validator.validate({ datasetId: 'DS-1', grade: 'O', fields: { name: '홍길동', email: 'invalid-email' } })
    expect(result.status).toBe('FAILED')
    expect(result.issues.some((i) => i.fieldName === 'email')).toBe(true)
  })

  it('필수 필드 누락 — FAILED', () => {
    const result = validator.validate({ datasetId: 'DS-1', grade: 'O', fields: { email: 'a@b.com' } })
    expect(result.status).toBe('FAILED')
    expect(result.issues.some((i) => i.fieldName === 'name' && i.severity === 'ERROR')).toBe(true)
  })

  it('maxLength 초과 — FAILED', () => {
    const longName = 'A'.repeat(60)
    const result = validator.validate({ datasetId: 'DS-1', grade: 'O', fields: { name: longName, email: 'a@b.com' } })
    expect(result.status).toBe('FAILED')
  })

  it('감사 로그 복사본 반환', () => {
    validator.validate({ datasetId: 'DS-1', grade: 'O', fields: { name: '홍', email: 'a@b.com' } })
    const log = validator.getAuditLog()
    log.push({ timestamp: '', action: 'injected', datasetId: 'X', detail: {} })
    expect(validator.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
