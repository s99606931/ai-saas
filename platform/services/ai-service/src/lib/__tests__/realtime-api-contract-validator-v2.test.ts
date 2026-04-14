import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimeApiContractValidatorV2 } from '../realtime-api-contract-validator-v2'

describe('RealtimeApiContractValidatorV2', () => {
  let validator: RealtimeApiContractValidatorV2
  beforeEach(() => { validator = new RealtimeApiContractValidatorV2() })

  it('계약 등록 후 조회 가능', () => {
    const contract = validator.registerContract('c-1', '/api/users', [{ name: 'id', type: 'number' }])
    expect(contract.contractId).toBe('c-1')
    expect(contract.expectedFields).toHaveLength(1)
  })

  it('유효한 응답: 검증 통과', () => {
    validator.registerContract('c-1', '/api/users', [{ name: 'id', type: 'number' }, { name: 'name', type: 'string' }])
    const result = validator.validateResponse('c-1', { id: 1, name: '홍길동' })
    expect(result.valid).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('필드 누락: 검증 실패', () => {
    validator.registerContract('c-1', '/api/users', [{ name: 'id', type: 'number' }])
    const result = validator.validateResponse('c-1', {})
    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('id'))).toBe(true)
  })

  it('타입 불일치: 검증 실패', () => {
    validator.registerContract('c-1', '/api/users', [{ name: 'id', type: 'number' }])
    const result = validator.validateResponse('c-1', { id: 'abc' })
    expect(result.valid).toBe(false)
  })

  it('getViolationStats: 통계 집계', () => {
    validator.registerContract('c-1', '/api/users', [{ name: 'id', type: 'number' }])
    validator.validateResponse('c-1', { id: 1 })
    validator.validateResponse('c-1', {})
    const stats = validator.getViolationStats('c-1')
    expect(stats.total).toBe(2)
    expect(stats.violations).toBe(1)
  })

  it('C등급 데이터 전송 차단', () => {
    validator.registerContract('c-1', '/api/users', [])
    expect(() => validator.validateResponse('c-1', {}, 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    validator.registerContract('c-1', '/api/users', [])
    expect(() => validator.validateResponse('c-1', {}, 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    validator.registerContract('c-1', '/api/users', [])
    validator.validateResponse('c-1', {})
    expect(validator.getAuditLog().length).toBeGreaterThanOrEqual(2)
  })
})
