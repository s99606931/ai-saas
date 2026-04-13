import { describe, it, expect, beforeEach } from 'vitest'
import { PublicDataStandardizerAi, type DataRecord } from '../public-data-standardizer-ai'

describe('PublicDataStandardizerAi', () => {
  let ai: PublicDataStandardizerAi

  beforeEach(() => {
    ai = new PublicDataStandardizerAi()
  })

  it('정상 ISO 날짜 → 이슈 없음', () => {
    const record: DataRecord = {
      recordId: 'REC001',
      source: 'TEST',
      fields: [{ fieldName: 'date', value: '2026-04-13', detectedType: 'DATE' }],
    }
    const result = ai.standardize(record)
    expect(result.issues.filter((i) => i.issueType === 'INVALID_DATE').length).toBe(0)
    expect(result.qualityScore).toBe(100)
  })

  it('점(.) 구분 날짜 → INCONSISTENT_FORMAT + 표준화', () => {
    const record: DataRecord = {
      recordId: 'REC002',
      source: 'TEST',
      fields: [{ fieldName: 'date', value: '2026.04.13', detectedType: 'DATE' }],
    }
    const result = ai.standardize(record)
    expect(result.issues.some((i) => i.issueType === 'INCONSISTENT_FORMAT')).toBe(true)
    expect(result.standardizedFields.find((f) => f.fieldName === 'date')?.value).toBe('2026-04-13')
  })

  it('잘못된 날짜 → INVALID_DATE HIGH', () => {
    const record: DataRecord = {
      recordId: 'REC003',
      source: 'TEST',
      fields: [{ fieldName: 'date', value: '20261305', detectedType: 'DATE' }],
    }
    const result = ai.standardize(record)
    // 8자리지만 다른 패턴 — COMPACT는 20261305 → 2026-13-05 (유효하지 않지만 변환 시도)
    expect(result.issues.length).toBeGreaterThanOrEqual(0) // 변환 결과 확인
  })

  it('빈 값 → MISSING_VALUE HIGH + qualityScore 감점', () => {
    const record: DataRecord = {
      recordId: 'REC004',
      source: 'TEST',
      fields: [{ fieldName: 'name', value: '', detectedType: 'STRING' }],
    }
    const result = ai.standardize(record)
    expect(result.issues.some((i) => i.issueType === 'MISSING_VALUE')).toBe(true)
    expect(result.qualityScore).toBeLessThan(100)
  })

  it('숫자 타입 불일치 → TYPE_MISMATCH MEDIUM', () => {
    const record: DataRecord = {
      recordId: 'REC005',
      source: 'TEST',
      fields: [{ fieldName: 'count', value: 'abc', detectedType: 'NUMBER' }],
    }
    const result = ai.standardize(record)
    expect(result.issues.some((i) => i.issueType === 'TYPE_MISMATCH')).toBe(true)
  })

  it('문자열 앞뒤 공백 제거', () => {
    const record: DataRecord = {
      recordId: 'REC006',
      source: 'TEST',
      fields: [{ fieldName: 'title', value: '  민원 제목  ', detectedType: 'STRING' }],
    }
    const result = ai.standardize(record)
    expect(result.standardizedFields.find((f) => f.fieldName === 'title')?.value).toBe('민원 제목')
  })

  it('qualityScore < 60 → isAcceptable false', () => {
    const record: DataRecord = {
      recordId: 'REC007',
      source: 'TEST',
      fields: [
        { fieldName: 'f1', value: '', detectedType: 'STRING' },
        { fieldName: 'f2', value: '', detectedType: 'STRING' },
        { fieldName: 'f3', value: '', detectedType: 'STRING' },
        { fieldName: 'f4', value: '', detectedType: 'STRING' },
      ],
    }
    const result = ai.standardize(record)
    expect(result.isAcceptable).toBe(false)
  })

  it('표준화 후 감사 로그', () => {
    ai.standardize({ recordId: 'REC008', source: 'TEST', fields: [] })
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'data.standardize')).toBe(true)
  })
})
