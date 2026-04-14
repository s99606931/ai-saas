// Plan SC: SVC-AI-ADV-R484-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { CodeSecurityPolicyEnforcerV2, type CodeSnippet } from '../code-security-policy-enforcer-v2'

describe('CodeSecurityPolicyEnforcerV2', () => {
  let enforcer: CodeSecurityPolicyEnforcerV2

  const cleanSnippet: CodeSnippet = {
    snippetId: 'SNIP-1',
    filePath: 'src/service.ts',
    language: 'typescript',
    content: 'const result = await fetchData(endpoint)\nreturn result',
  }

  beforeEach(() => {
    enforcer = new CodeSecurityPolicyEnforcerV2()
  })

  it('미등록 스니펫 강제 적용 시 오류 발생', () => {
    expect(() => enforcer.enforce('UNKNOWN')).toThrow('Unknown snippet')
  })

  it('클린 코드 → passed=true, CRITICAL 위반 없음', () => {
    enforcer.registerSnippet(cleanSnippet)
    const report = enforcer.enforce('SNIP-1')
    expect(report.passed).toBe(true)
    expect(report.violations.filter((v) => v.severity === 'CRITICAL')).toHaveLength(0)
  })

  it('하드코딩 시크릿 → CRITICAL SECRETS 위반', () => {
    enforcer.registerSnippet({
      ...cleanSnippet,
      snippetId: 'SNIP-SECRET',
      content: 'const apikey = "sk-abcdefghijklmnop"',
    })
    const report = enforcer.enforce('SNIP-SECRET')
    expect(report.violations.some((v) => v.category === 'SECRETS' && v.severity === 'CRITICAL')).toBe(true)
    expect(report.passed).toBe(false)
  })

  it('eval() 사용 → CRITICAL INJECTION 위반', () => {
    enforcer.registerSnippet({
      ...cleanSnippet,
      snippetId: 'SNIP-EVAL',
      content: 'const result = eval(userInput)',
    })
    const report = enforcer.enforce('SNIP-EVAL')
    expect(report.violations.some((v) => v.category === 'INJECTION' && v.severity === 'CRITICAL')).toBe(true)
  })

  it('MD5 사용 → HIGH CRYPTO 위반', () => {
    enforcer.registerSnippet({
      ...cleanSnippet,
      snippetId: 'SNIP-MD5',
      content: 'const hash = createHash("md5").update(data).digest("hex")',
    })
    const report = enforcer.enforce('SNIP-MD5')
    expect(report.violations.some((v) => v.category === 'CRYPTO' && v.severity === 'HIGH')).toBe(true)
  })

  it('HTTP 평문 URL → MEDIUM CRYPTO 위반', () => {
    enforcer.registerSnippet({
      ...cleanSnippet,
      snippetId: 'SNIP-HTTP',
      content: 'const url = "http://api.example.com/data"',
    })
    const report = enforcer.enforce('SNIP-HTTP')
    expect(report.violations.some((v) => v.category === 'CRYPTO' && v.severity === 'MEDIUM')).toBe(true)
  })

  it('score: CRITICAL 위반 하나마다 20점 감점', () => {
    enforcer.registerSnippet({
      ...cleanSnippet,
      snippetId: 'SNIP-SCORE',
      content: 'const apikey = "sk-secret"\nconst result = eval(x)',
    })
    const report = enforcer.enforce('SNIP-SCORE')
    expect(report.score).toBeLessThanOrEqual(60)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    enforcer.registerSnippet(cleanSnippet)
    enforcer.enforce('SNIP-1')
    const log1 = enforcer.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', snippetId: 'X', detail: {} })
    const log2 = enforcer.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
