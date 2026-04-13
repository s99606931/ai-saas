import { describe, it, expect, beforeEach } from 'vitest'
import { PublicContractAnalyzerV2, type PublicContract } from '../public-contract-analyzer-v2'

describe('PublicContractAnalyzerV2', () => {
  let analyzer: PublicContractAnalyzerV2

  const baseContract: PublicContract = {
    contractId: 'CTR001',
    title: '공공 SW 용역 계약',
    contractorName: '(주)테스트',
    totalValue: 50_000_000,
    durationDays: 180,
    clauses: [
      {
        clauseId: 'CL001',
        type: 'PAYMENT',
        content: '대금 지급',
        isOnerous: false,
        riskKeywords: [],
      },
    ],
    isPublicProcurement: false,
  }

  beforeEach(() => {
    analyzer = new PublicContractAnalyzerV2()
    analyzer.registerContract(baseContract)
  })

  it('계약 등록 감사 로그', () => {
    const log = analyzer.getAuditLog()
    expect(log.some((e) => e.action === 'contract.register')).toBe(true)
  })

  it('위험 없는 계약 → overallRisk LOW', () => {
    const analysis = analyzer.analyze('CTR001')
    expect(analysis.overallRisk).toBe('LOW')
  })

  it('불리한 PENALTY 조항 → CRITICAL riskLevel', () => {
    const contract: PublicContract = {
      ...baseContract,
      contractId: 'CTR002',
      clauses: [
        {
          clauseId: 'CL002',
          type: 'PENALTY',
          content: '지체 위약금',
          isOnerous: true,
          riskKeywords: ['무제한', '즉시'],
        },
      ],
    }
    analyzer.registerContract(contract)
    const analysis = analyzer.analyze('CTR002')
    const penaltyRisk = analysis.clauseRisks.find((r) => r.clauseId === 'CL002')!
    expect(penaltyRisk.riskLevel).toBe('CRITICAL')
  })

  it('공공조달 1억 초과 + IP_RIGHTS 없음 → complianceFlag', () => {
    const contract: PublicContract = {
      ...baseContract,
      contractId: 'CTR003',
      totalValue: 200_000_000,
      isPublicProcurement: true,
      clauses: [],
    }
    analyzer.registerContract(contract)
    const analysis = analyzer.analyze('CTR003')
    expect(analysis.complianceFlags.some((f) => f.includes('지식재산권'))).toBe(true)
  })

  it('공공계약 보안유지 조항 누락 → complianceFlag', () => {
    const contract: PublicContract = {
      ...baseContract,
      contractId: 'CTR004',
      isPublicProcurement: true,
      clauses: [],
    }
    analyzer.registerContract(contract)
    const analysis = analyzer.analyze('CTR004')
    expect(analysis.complianceFlags.some((f) => f.includes('보안'))).toBe(true)
  })

  it('미등록 계약 에러', () => {
    expect(() => analyzer.analyze('UNKNOWN')).toThrow()
  })

  it('위험 키워드 개수 × 10점 반영', () => {
    const contract: PublicContract = {
      ...baseContract,
      contractId: 'CTR005',
      clauses: [
        {
          clauseId: 'CL005',
          type: 'PAYMENT',
          content: '위험 조항',
          isOnerous: false,
          riskKeywords: ['독소', '자동갱신', '일방'],
        },
      ],
    }
    analyzer.registerContract(contract)
    const analysis = analyzer.analyze('CTR005')
    // 3 keywords × 10 = 30pts → MEDIUM (≥20, <40)
    const clauseRisk = analysis.clauseRisks.find((r) => r.clauseId === 'CL005')!
    expect(clauseRisk.riskLevel).toBe('MEDIUM')
  })

  it('분석 후 감사 로그', () => {
    analyzer.analyze('CTR001')
    const log = analyzer.getAuditLog()
    expect(log.some((e) => e.action === 'contract.analyze')).toBe(true)
  })
})
