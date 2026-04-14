// Plan SC: SVC-AI-ADV-R617
import { describe, it, expect, beforeEach } from 'vitest'
import { SmartContractAuditorV2 } from '../smart-contract-auditor-v2'

describe('SmartContractAuditorV2', () => {
  let a: SmartContractAuditorV2

  beforeEach(() => {
    a = new SmartContractAuditorV2()
  })

  it('registerContract — 감사 로그', () => {
    a.registerContract('c1', 'contract A {}')
    const log = a.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('contract.register')
  })

  it('audit — pragma 0.4 → CRITICAL', () => {
    a.registerContract('c1', 'pragma solidity ^0.4.17;\ncontract A {}')
    const r = a.audit('c1')
    expect(r.overallSeverity).toBe('CRITICAL')
    expect(r.findings.some((f) => f.rule === 'outdated-pragma')).toBe(true)
  })

  it('audit — tx.origin → HIGH', () => {
    a.registerContract('c1', 'contract A { function f() { require(tx.origin == owner); } }')
    const r = a.audit('c1')
    expect(r.overallSeverity).toBe('HIGH')
    expect(r.findings.some((f) => f.rule === 'tx-origin')).toBe(true)
  })

  it('audit — block.timestamp → MEDIUM', () => {
    a.registerContract('c1', 'contract A { function f() { require(block.timestamp > 0); } }')
    const r = a.audit('c1')
    expect(r.overallSeverity).toBe('MEDIUM')
  })

  it('audit — 취약점 없음 → LOW', () => {
    a.registerContract('c1', 'pragma solidity ^0.8.20;\ncontract Safe { uint256 x; }')
    const r = a.audit('c1')
    expect(r.overallSeverity).toBe('LOW')
    expect(r.findings).toHaveLength(0)
  })

  it('registerContract — C/S 차단', () => {
    expect(() => a.registerContract('c1', 'contract A {}', 'C')).toThrow(/BLOCKED/)
    expect(() => a.registerContract('c1', 'contract A {}', 'S')).toThrow(/BLOCKED/)
  })

  it('audit — findings에 line 번호 포함', () => {
    a.registerContract('c1', 'line1\nline2 tx.origin line2')
    const r = a.audit('c1')
    const txOrigin = r.findings.find((f) => f.rule === 'tx-origin')
    expect(txOrigin?.line).toBe(2)
  })
})
