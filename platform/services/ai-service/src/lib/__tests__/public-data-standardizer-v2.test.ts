import { describe, it, expect, beforeEach } from 'vitest'
import { PublicDataStandardizerV2 } from '../public-data-standardizer-v2'

describe('PublicDataStandardizerV2', () => {
  let standardizer: PublicDataStandardizerV2

  beforeEach(() => {
    standardizer = new PublicDataStandardizerV2()
  })

  it('스키마 등록 후 조회 가능', () => {
    const schema = standardizer.registerSchema('sch-1', '민원스키마', [
      { name: 'name', type: 'string', required: true },
    ])
    expect(schema.schemaId).toBe('sch-1')
    expect(schema.fields).toHaveLength(1)
  })

  it('유효한 레코드: 검증 통과', () => {
    standardizer.registerSchema('sch-1', '민원스키마', [
      { name: 'name', type: 'string', required: true },
      { name: 'age', type: 'number', required: true },
    ])
    const result = standardizer.validateRecord('sch-1', { name: '홍길동', age: 30 })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('required 필드 누락: 검증 실패', () => {
    standardizer.registerSchema('sch-1', '민원스키마', [
      { name: 'name', type: 'string', required: true },
    ])
    const result = standardizer.validateRecord('sch-1', {})
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('name'))).toBe(true)
  })

  it('타입 불일치: 검증 실패', () => {
    standardizer.registerSchema('sch-1', '민원스키마', [
      { name: 'age', type: 'number', required: true },
    ])
    const result = standardizer.validateRecord('sch-1', { age: '서른' })
    expect(result.valid).toBe(false)
  })

  it('getValidationStats: 통계 집계', () => {
    standardizer.registerSchema('sch-1', '민원스키마', [
      { name: 'name', type: 'string', required: true },
    ])
    standardizer.validateRecord('sch-1', { name: '홍길동' })
    standardizer.validateRecord('sch-1', {})
    const stats = standardizer.getValidationStats('sch-1')
    expect(stats.total).toBe(2)
    expect(stats.passed).toBe(1)
    expect(stats.failed).toBe(1)
  })

  it('C등급 데이터 전송 차단', () => {
    standardizer.registerSchema('sch-1', '민원스키마', [])
    expect(() => standardizer.validateRecord('sch-1', {}, 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    standardizer.registerSchema('sch-1', '민원스키마', [])
    expect(() => standardizer.validateRecord('sch-1', {}, 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    standardizer.registerSchema('sch-1', '민원스키마', [])
    standardizer.validateRecord('sch-1', {})
    const log = standardizer.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
