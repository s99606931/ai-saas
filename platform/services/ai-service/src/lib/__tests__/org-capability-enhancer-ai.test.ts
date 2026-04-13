// Plan SC: SVC-AI-ADV-R434-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { OrgCapabilityEnhancerAI, type StaffProfile } from '../org-capability-enhancer-ai'

describe('OrgCapabilityEnhancerAI', () => {
  let enhancer: OrgCapabilityEnhancerAI

  beforeEach(() => {
    enhancer = new OrgCapabilityEnhancerAI()
  })

  const expertProfile: StaffProfile = {
    staffId: 'S1',
    departmentId: 'DEPT-IT',
    grade: 'O',
    skills: [
      { domain: 'DIGITAL', level: 'EXPERT', lastUpdated: '2026-01-01' },
      { domain: 'SECURITY', level: 'ADVANCED', lastUpdated: '2026-01-01' },
      { domain: 'DATA', level: 'ADVANCED', lastUpdated: '2026-01-01' },
    ],
  }

  const beginnerProfile: StaffProfile = {
    staffId: 'S2',
    departmentId: 'DEPT-IT',
    grade: 'O',
    skills: [
      { domain: 'DIGITAL', level: 'BEGINNER', lastUpdated: '2026-01-01' },
      { domain: 'MANAGEMENT', level: 'BEGINNER', lastUpdated: '2026-01-01' },
    ],
  }

  it('N2SF: C등급 인사 데이터 등록 차단', () => {
    expect(() => enhancer.registerStaff({ ...expertProfile, staffId: 'S-C', grade: 'C' })).toThrow('BLOCKED')
  })

  it('N2SF: S등급 인사 데이터 등록 차단', () => {
    expect(() => enhancer.registerStaff({ ...expertProfile, staffId: 'S-S', grade: 'S' })).toThrow('BLOCKED')
  })

  it('직원 없는 부서 → 빈 결과', () => {
    const result = enhancer.assess('EMPTY-DEPT')
    expect(result.staffCount).toBe(0)
    expect(result.overallScore).toBe(0)
    expect(result.weakDomains.length).toBeGreaterThan(0)
  })

  it('전문가 직원 → 높은 점수', () => {
    enhancer.registerStaff(expertProfile)
    const result = enhancer.assess('DEPT-IT')
    expect(result.domainScores.DIGITAL).toBe(100)  // EXPERT = 100
    expect(result.strongDomains).toContain('DIGITAL')
  })

  it('초급 직원 → 취약 도메인 식별 및 교육 권고', () => {
    enhancer.registerStaff(beginnerProfile)
    const result = enhancer.assess('DEPT-IT')
    expect(result.weakDomains).toContain('DIGITAL')
    expect(result.recommendations.length).toBeGreaterThan(0)
    const digitalRec = result.recommendations.find((r) => r.domain === 'DIGITAL')
    expect(digitalRec).toBeDefined()
    expect(digitalRec?.currentLevel).toBe('BEGINNER')
    expect(digitalRec?.targetLevel).toBe('INTERMEDIATE')
  })

  it('복수 직원 평균 점수 계산', () => {
    enhancer.registerStaff(expertProfile)   // DIGITAL=100
    enhancer.registerStaff(beginnerProfile) // DIGITAL=25
    const result = enhancer.assess('DEPT-IT')
    expect(result.staffCount).toBe(2)
    // DIGITAL 평균: (100 + 25) / 2 = 62.5 → Math.round → 63
    expect(result.domainScores.DIGITAL).toBe(63)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    enhancer.registerStaff(expertProfile)
    enhancer.assess('DEPT-IT')
    const log1 = enhancer.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', departmentId: 'X', detail: {} })
    const log2 = enhancer.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
