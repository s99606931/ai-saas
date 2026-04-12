import { describe, it, expect, beforeEach } from 'vitest'
import { PublicDataLinkageAutomatorV2 } from '../public-data-linkage-automator-v2'

describe('PublicDataLinkageAutomatorV2', () => {
  let ai: PublicDataLinkageAutomatorV2

  beforeEach(() => {
    ai = new PublicDataLinkageAutomatorV2()
    ai.registerSource('src-1', '행안부 인구DB', ['name', 'age', 'address'])
    ai.registerSource('src-2', '복지 시스템', ['fullName', 'birthYear', 'region'])
    ai.registerMappingRule(
      'rule-1',
      'src-1',
      'src-2',
      [
        { sourceField: 'name', targetField: 'fullName' },
        { sourceField: 'address', targetField: 'region' },
      ],
      { requiredFields: ['fullName', 'region'] }
    )
  })

  it('소스 등록 감사 로그', () => {
    expect(ai.getAuditLog().some((e) => e.action === 'source.register')).toBe(true)
  })

  it('필드 매핑 실행 — sourceField → targetField', () => {
    const result = ai.execute('rule-1', { name: '홍길동', age: 30, address: '서울' })
    expect(result.targetRecord['fullName']).toBe('홍길동')
    expect(result.targetRecord['region']).toBe('서울')
    expect(result.mappedFields).toBe(2)
  })

  it('미매핑 소스 필드는 결과에 포함되지 않음', () => {
    const result = ai.execute('rule-1', { name: '홍길동', age: 30, address: '서울' })
    expect(result.targetRecord['age']).toBeUndefined()
  })

  it('필수 필드 검증 통과', () => {
    const result = ai.execute('rule-1', { name: '홍길동', address: '서울' })
    const validation = ai.validate('rule-1', result)
    expect(validation.valid).toBe(true)
    expect(validation.missingFields.length).toBe(0)
  })

  it('필수 필드 누락 시 검증 실패', () => {
    const result = ai.execute('rule-1', { name: '홍길동' })
    const validation = ai.validate('rule-1', result)
    expect(validation.valid).toBe(false)
    expect(validation.missingFields).toContain('region')
  })

  it('C등급 데이터 차단', () => {
    expect(() => ai.execute('rule-1', { name: '홍길동' }, 'C')).toThrow('BLOCKED')
  })

  it('미등록 규칙 에러', () => {
    expect(() => ai.execute('unknown-rule', { name: '홍길동' })).toThrow()
  })
})
