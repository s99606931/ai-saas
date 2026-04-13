// Design Ref: §R413 — AI기반 공공기관 직원 역량 자동 매칭
import { describe, it, expect, beforeEach } from 'vitest'
import { EmployeeSkillMatcherAi } from '../employee-skill-matcher-ai'

describe('EmployeeSkillMatcherAi', () => {
  let matcher: EmployeeSkillMatcherAi

  beforeEach(() => {
    matcher = new EmployeeSkillMatcherAi()
    matcher.registerEmployee({ employeeId: 'EMP001234', name: '김철수', skills: ['Java', 'Spring', 'Docker'], yearsOfExperience: 7, department: 'IT' })
    matcher.registerEmployee({ employeeId: 'EMP005678', name: '이영희', skills: ['Python', 'Docker', 'Kubernetes'], yearsOfExperience: 3, department: 'DevOps' })
    matcher.registerEmployee({ employeeId: 'EMP009012', name: '박민준', skills: ['Java', 'Kubernetes', 'Spring'], yearsOfExperience: 2, department: 'IT' })
  })

  it('매칭 점수 산출: Java+Spring 필요 → 김철수 최고점', () => {
    const result = matcher.match({ projectId: 'PRJ-001', requiredSkills: ['Java', 'Spring'], minExperienceYears: 3 })
    expect(result.matches[0]?.name).toBe('김철수')
    expect(result.matches[0]?.matchScore).toBeGreaterThan(0)
  })

  it('경력 보너스: 5년 이상 → +10점', () => {
    const result = matcher.match({ projectId: 'PRJ-002', requiredSkills: ['Java', 'Spring'], minExperienceYears: 1 })
    const kimMatch = result.matches.find((m) => m.name === '김철수')
    // 100% 매칭(100점) + 경력보너스(10점) → min(100, 110) = 100
    expect(kimMatch?.matchScore).toBe(100)
  })

  it('meetsExperience: 경력 요건 충족 여부', () => {
    const result = matcher.match({ projectId: 'PRJ-003', requiredSkills: ['Java'], minExperienceYears: 5 })
    const kimMatch = result.matches.find((m) => m.name === '김철수')
    const parkMatch = result.matches.find((m) => m.name === '박민준')
    expect(kimMatch?.meetsExperience).toBe(true)
    expect(parkMatch?.meetsExperience).toBe(false)
  })

  it('PII: maskedEmployeeId에 원본 employeeId 미포함', () => {
    const result = matcher.match({ projectId: 'PRJ-004', requiredSkills: ['Docker'], minExperienceYears: 0 })
    for (const m of result.matches) {
      expect(m.maskedEmployeeId).not.toBe(m.employeeId)
      expect(m.maskedEmployeeId).toContain('*')
    }
  })

  it('매칭 없음: 보유 스킬 0개 직원 제외', () => {
    const result = matcher.match({ projectId: 'PRJ-005', requiredSkills: ['React', 'Vue'], minExperienceYears: 0 })
    expect(result.matches).toHaveLength(0)
    expect(result.topCandidate).toBeNull()
  })

  it('matchCount 제한: 상위 2명만 반환', () => {
    const result = matcher.match({ projectId: 'PRJ-006', requiredSkills: ['Docker'], minExperienceYears: 0 }, 2)
    expect(result.matches.length).toBeLessThanOrEqual(2)
  })

  it('감사 로그에 skill.match 기록', () => {
    matcher.match({ projectId: 'PRJ-007', requiredSkills: ['Java'], minExperienceYears: 0 })
    const logs = matcher.getAuditLog()
    expect(logs.some((l) => l.action === 'skill.match')).toBe(true)
  })
})
