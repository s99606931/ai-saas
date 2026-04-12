import { describe, it, expect, beforeEach } from 'vitest'
import {
  SmartContractValidator,
  type RequiredClause,
  type RiskKeyword,
  type ContractInput,
} from '../smart-contract-validator'

describe('SmartContractValidator', () => {
  let validator: SmartContractValidator

  const confidentialityClause: RequiredClause = {
    clauseId: 'CLAUSE-CONF',
    category: '비밀유지',
    keywords: ['비밀유지', '기밀'],
    description: '비밀유지 조항',
  }

  const terminationClause: RequiredClause = {
    clauseId: 'CLAUSE-TERM',
    category: '해지',
    keywords: ['해지', '사유'],
    description: '계약 해지 조항',
  }

  const riskMonopoly: RiskKeyword = {
    keyword: '독점',
    weight: 40,
    reason: '독점 조항은 공정거래 위반 가능',
  }

  const riskUnlimited: RiskKeyword = {
    keyword: '무제한',
    weight: 20,
    reason: '무제한 책임 조항 주의',
  }

  const validContract: ContractInput = {
    contractId: 'CTR-2026-001',
    title: '공공 SaaS 유지보수',
    parties: ['기관A', '업체B'],
    amount: 50_000_000,
    text: '본 계약의 양 당사자는 비밀유지 및 기밀 보호 의무를 진다. 해지 사유 발생 시 해지할 수 있다.',
    grade: 'O',
  }

  beforeEach(() => {
    validator = new SmartContractValidator()
    validator.registerRequiredClause(confidentialityClause)
    validator.registerRequiredClause(terminationClause)
    validator.registerRiskKeyword(riskMonopoly)
    validator.registerRiskKeyword(riskUnlimited)
    validator.registerContract(validContract)
  })

  it('S등급 계약 차단', () => {
    expect(() =>
      validator.registerContract({ ...validContract, contractId: 'CTR-X', grade: 'S' })
    ).toThrow('BLOCKED')
  })

  it('O등급 아닌 경우 거부', () => {
    expect(() =>
      validator.registerContract({ ...validContract, contractId: 'CTR-Y', grade: undefined })
    ).toThrow('O등급만')
  })

  it('금액 음수 차단', () => {
    expect(() =>
      validator.registerContract({ ...validContract, contractId: 'CTR-Z', amount: -1 })
    ).toThrow('amount')
  })

  it('필수 조항 모두 충족 + 위험 없음 → VALID', () => {
    const result = validator.validate('CTR-2026-001')
    expect(result.status).toBe('VALID')
    expect(result.requiredMatched).toBe(2)
    expect(result.riskScore).toBe(0)
  })

  it('필수 조항 누락 → INVALID', () => {
    validator.registerContract({
      ...validContract,
      contractId: 'CTR-MISS',
      text: '본 계약은 비밀유지 기밀 의무만 명시한다.',
    })
    const result = validator.validate('CTR-MISS')
    expect(result.status).toBe('INVALID')
    expect(result.missingClauses).toContain('CLAUSE-TERM')
  })

  it('필수 충족 + 낮은 위험 → WARN', () => {
    validator.registerContract({
      ...validContract,
      contractId: 'CTR-WARN',
      text: '비밀유지 기밀 조항. 해지 사유 명시. 무제한 수정 권한 보류.',
    })
    const result = validator.validate('CTR-WARN')
    expect(result.status).toBe('WARN')
    expect(result.riskScore).toBeGreaterThan(0)
    expect(result.riskScore).toBeLessThan(50)
  })

  it('높은 위험 → INVALID', () => {
    validator.registerContract({
      ...validContract,
      contractId: 'CTR-RISK',
      text: '비밀유지 기밀. 해지 사유. 독점 공급 조항과 독점 유통 권한을 포함한다.',
    })
    const result = validator.validate('CTR-RISK')
    expect(result.status).toBe('INVALID')
    expect(result.riskScore).toBeGreaterThanOrEqual(50)
  })

  it('미등록 계약 → 에러', () => {
    expect(() => validator.validate('UNKNOWN')).toThrow('Unknown contract')
  })

  it('위험 키워드 weight 범위 검증', () => {
    expect(() =>
      validator.registerRiskKeyword({ keyword: 'bad', weight: 101, reason: 'x' })
    ).toThrow('weight')
  })

  it('감사 로그 — contractId 마스킹', () => {
    validator.validate('CTR-2026-001')
    const log = validator.getAuditLog()
    const hasMasked = log.some((e) => e.contractIdMasked.includes('***'))
    expect(hasMasked).toBe(true)
    const hasRaw = log.some((e) => e.contractIdMasked === 'CTR-2026-001')
    expect(hasRaw).toBe(false)
  })

  it('필수 조항 키워드 빈 배열 차단', () => {
    expect(() =>
      validator.registerRequiredClause({
        clauseId: 'EMPTY',
        category: 'x',
        keywords: [],
        description: 'x',
      })
    ).toThrow('keywords')
  })
})
