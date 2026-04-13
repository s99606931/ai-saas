// Plan SC: SVC-AI-ADV-R407
import { describe, it, expect, beforeEach } from 'vitest'
import { ContractRiskAnalyzerAI } from '../contract-risk-analyzer-ai'

describe('ContractRiskAnalyzerAI', () => {
  let analyzer: ContractRiskAnalyzerAI

  beforeEach(() => {
    analyzer = new ContractRiskAnalyzerAI()
  })

  it('registerContract — 감사 로그에 contract.register 기록', () => {
    analyzer.registerContract('c1', '용역 계약', 'service')
    const log = analyzer.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('contract.register')
  })

  it('getRiskScore — 위반 조항 없을 때 riskScore=0', () => {
    analyzer.registerContract('c1', '용역 계약', 'service')
    const result = analyzer.getRiskScore('c1')
    expect(result.riskScore).toBe(0)
    expect(result.clauseCount).toBe(0)
  })

  it('getRiskScore — critical 조항 시 riskScore=30', () => {
    analyzer.registerContract('c1', '용역 계약', 'service')
    analyzer.recordRiskClause('c1', '일방 해지', 'critical')
    const result = analyzer.getRiskScore('c1')
    expect(result.riskScore).toBe(30)
  })

  it('getRiskScore — 복합 조항 누적 계산', () => {
    analyzer.registerContract('c1', '용역 계약', 'service')
    analyzer.recordRiskClause('c1', '일방 해지', 'high')    // 20
    analyzer.recordRiskClause('c1', '손해배상 한도', 'medium') // 10
    const result = analyzer.getRiskScore('c1')
    expect(result.riskScore).toBe(30)
    expect(result.clauseCount).toBe(2)
  })

  it('getHighRiskContracts — threshold 이상 계약만 반환', () => {
    analyzer.registerContract('c1', '고위험 계약', 'service')
    analyzer.registerContract('c2', '저위험 계약', 'purchase')
    analyzer.recordRiskClause('c1', '일방 해지', 'critical') // 30
    analyzer.recordRiskClause('c1', '이중 지급', 'critical') // 30 → total 60
    analyzer.recordRiskClause('c2', '소액 조항', 'low')       // 5
    const highRisk = analyzer.getHighRiskContracts(50)
    expect(highRisk).toHaveLength(1)
    expect(highRisk[0]!.contractId).toBe('c1')
  })

  it('recordRiskClause — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    analyzer.registerContract('c1', '계약', 'service')
    expect(() => analyzer.recordRiskClause('c1', '조항', 'high', 'C')).toThrow('BLOCKED')
  })

  it('recordRiskClause — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    analyzer.registerContract('c1', '계약', 'service')
    expect(() => analyzer.recordRiskClause('c1', '조항', 'high', 'S')).toThrow('N2SF N-05')
  })

  it('getRiskScore — 없는 contractId 에러', () => {
    expect(() => analyzer.getRiskScore('nonexistent')).toThrow('contractId 없음')
  })
})
