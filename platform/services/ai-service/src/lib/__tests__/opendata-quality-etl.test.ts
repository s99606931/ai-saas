import { describe, it, expect, beforeEach } from 'vitest'
import { OpenDataQualityEtl } from '../opendata-quality-etl'

describe('OpenDataQualityEtl', () => {
  let etl: OpenDataQualityEtl

  beforeEach(() => {
    etl = new OpenDataQualityEtl()
    etl.defineSchema(
      {
        schemaName: 'park-info',
        fields: [
          { name: 'id', type: 'string', required: true },
          { name: 'name', type: 'string', required: true },
          { name: 'area', type: 'number', required: true },
          { name: 'openedAt', type: 'date', required: false },
          { name: 'code', type: 'string', required: false, pattern: '^[A-Z]{2}\\d{3}$' },
        ],
      },
      'admin-1'
    )
  })

  it('빈 schemaName 차단', () => {
    expect(() => etl.defineSchema({ schemaName: '', fields: [] }, 'a')).toThrow('schemaName')
  })

  it('빈 fields 차단', () => {
    expect(() => etl.defineSchema({ schemaName: 'x', fields: [] }, 'a')).toThrow('fields')
  })

  it('중복 schemaName 차단', () => {
    expect(() =>
      etl.defineSchema(
        {
          schemaName: 'park-info',
          fields: [{ name: 'a', type: 'string', required: true }],
        },
        'a'
      )
    ).toThrow('중복 schemaName')
  })

  it('중복 필드명 차단', () => {
    expect(() =>
      etl.defineSchema(
        {
          schemaName: 'x',
          fields: [
            { name: 'a', type: 'string', required: true },
            { name: 'a', type: 'number', required: false },
          ],
        },
        'a'
      )
    ).toThrow('중복 필드명')
  })

  it('C등급 검증 차단', () => {
    expect(() => etl.validateRecord('park-info', {}, 'C')).toThrow('BLOCKED')
  })

  it('없는 schema 오류', () => {
    expect(() => etl.validateRecord('none', {}, 'O')).toThrow('schemaName 없음')
  })

  it('유효 레코드', () => {
    const r = etl.validateRecord(
      'park-info',
      { id: 'p1', name: '서울숲', area: 120000, code: 'AB123' },
      'O'
    )
    expect(r.valid).toBe(true)
    expect(r.errors).toHaveLength(0)
  })

  it('필수 필드 누락', () => {
    const r = etl.validateRecord('park-info', { id: 'p1' }, 'O')
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.includes('name'))).toBe(true)
    expect(r.errors.some((e) => e.includes('area'))).toBe(true)
  })

  it('타입 불일치', () => {
    const r = etl.validateRecord(
      'park-info',
      { id: 'p1', name: '공원', area: 'not-number' },
      'O'
    )
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.includes('area'))).toBe(true)
  })

  it('패턴 불일치', () => {
    const r = etl.validateRecord(
      'park-info',
      { id: 'p1', name: '공원', area: 100, code: 'bad' },
      'O'
    )
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.includes('code'))).toBe(true)
  })

  it('runQualityCheck — 전부 유효', () => {
    const records = [
      { id: 'p1', name: '공원1', area: 100 },
      { id: 'p2', name: '공원2', area: 200 },
    ]
    const q = etl.runQualityCheck('park-info', records, 'O', 'admin')
    expect(q.validRecords).toBe(2)
    expect(q.completenessPct).toBe(100)
    expect(q.overallScore).toBeGreaterThanOrEqual(90)
  })

  it('runQualityCheck — 일부 누락', () => {
    const records = [
      { id: 'p1', name: '공원1', area: 100 },
      { id: 'p2' }, // 누락 많음
    ]
    const q = etl.runQualityCheck('park-info', records, 'O', 'admin')
    expect(q.validRecords).toBe(1)
    expect(q.completenessPct).toBeLessThan(100)
    expect(q.errorSummary.length).toBeGreaterThan(0)
  })

  it('runQualityCheck — 빈 records 차단', () => {
    expect(() => etl.runQualityCheck('park-info', [], 'O', 'a')).toThrow('records')
  })

  it('runQualityCheck — C등급 차단', () => {
    expect(() => etl.runQualityCheck('park-info', [{}], 'C', 'a')).toThrow('BLOCKED')
  })

  it('listSchemas', () => {
    expect(etl.listSchemas()).toContain('park-info')
  })

  it('감사 로그 — caller 마스킹', () => {
    etl.runQualityCheck('park-info', [{ id: 'p', name: 'n', area: 1 }], 'O', 'caller-full')
    const log = etl.getAuditLog()
    const check = log.find((e) => e.action === 'quality.check')
    expect(check?.callerMasked).toContain('***')
  })
})
