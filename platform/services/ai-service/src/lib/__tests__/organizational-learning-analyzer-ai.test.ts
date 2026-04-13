// Plan SC: SVC-AI-ADV-R341
import { describe, it, expect, beforeEach } from 'vitest'
import { OrganizationalLearningAnalyzerAI } from '../organizational-learning-analyzer-ai'

describe('OrganizationalLearningAnalyzerAI', () => {
  let analyzer: OrganizationalLearningAnalyzerAI

  beforeEach(() => {
    analyzer = new OrganizationalLearningAnalyzerAI()
  })

  it('registerMember — 감사 로그에 maskedId 기록 (PII 보호)', () => {
    analyzer.registerMember('emp001', '정보화팀')
    const log = analyzer.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('member.register')
    // maskedId는 SHA-256 16자 hex — 원본 ID가 아님
    expect(log[0]!.detail).not.toBe('emp001')
    expect(log[0]!.detail).toHaveLength(16)
  })

  it('getMemberStats — 완료율, 평균점수, 효율 계산', () => {
    analyzer.registerMember('emp001', '정보화팀')
    analyzer.recordLearning('emp001', 'course-A', 80, true)
    analyzer.recordLearning('emp001', 'course-B', 100, true)
    analyzer.recordLearning('emp001', 'course-C', 60, false)
    const stats = analyzer.getMemberStats('emp001')
    // completionRate: 2/3 * 100 = 66.67
    expect(stats.completionRate).toBeCloseTo(66.67, 1)
    // avgScore: (80+100)/2 = 90
    expect(stats.avgScore).toBe(90)
    // efficiency: 66.67 * 90 / 100 = 60.0
    expect(stats.efficiency).toBeCloseTo(60.0, 0)
    expect(stats.totalCourses).toBe(3)
  })

  it('getMemberStats — maskedMemberId는 SHA-256 16자 hex', () => {
    analyzer.registerMember('emp001', '정보화팀')
    const stats = analyzer.getMemberStats('emp001')
    expect(stats.maskedMemberId).not.toBe('emp001')
    expect(stats.maskedMemberId).toHaveLength(16)
  })

  it('getDepartmentStats — 부서 평균 효율 계산', () => {
    analyzer.registerMember('emp001', '정보화팀')
    analyzer.registerMember('emp002', '정보화팀')
    analyzer.recordLearning('emp001', 'course-A', 100, true)
    analyzer.recordLearning('emp002', 'course-A', 80, true)
    const deptStats = analyzer.getDepartmentStats('정보화팀')
    expect(deptStats.memberCount).toBe(2)
    expect(deptStats.avgEfficiency).toBeGreaterThan(0)
  })

  it('recordLearning — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    analyzer.registerMember('emp001', '정보화팀')
    expect(() => analyzer.recordLearning('emp001', 'course-A', 90, true, 'C')).toThrow('BLOCKED')
  })

  it('recordLearning — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    analyzer.registerMember('emp001', '정보화팀')
    expect(() => analyzer.recordLearning('emp001', 'course-A', 90, true, 'S')).toThrow('N2SF N-05')
  })

  it('getMemberStats — 학습 기록 없을 때 효율 0', () => {
    analyzer.registerMember('emp001', '정보화팀')
    const stats = analyzer.getMemberStats('emp001')
    expect(stats.completionRate).toBe(0)
    expect(stats.avgScore).toBe(0)
    expect(stats.efficiency).toBe(0)
  })

  it('getDepartmentStats — 없는 부서 memberCount=0 반환', () => {
    const stats = analyzer.getDepartmentStats('없는팀')
    expect(stats.memberCount).toBe(0)
    expect(stats.avgEfficiency).toBe(0)
  })
})
