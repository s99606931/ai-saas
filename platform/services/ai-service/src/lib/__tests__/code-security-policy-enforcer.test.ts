import { describe, it, expect, beforeEach } from 'vitest'
import { CodeSecurityPolicyEnforcer } from '../code-security-policy-enforcer'

describe('CodeSecurityPolicyEnforcer', () => {
  let ai: CodeSecurityPolicyEnforcer

  beforeEach(() => {
    ai = new CodeSecurityPolicyEnforcer()
    ai.registerPolicy('p1', 'SQL 주입 방지', 'sql-injection', 'critical')
    ai.registerPolicy('p2', 'XSS 방지', 'xss', 'high')
  })

  it('정책 등록 감사 로그', () => {
    expect(ai.getAuditLog().some((e) => e.action === 'policy.register')).toBe(true)
  })

  it('위반 없을 때 점수 100', () => {
    const result = ai.scanCode('scan1', 'api.ts', [])
    expect(result.securityScore).toBe(100)
  })

  it('critical 위반 — 점수 30 차감', () => {
    const result = ai.scanCode('scan1', 'api.ts', [{ ruleType: 'sql-injection', line: 10 }])
    expect(result.securityScore).toBe(70)
  })

  it('high 위반 — 점수 15 차감', () => {
    const result = ai.scanCode('scan1', 'api.ts', [{ ruleType: 'xss', line: 20 }])
    expect(result.securityScore).toBe(85)
  })

  it('복수 위반 — 점수 누적 차감', () => {
    const result = ai.scanCode('scan1', 'api.ts', [
      { ruleType: 'sql-injection', line: 10 },
      { ruleType: 'xss', line: 20 },
    ])
    expect(result.securityScore).toBe(55)
  })

  it('정책별 위반 조회', () => {
    ai.scanCode('scan1', 'api.ts', [{ ruleType: 'sql-injection', line: 10 }])
    const violations = ai.getViolationsByPolicy('p1')
    expect(violations.length).toBe(1)
    expect(violations[0]!.severity).toBe('critical')
  })

  it('점수 0 미만 방지', () => {
    const violations = []
    for (let i = 0; i < 10; i++) violations.push({ ruleType: 'sql-injection', line: i })
    const result = ai.scanCode('scan1', 'api.ts', violations)
    expect(result.securityScore).toBe(0)
  })

  it('C등급 데이터 차단', () => {
    expect(() => ai.scanCode('scan1', 'api.ts', [], 'C')).toThrow('BLOCKED')
  })
})
