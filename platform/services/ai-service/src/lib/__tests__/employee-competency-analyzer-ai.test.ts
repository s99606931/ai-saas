import { describe, it, expect, beforeEach } from 'vitest'
import { EmployeeCompetencyAnalyzerAi, type CompetencyDefinition, type EmployeeProfile } from '../employee-competency-analyzer-ai'

describe('EmployeeCompetencyAnalyzerAi', () => {
  let ai: EmployeeCompetencyAnalyzerAi

  const competency: CompetencyDefinition = {
    competencyId: 'COMP001',
    name: '클라우드 아키텍처',
    category: 'TECHNICAL',
    requiredLevel: 4,
  }

  const employee: EmployeeProfile = {
    employeeId: 'EMP001',
    name: '김철수',
    department: 'IT기획팀',
    competencyScores: [{ competencyId: 'COMP001', score: 2 }],
  }

  beforeEach(() => {
    ai = new EmployeeCompetencyAnalyzerAi()
    ai.registerCompetency(competency)
    ai.registerEmployee(employee)
  })

  it('직원 등록 감사 로그 (실명 마스킹)', () => {
    const log = ai.getAuditLog()
    const entry = log.find((e) => e.action === 'employee.register')!
    expect(entry).toBeDefined()
    expect(entry.detail).not.toContain('김철수')
  })

  it('역량 부족 → gap 감지', () => {
    const analysis = ai.analyze('EMP001')
    const gap = analysis.gaps.find((g) => g.competencyId === 'COMP001')!
    expect(gap).toBeDefined()
    expect(gap.gap).toBe(2)
    expect(gap.priority).toBe('HIGH')
  })

  it('gap >= 3 → HIGH 우선순위', () => {
    ai.registerCompetency({ ...competency, competencyId: 'COMP002', name: '보안 관리', requiredLevel: 5 })
    ai.registerEmployee({ ...employee, employeeId: 'EMP002', competencyScores: [{ competencyId: 'COMP002', score: 1 }] })
    const analysis = ai.analyze('EMP002')
    const gap = analysis.gaps.find((g) => g.competencyId === 'COMP002')!
    expect(gap.priority).toBe('HIGH')
  })

  it('역량 초과 → strengths 포함', () => {
    ai.registerEmployee({
      ...employee,
      employeeId: 'EMP003',
      competencyScores: [{ competencyId: 'COMP001', score: 6 }],
    })
    const analysis = ai.analyze('EMP003')
    expect(analysis.strengths).toContain('클라우드 아키텍처')
    expect(analysis.gaps.length).toBe(0)
  })

  it('HIGH 우선순위 gap → developmentRecommendations 생성', () => {
    const analysis = ai.analyze('EMP001')
    expect(analysis.developmentRecommendations.some((r) => r.includes('클라우드 아키텍처'))).toBe(true)
  })

  it('미등록 직원 에러', () => {
    expect(() => ai.analyze('UNKNOWN')).toThrow()
  })

  it('분석 후 감사 로그', () => {
    ai.analyze('EMP001')
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'competency.analyze')).toBe(true)
  })
})
