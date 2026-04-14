// Plan SC: SVC-AI-ADV-R618
import { describe, it, expect, beforeEach } from 'vitest'
import { QuantumSafeCryptoAdvisorV2 } from '../quantum-safe-crypto-advisor-v2'

describe('QuantumSafeCryptoAdvisorV2', () => {
  let ad: QuantumSafeCryptoAdvisorV2

  beforeEach(() => {
    ad = new QuantumSafeCryptoAdvisorV2()
  })

  it('registerUsage — 감사 로그', () => {
    ad.registerUsage('u1', 'RSA', 'TLS 인증서')
    const log = ad.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('usage.register')
  })

  it('advise — RSA → HIGH + ML-KEM 권장', () => {
    ad.registerUsage('u1', 'RSA', 'TLS')
    const r = ad.advise('u1')
    expect(r.risk).toBe('HIGH')
    expect(r.recommendation).toContain('ML-KEM')
  })

  it('advise — ECDSA → HIGH + ML-DSA 권장', () => {
    ad.registerUsage('u1', 'ECDSA', '서명')
    const r = ad.advise('u1')
    expect(r.risk).toBe('HIGH')
    expect(r.recommendation).toContain('ML-DSA')
  })

  it('advise — AES-128 → MEDIUM', () => {
    ad.registerUsage('u1', 'AES-128', '저장')
    const r = ad.advise('u1')
    expect(r.risk).toBe('MEDIUM')
    expect(r.recommendation).toContain('AES-256')
  })

  it('advise — AES-256 → SAFE', () => {
    ad.registerUsage('u1', 'AES-256', '저장')
    const r = ad.advise('u1')
    expect(r.risk).toBe('SAFE')
  })

  it('registerUsage — C/S 차단', () => {
    expect(() => ad.registerUsage('u1', 'RSA', 'x', 'C')).toThrow(/BLOCKED/)
    expect(() => ad.registerUsage('u1', 'RSA', 'x', 'S')).toThrow(/BLOCKED/)
  })

  it('summarize — 위험 점수 산출', () => {
    ad.registerUsage('u1', 'RSA', 'x')       // HIGH=100
    ad.registerUsage('u2', 'AES-128', 'y')   // MEDIUM=50
    ad.registerUsage('u3', 'AES-256', 'z')   // SAFE=0
    const s = ad.summarize()
    expect(s.totalItems).toBe(3)
    expect(s.highRiskCount).toBe(1)
    expect(s.mediumRiskCount).toBe(1)
    expect(s.overallRiskScore).toBe(50)
  })
})
