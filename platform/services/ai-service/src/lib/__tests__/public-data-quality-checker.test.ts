import { describe, it, expect, beforeEach } from 'vitest'
import { PublicDataQualityChecker } from '../public-data-quality-checker'
import type { DatasetSchema } from '../public-data-quality-checker'

const SCHEMA: DatasetSchema = {
  schemaId: 'SCH-1',
  name: '주민 현황',
  fields: [
    { name: 'name', type: 'string', required: true },
    { name: 'age', type: 'number', required: true },
    { name: 'registeredAt', type: 'date', required: false },
    { name: 'code', type: 'string', required: false, pattern: '^[A-Z]{2}\\d{3}$' },
  ],
}

describe('PublicDataQualityChecker', () => {
  let checker: PublicDataQualityChecker

  beforeEach(() => {
    checker = new PublicDataQualityChecker()
    checker.registerSchema(SCHEMA)
  })

  it('알 수 없는 스키마 검증 시 오류', () => {
    expect(() => checker.validate('UNKNOWN', [])).toThrow('Unknown schema')
  })

  it('빈 데이터셋 검증 — 점수 0', () => {
    const report = checker.validate('SCH-1', [])
    expect(report.totalRows).toBe(0)
    expect(report.completenessScore).toBe(0)
  })

  it('완전한 데이터 — completeness 1.0', () => {
    const rows = [{ name: '홍길동', age: 30 }, { name: '이순신', age: 45 }]
    const report = checker.validate('SCH-1', rows)
    expect(report.completenessScore).toBe(1)
    expect(report.errors.filter((e) => e.reason === '필수 필드 누락').length).toBe(0)
  })

  it('필수 필드 누락 — completeness 감소', () => {
    const rows = [{ name: '홍길동' }, { name: '이순신', age: 45 }]  // 첫 행 age 누락
    const report = checker.validate('SCH-1', rows)
    expect(report.completenessScore).toBe(0.5)
  })

  it('타입 오류 탐지', () => {
    const rows = [{ name: '홍길동', age: 'not-a-number' }]
    const report = checker.validate('SCH-1', rows)
    expect(report.errors.some((e) => e.field === 'age' && e.reason.includes('타입'))).toBe(true)
  })

  it('패턴 오류 탐지', () => {
    const rows = [{ name: '홍길동', age: 30, code: 'invalid' }]
    const report = checker.validate('SCH-1', rows)
    expect(report.errors.some((e) => e.field === 'code' && e.reason.includes('패턴'))).toBe(true)
  })

  it('감사 로그 복사본 반환', () => {
    checker.validate('SCH-1', [{ name: '홍길동', age: 30 }])
    const log = checker.getAuditLog()
    log.push({ timestamp: '', action: 'injected', schemaId: 'X', detail: {} })
    expect(checker.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
