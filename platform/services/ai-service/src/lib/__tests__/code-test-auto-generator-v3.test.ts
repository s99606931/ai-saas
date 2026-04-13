import { describe, it, expect, beforeEach } from 'vitest'
import { CodeTestAutoGeneratorV3 } from '../code-test-auto-generator-v3'

describe('CodeTestAutoGeneratorV3', () => {
  let generator: CodeTestAutoGeneratorV3

  beforeEach(() => {
    generator = new CodeTestAutoGeneratorV3()
  })

  it('함수 등록 후 조회 가능', () => {
    const fn = generator.registerFunction('fn-1', 'calculateTax', 'medium')
    expect(fn.funcId).toBe('fn-1')
    expect(fn.name).toBe('calculateTax')
  })

  it('커버리지 0: 테스트 케이스 없음', () => {
    generator.registerFunction('fn-1', 'calculateTax', 'medium')
    expect(generator.getCoverageRate('fn-1')).toBe(0)
  })

  it('커버리지 33: happy 케이스만', () => {
    generator.registerFunction('fn-1', 'calculateTax', 'medium')
    generator.addTestCase('fn-1', 'happy')
    expect(generator.getCoverageRate('fn-1')).toBeCloseTo(33.33, 1)
  })

  it('커버리지 100: 3가지 케이스 모두', () => {
    generator.registerFunction('fn-1', 'calculateTax', 'medium')
    generator.addTestCase('fn-1', 'happy')
    generator.addTestCase('fn-1', 'edge')
    generator.addTestCase('fn-1', 'error')
    expect(generator.getCoverageRate('fn-1')).toBe(100)
  })

  it('중복 케이스는 고유값으로만 계산', () => {
    generator.registerFunction('fn-1', 'calculateTax', 'medium')
    generator.addTestCase('fn-1', 'happy')
    generator.addTestCase('fn-1', 'happy')
    expect(generator.getCoverageRate('fn-1')).toBeCloseTo(33.33, 1)
  })

  it('getUncoveredFunctions: 100% 미만 함수만', () => {
    generator.registerFunction('fn-1', 'calculateTax', 'medium')
    generator.registerFunction('fn-2', 'validateInput', 'low')
    generator.addTestCase('fn-2', 'happy')
    generator.addTestCase('fn-2', 'edge')
    generator.addTestCase('fn-2', 'error')
    const uncovered = generator.getUncoveredFunctions()
    expect(uncovered.map((f) => f.funcId)).toContain('fn-1')
    expect(uncovered.map((f) => f.funcId)).not.toContain('fn-2')
  })

  it('C등급 데이터 전송 차단', () => {
    generator.registerFunction('fn-1', 'calculateTax', 'medium')
    expect(() => generator.addTestCase('fn-1', 'happy', 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    generator.registerFunction('fn-1', 'calculateTax', 'medium')
    expect(() => generator.addTestCase('fn-1', 'happy', 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    generator.registerFunction('fn-1', 'calculateTax', 'medium')
    generator.addTestCase('fn-1', 'happy')
    const log = generator.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
