// Plan SC: SVC-AI-ADV-R442
import { describe, it, expect, beforeEach } from 'vitest'
import { CodeArchitectureValidatorAI } from '../code-architecture-validator-ai'

describe('CodeArchitectureValidatorAI', () => {
  let validator: CodeArchitectureValidatorAI

  beforeEach(() => {
    validator = new CodeArchitectureValidatorAI()
  })

  it('registerComponent — 감사 로그에 component.register 기록', () => {
    validator.registerComponent('comp-1', 'UserService', 'service')
    expect(validator.getAuditLog()[0]!.action).toBe('component.register')
  })

  it('getViolationScore — 위반 없을 때 0', () => {
    validator.registerComponent('comp-1', 'UserService', 'service')
    expect(validator.getViolationScore('comp-1')).toBe(0)
  })

  it('recordViolation — circular 위반 시 점수 +30', () => {
    validator.registerComponent('comp-1', 'UserService', 'service')
    validator.recordViolation('comp-1', 'circular')
    expect(validator.getViolationScore('comp-1')).toBe(30)
  })

  it('recordViolation — 복합 위반 누적 계산', () => {
    validator.registerComponent('comp-1', 'UserService', 'service')
    validator.recordViolation('comp-1', 'layerSkip')   // 20
    validator.recordViolation('comp-1', 'god-class')   // 15
    expect(validator.getViolationScore('comp-1')).toBe(35)
  })

  it('getHighRiskComponents — threshold 이상 컴포넌트 반환', () => {
    validator.registerComponent('comp-1', 'UserService', 'service')
    validator.registerComponent('comp-2', 'OrderService', 'service')
    validator.recordViolation('comp-1', 'circular') // 30
    validator.recordViolation('comp-2', 'god-class') // 15
    const high = validator.getHighRiskComponents(25)
    expect(high).toHaveLength(1)
    expect(high[0]!.componentId).toBe('comp-1')
  })

  it('recordViolation — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    validator.registerComponent('comp-1', 'Test', 'service')
    expect(() => validator.recordViolation('comp-1', 'circular', 'C')).toThrow('BLOCKED')
  })

  it('recordViolation — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    validator.registerComponent('comp-1', 'Test', 'service')
    expect(() => validator.recordViolation('comp-1', 'circular', 'S')).toThrow('N2SF N-05')
  })

  it('getViolationScore — 없는 componentId 에러', () => {
    expect(() => validator.getViolationScore('nonexistent')).toThrow('componentId 없음')
  })
})
