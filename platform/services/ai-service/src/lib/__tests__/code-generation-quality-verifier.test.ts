// Plan SC: SVC-AI-ADV-R381
import { describe, it, expect, beforeEach } from 'vitest'
import { CodeGenerationQualityVerifier } from '../code-generation-quality-verifier'

describe('CodeGenerationQualityVerifier', () => {
  let verifier: CodeGenerationQualityVerifier

  beforeEach(() => {
    verifier = new CodeGenerationQualityVerifier()
  })

  it('registerSnippet — 감사 로그에 snippet.register 기록', () => {
    verifier.registerSnippet('snp-1', 'typescript', 50)
    const log = verifier.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('snippet.register')
  })

  it('getQualityScore — 결함 없을 때 100', () => {
    verifier.registerSnippet('snp-1', 'typescript', 50)
    expect(verifier.getQualityScore('snp-1')).toBe(100)
  })

  it('getQualityScore — critical 결함 시 100-30=70', () => {
    verifier.registerSnippet('snp-1', 'typescript', 50)
    verifier.recordDefect('snp-1', 'sql-injection', 'critical')
    expect(verifier.getQualityScore('snp-1')).toBe(70)
  })

  it('getQualityScore — 복합 결함 누적 차감', () => {
    verifier.registerSnippet('snp-1', 'typescript', 50)
    verifier.recordDefect('snp-1', 'sql-injection', 'high')    // -15
    verifier.recordDefect('snp-1', 'xss', 'medium')           // -7
    // 100 - 15 - 7 = 78
    expect(verifier.getQualityScore('snp-1')).toBe(78)
  })

  it('getQualityScore — 최저 0 (음수 불가)', () => {
    verifier.registerSnippet('snp-1', 'typescript', 10)
    verifier.recordDefect('snp-1', 'd1', 'critical') // -30
    verifier.recordDefect('snp-1', 'd2', 'critical') // -30
    verifier.recordDefect('snp-1', 'd3', 'critical') // -30
    verifier.recordDefect('snp-1', 'd4', 'critical') // -30 → total -120
    expect(verifier.getQualityScore('snp-1')).toBe(0)
  })

  it('getDefectSummary — 결함 유형별 집계', () => {
    verifier.registerSnippet('snp-1', 'typescript', 50)
    verifier.recordDefect('snp-1', 'sql-injection', 'critical')
    verifier.recordDefect('snp-1', 'xss', 'high')
    verifier.recordDefect('snp-1', 'sql-injection', 'medium')
    const summary = verifier.getDefectSummary('snp-1')
    expect(summary['sql-injection']).toBe(2)
    expect(summary['xss']).toBe(1)
  })

  it('recordDefect — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    verifier.registerSnippet('snp-1', 'typescript', 50)
    expect(() => verifier.recordDefect('snp-1', 'xss', 'high', 'C')).toThrow('BLOCKED')
  })

  it('recordDefect — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    verifier.registerSnippet('snp-1', 'typescript', 50)
    expect(() => verifier.recordDefect('snp-1', 'xss', 'high', 'S')).toThrow('N2SF N-05')
  })
})
