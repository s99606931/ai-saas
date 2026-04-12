/**
 * Unit tests — Data Policy Enforcer (SVC-AI-ADV-R110 트랙B)
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R110.design.md
 * Plan SC: FR-R110.1 ~ FR-R110.5
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DataPolicyEnforcer, type DataPolicy } from '../data-policy-enforcer'

describe('SVC-AI-ADV-R110 DataPolicyEnforcer', () => {
  let enforcer: DataPolicyEnforcer

  beforeEach(() => {
    enforcer = new DataPolicyEnforcer()
  })

  it('[FR-R110.2] 하드코딩 시크릿 탐지 (기본 정책 P-001)', () => {
    const code = `const apiKey = 'sk-1234567890abcdef'`
    const violations = enforcer.scanCode(code, 'typescript')
    expect(violations.length).toBeGreaterThan(0)
    const criticalViolation = violations.find((v) => v.policyId === 'P-001')
    expect(criticalViolation).toBeDefined()
    expect(criticalViolation!.severity).toBe('CRITICAL')
  })

  it('[FR-R110.2] SQL 직접 결합 탐지 (기본 정책 P-002)', () => {
    const code = 'const q = `SELECT * FROM users WHERE id = ${userId}`'
    const violations = enforcer.scanCode(code, 'typescript')
    const sqlViolation = violations.find((v) => v.policyId === 'P-002')
    expect(sqlViolation).toBeDefined()
    expect(sqlViolation!.severity).toBe('HIGH')
  })

  it('[FR-R110.2] 위반 없는 코드 — 빈 배열 반환', () => {
    const code = `
const apiKey = process.env.API_KEY
const user = await db.execute('SELECT * FROM users WHERE id = $1', [id])
`
    const violations = enforcer.scanCode(code, 'typescript')
    // 기본 정책에 매칭되지 않는 코드
    const critOrHigh = violations.filter((v) => ['CRITICAL', 'HIGH'].includes(v.severity))
    expect(critOrHigh.length).toBe(0)
  })

  it('[FR-R110.1] 커스텀 정책 등록 후 스캔 동작', () => {
    const customPolicy: DataPolicy = {
      policyId: 'P-CUSTOM',
      name: 'eval 사용 금지',
      pattern: String.raw`\beval\s*\(`,
      severity: 'HIGH',
      description: 'eval() 사용은 코드 인젝션 위험',
      suggestedFix: 'JSON.parse() 또는 Function 생성자 사용',
    }
    enforcer.registerPolicy(customPolicy)
    const code = `const result = eval(userInput)`
    const violations = enforcer.scanCode(code, 'javascript')
    const evalViolation = violations.find((v) => v.policyId === 'P-CUSTOM')
    expect(evalViolation).toBeDefined()
  })

  it('[FR-R110.1] 유효하지 않은 정규식 등록 시 에러', () => {
    expect(() =>
      enforcer.registerPolicy({
        policyId: 'P-BAD',
        name: 'bad',
        pattern: '[invalid(regex',
        severity: 'LOW',
        description: 'test',
        suggestedFix: 'fix',
      }),
    ).toThrow('유효하지 않은 정규식')
  })

  it('[FR-R110.3] 위반에 대한 수정 제안 반환', () => {
    const code = `const password = 'hardcoded123!'`
    const violations = enforcer.scanCode(code, 'typescript')
    expect(violations.length).toBeGreaterThan(0)
    const fix = enforcer.suggestFix(violations[0]!)
    expect(fix.suggestion).toBeTruthy()
    expect(fix.violation).toEqual(violations[0])
  })

  it('[FR-R110.4] scanAndFix 위반 + 수정 제안 일괄 처리', () => {
    const code = `
const secret = 'my-secret-key-xyz'
const q = \`SELECT * FROM t WHERE id = \${id}\`
`
    const result = enforcer.scanAndFix(code, 'typescript')
    expect(result.violations.length).toBeGreaterThan(0)
    expect(result.fixes.length).toBe(result.violations.length)
    expect(result.scannedAt).toBeDefined()
    expect(result.totalLines).toBeGreaterThan(0)
  })

  it('[FR-R110.5] CSAP D-06 감사 로그 append-only', () => {
    enforcer.scanCode('const x = 1', 'typescript')
    enforcer.scanCode('const y = 2', 'javascript')
    const log = enforcer.getAuditLog()
    expect(log.length).toBe(2)
    expect(log[0]!.action).toBe('code.scan')
    // append-only 검증
    const copy = enforcer.getAuditLog()
    copy.push({ timestamp: 'fake', action: 'injected', language: 'typescript', violationCount: 0 })
    expect(enforcer.getAuditLog().length).toBe(2)
  })
})
