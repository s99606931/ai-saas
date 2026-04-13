// Plan SC: SVC-AI-ADV-R383
import { describe, it, expect, beforeEach } from 'vitest'
import { CloudNativeMigrationAdvisor } from '../cloud-native-migration-advisor'

describe('CloudNativeMigrationAdvisor', () => {
  let advisor: CloudNativeMigrationAdvisor

  beforeEach(() => {
    advisor = new CloudNativeMigrationAdvisor()
  })

  it('registerApplication — 감사 로그에 app.register 기록', () => {
    advisor.registerApplication('app-1', '민원시스템', 'java', 3)
    const log = advisor.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('app.register')
  })

  it('getComplexityScore — cobol+의존성 → 높은 복잡도', () => {
    advisor.registerApplication('app-1', '레거시', 'cobol', 5)
    // complexityScore = min(100, 5*10 + 40) = min(100, 90) = 90
    const result = advisor.getComplexityScore('app-1')
    expect(result.complexityScore).toBe(90)
    expect(result.strategy).toBe('refactor') // >= 70
  })

  it('getMigrationStrategy — 복잡도 낮을 때 lift-and-shift', () => {
    advisor.registerApplication('app-1', '간단앱', 'nodejs', 1)
    // complexityScore = 1*10 + 10 = 20 → lift-and-shift
    expect(advisor.getMigrationStrategy('app-1')).toBe('lift-and-shift')
  })

  it('getMigrationStrategy — 중간 복잡도 replatform', () => {
    advisor.registerApplication('app-1', '중간앱', 'java', 3)
    // complexityScore = 3*10 + 20 = 50 → replatform (>=40)
    expect(advisor.getMigrationStrategy('app-1')).toBe('replatform')
  })

  it('getTopComplexApps — 복잡도 내림차순', () => {
    advisor.registerApplication('app-1', '간단앱', 'nodejs', 0) // 10
    advisor.registerApplication('app-2', '복잡앱', 'cobol', 5)  // 90
    advisor.registerApplication('app-3', '중간앱', 'java', 2)   // 40
    const top = advisor.getTopComplexApps(2)
    expect(top[0]!.appId).toBe('app-2')
    expect(top[1]!.appId).toBe('app-3')
  })

  it('getComplexityScore — 없는 appId 에러', () => {
    expect(() => advisor.getComplexityScore('nonexistent')).toThrow('appId 없음')
  })

  it('getComplexityScore — complexityScore 최대 100 (cap)', () => {
    advisor.registerApplication('app-1', '극도복잡', 'cobol', 10)
    // 10*10 + 40 = 140 → min(100, 140) = 100
    const result = advisor.getComplexityScore('app-1')
    expect(result.complexityScore).toBe(100)
  })

  it('registerApplication — 필수 파라미터 누락 시 에러', () => {
    expect(() => advisor.registerApplication('', '앱', 'java', 0)).toThrow('필수')
  })
})
