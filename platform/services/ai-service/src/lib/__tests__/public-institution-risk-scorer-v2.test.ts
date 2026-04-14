import { describe, it, expect, beforeEach } from 'vitest'
import { PublicInstitutionRiskScorerV2 } from '../public-institution-risk-scorer-v2'

describe('PublicInstitutionRiskScorerV2', () => {
  let scorer: PublicInstitutionRiskScorerV2

  beforeEach(() => {
    scorer = new PublicInstitutionRiskScorerV2()
  })

  it('기관 등록 후 조회 가능', () => {
    const inst = scorer.registerInstitution('inst-1', '행정안전부', 'ministry')
    expect(inst.institutionId).toBe('inst-1')
    expect(inst.type).toBe('ministry')
  })

  it('위험 요소 누적 합산', () => {
    scorer.registerInstitution('inst-1', '행정안전부', 'ministry')
    scorer.recordRiskFactor('inst-1', '보안취약', 30)
    scorer.recordRiskFactor('inst-1', '노후시스템', 20)
    expect(scorer.getRiskScore('inst-1')).toBe(50)
  })

  it('위험 점수 최대 100', () => {
    scorer.registerInstitution('inst-1', '행정안전부', 'ministry')
    scorer.recordRiskFactor('inst-1', '보안취약', 80)
    scorer.recordRiskFactor('inst-1', '노후시스템', 50)
    expect(scorer.getRiskScore('inst-1')).toBe(100)
  })

  it('high 등급: 70 이상', () => {
    scorer.registerInstitution('inst-1', '행정안전부', 'ministry')
    scorer.recordRiskFactor('inst-1', '보안취약', 75)
    expect(scorer.getRiskLevel('inst-1')).toBe('high')
  })

  it('medium 등급: 40 이상 70 미만', () => {
    scorer.registerInstitution('inst-1', '행정안전부', 'ministry')
    scorer.recordRiskFactor('inst-1', '보안취약', 50)
    expect(scorer.getRiskLevel('inst-1')).toBe('medium')
  })

  it('low 등급: 40 미만', () => {
    scorer.registerInstitution('inst-1', '행정안전부', 'ministry')
    scorer.recordRiskFactor('inst-1', '보안취약', 20)
    expect(scorer.getRiskLevel('inst-1')).toBe('low')
  })

  it('getHighRiskInstitutions: high 등급만 반환', () => {
    scorer.registerInstitution('inst-1', '행정안전부', 'ministry')
    scorer.registerInstitution('inst-2', '과학기술부', 'ministry')
    scorer.recordRiskFactor('inst-1', '보안취약', 80)
    scorer.recordRiskFactor('inst-2', '경미', 10)
    const high = scorer.getHighRiskInstitutions()
    expect(high.map((i) => i.institutionId)).toContain('inst-1')
    expect(high.map((i) => i.institutionId)).not.toContain('inst-2')
  })

  it('C등급 데이터 전송 차단', () => {
    scorer.registerInstitution('inst-1', '행정안전부', 'ministry')
    expect(() => scorer.recordRiskFactor('inst-1', '보안취약', 30, 'C')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    scorer.registerInstitution('inst-1', '행정안전부', 'ministry')
    scorer.recordRiskFactor('inst-1', '보안취약', 30)
    const log = scorer.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
