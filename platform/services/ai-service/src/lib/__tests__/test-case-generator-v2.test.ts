// Plan SC: SVC-AI-ADV-R405
import { describe, it, expect, beforeEach } from 'vitest'
import { TestCaseGeneratorV2 } from '../test-case-generator-v2'

describe('TestCaseGeneratorV2', () => {
  let generator: TestCaseGeneratorV2

  beforeEach(() => {
    generator = new TestCaseGeneratorV2()
  })

  it('registerFeature — 감사 로그에 feature.register 기록', () => {
    generator.registerFeature('feat-1', '로그인', 'high')
    const log = generator.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('feature.register')
  })

  it('getCoverageRate — 3가지 유형 모두 있을 때 100%', () => {
    generator.registerFeature('feat-1', '로그인', 'high')
    generator.addTestCase('feat-1', 'tc-1', 'positive', '정상 로그인')
    generator.addTestCase('feat-1', 'tc-2', 'negative', '잘못된 비밀번호')
    generator.addTestCase('feat-1', 'tc-3', 'edge', '빈 입력')
    expect(generator.getCoverageRate('feat-1')).toBe(100)
  })

  it('getCoverageRate — 1가지 유형만 있을 때 33.33%', () => {
    generator.registerFeature('feat-1', '로그인', 'high')
    generator.addTestCase('feat-1', 'tc-1', 'positive', '정상 로그인')
    expect(generator.getCoverageRate('feat-1')).toBeCloseTo(33.33, 1)
  })

  it('getUncoveredFeatures — 테스트 없는 기능 반환', () => {
    generator.registerFeature('feat-1', '로그인', 'high')
    generator.registerFeature('feat-2', '회원가입', 'medium')
    generator.addTestCase('feat-1', 'tc-1', 'positive', '정상 로그인')
    const uncovered = generator.getUncoveredFeatures()
    expect(uncovered).toHaveLength(1)
    expect(uncovered[0]!.id).toBe('feat-2')
  })

  it('getCoverageRate — 중복 유형 추가 시 커버리지 변화 없음', () => {
    generator.registerFeature('feat-1', '로그인', 'high')
    generator.addTestCase('feat-1', 'tc-1', 'positive', '정상 1')
    generator.addTestCase('feat-1', 'tc-2', 'positive', '정상 2')
    // positive만 있으므로 1/3
    expect(generator.getCoverageRate('feat-1')).toBeCloseTo(33.33, 1)
  })

  it('addTestCase — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    generator.registerFeature('feat-1', '로그인', 'high')
    expect(() => generator.addTestCase('feat-1', 'tc-1', 'positive', '테스트', 'C')).toThrow('BLOCKED')
  })

  it('addTestCase — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    generator.registerFeature('feat-1', '로그인', 'high')
    expect(() => generator.addTestCase('feat-1', 'tc-1', 'positive', '테스트', 'S')).toThrow('N2SF N-05')
  })

  it('getCoverageRate — 케이스 없을 때 0%', () => {
    generator.registerFeature('feat-1', '로그인', 'high')
    expect(generator.getCoverageRate('feat-1')).toBe(0)
  })
})
