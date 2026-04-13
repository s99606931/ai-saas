import { describe, it, expect, beforeEach } from 'vitest'
import { CodeTestAutoGeneratorV2, type FunctionSignature } from '../code-test-auto-generator-v2'

describe('CodeTestAutoGeneratorV2', () => {
  let generator: CodeTestAutoGeneratorV2

  const fn: FunctionSignature = {
    functionId: 'FN001',
    name: 'createComplaint',
    params: [
      { name: 'title', type: 'string', required: true },
      { name: 'count', type: 'number', required: false },
    ],
    returnType: 'Complaint',
    throwsOn: ['empty title'],
    isAsync: false,
  }

  beforeEach(() => {
    generator = new CodeTestAutoGeneratorV2()
    generator.registerFunction(fn)
  })

  it('함수 등록 감사 로그', () => {
    const log = generator.getAuditLog()
    expect(log.some((e) => e.action === 'function.register')).toBe(true)
  })

  it('HAPPY_PATH 테스트 생성', () => {
    const suite = generator.generate('FN001')
    expect(suite.tests.some((t) => t.testType === 'HAPPY_PATH')).toBe(true)
  })

  it('필수 파라미터 → ERROR_CASE 테스트 생성', () => {
    const suite = generator.generate('FN001')
    expect(suite.tests.some((t) => t.testType === 'ERROR_CASE')).toBe(true)
  })

  it('number 파라미터 → BOUNDARY 테스트 생성', () => {
    const suite = generator.generate('FN001')
    expect(suite.tests.some((t) => t.testType === 'BOUNDARY')).toBe(true)
  })

  it('throwsOn 조건 → 추가 ERROR_CASE 생성', () => {
    const suite = generator.generate('FN001')
    const errorCases = suite.tests.filter((t) => t.testType === 'ERROR_CASE')
    expect(errorCases.length).toBeGreaterThanOrEqual(2)
  })

  it('async 함수 → async 테스트 추가', () => {
    generator.registerFunction({ ...fn, functionId: 'FN002', isAsync: true })
    const suite = generator.generate('FN002')
    expect(suite.tests.some((t) => t.pseudoCode.includes('resolves'))).toBe(true)
  })

  it('coverageEstimate 계산', () => {
    const suite = generator.generate('FN001')
    expect(suite.coverageEstimate).toBeGreaterThan(60)
    expect(suite.coverageEstimate).toBeLessThanOrEqual(95)
  })

  it('미등록 함수 에러', () => {
    expect(() => generator.generate('UNKNOWN')).toThrow()
  })

  it('생성 후 감사 로그', () => {
    generator.generate('FN001')
    const log = generator.getAuditLog()
    expect(log.some((e) => e.action === 'test.generate')).toBe(true)
  })
})
