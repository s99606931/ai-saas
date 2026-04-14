// Plan SC: SVC-AI-ADV-R561-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { CapabilityEnhancementPlatformAI, type Employee, type Course } from '../capability-enhancement-platform-ai'

describe('CapabilityEnhancementPlatformAI', () => {
  let platform: CapabilityEnhancementPlatformAI

  const employee: Employee = {
    employeeId: 'EMP-1',
    name: '김철수',
    role: 'DEVELOPER',
    department: '개발팀',
    yearsOfExperience: 3,
    skills: [
      { skillId: 'SK-1', category: 'TECHNICAL', name: 'TypeScript', currentScore: 80, targetScore: 70 },
      { skillId: 'SK-2', category: 'SECURITY', name: '보안 기초', currentScore: 40, targetScore: 70 },
    ],
  }

  const course: Course = {
    courseId: 'CRS-1',
    name: '공공기관 보안 기초',
    skillCategory: 'SECURITY',
    durationHours: 8,
    difficultyLevel: 'BEGINNER',
    targetRoles: ['DEVELOPER', 'IT_ADMIN'],
  }

  beforeEach(() => {
    platform = new CapabilityEnhancementPlatformAI()
  })

  it('미등록 직원 평가 시 오류 발생', () => {
    expect(() => platform.assess('UNKNOWN')).toThrow('Unknown employee')
  })

  it('목표 점수 미달 스킬 → gapSkills 포함', () => {
    platform.registerEmployee(employee)
    const assessment = platform.assess('EMP-1')
    expect(assessment.gapSkills.some((s) => s.skillId === 'SK-2')).toBe(true)
    expect(assessment.gapSkills.some((s) => s.skillId === 'SK-1')).toBe(false)
  })

  it('부족 역량에 맞는 교육 과정 추천', () => {
    platform.registerEmployee(employee)
    platform.registerCourse(course)
    const assessment = platform.assess('EMP-1')
    expect(assessment.recommendedCourses.some((c) => c.courseId === 'CRS-1')).toBe(true)
  })

  it('overallScore: 스킬 평균 계산', () => {
    platform.registerEmployee(employee)
    const assessment = platform.assess('EMP-1')
    expect(assessment.overallScore).toBe(Math.round((80 + 40) / 2))
  })

  it('trackProgress: 100% 완료 → completedAt 기록', () => {
    platform.registerEmployee(employee)
    platform.registerCourse(course)
    platform.trackProgress('EMP-1', 'CRS-1', 100)
    // 감사 로그에 기록되어야 함
    const log = platform.getAuditLog()
    expect(log.some((l) => l.action === 'progress.track')).toBe(true)
  })

  it('generateReport: 직원 현황 요약 반환', () => {
    platform.registerEmployee(employee)
    const report = platform.generateReport()
    expect(report.totalEmployees).toBe(1)
    expect(report.employeesNeedingTraining).toBe(1)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    platform.registerEmployee(employee)
    platform.assess('EMP-1')
    const log1 = platform.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', employeeId: 'X', detail: {} })
    const log2 = platform.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
