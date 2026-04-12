import { describe, it, expect, beforeEach } from 'vitest'
import { TestDataGeneratorAi, type SchemaSpec } from '../test-data-generator-ai'

describe('TestDataGeneratorAi', () => {
  let gen: TestDataGeneratorAi

  const schema: SchemaSpec = {
    schemaId: 'sch1',
    name: '공공 민원 스키마',
    fields: [
      { name: 'id', type: 'uuid' },
      { name: 'title', type: 'string', minLength: 4 },
      { name: 'age', type: 'number', min: 1, max: 100 },
      { name: 'active', type: 'boolean' },
      { name: 'email', type: 'email' },
      { name: 'phone', type: 'phone' },
      { name: 'createdAt', type: 'date' },
    ],
    grade: 'O',
  }

  beforeEach(() => {
    gen = new TestDataGeneratorAi()
    gen.registerSchema(schema)
  })

  it('C등급 스키마 등록 차단', () => {
    expect(() => gen.registerSchema({ ...schema, schemaId: 'blocked', grade: 'C' })).toThrow('BLOCKED')
  })

  it('S등급 스키마 등록 차단', () => {
    expect(() => gen.registerSchema({ ...schema, schemaId: 'blocked', grade: 'S' })).toThrow('BLOCKED')
  })

  it('스키마 등록 감사 로그', () => {
    const log = gen.getAuditLog()
    expect(log.some((e) => e.action === 'schema.register')).toBe(true)
  })

  it('레코드 개수 일치', () => {
    const result = gen.generate('sch1', 5)
    expect(result.count).toBe(5)
    expect(result.records.length).toBe(5)
  })

  it('UUID 필드 생성', () => {
    const result = gen.generate('sch1', 2)
    expect(result.records[0]!['id']).toMatch(/^00000000-/)
  })

  it('이메일 필드 생성', () => {
    const result = gen.generate('sch1', 2)
    expect(String(result.records[0]!['email'])).toContain('@example.com')
  })

  it('count=0 에러', () => {
    expect(() => gen.generate('sch1', 0)).toThrow()
  })

  it('미등록 스키마 에러', () => {
    expect(() => gen.generate('unknown', 1)).toThrow()
  })

  it('데이터 생성 감사 로그', () => {
    gen.generate('sch1', 3)
    const log = gen.getAuditLog()
    expect(log.some((e) => e.action === 'data.generate')).toBe(true)
  })
})
