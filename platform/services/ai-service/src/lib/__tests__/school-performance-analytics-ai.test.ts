import { describe, it, expect, beforeEach } from 'vitest'
import { SchoolPerformanceAnalyticsAi } from '../school-performance-analytics-ai.js'

describe('SchoolPerformanceAnalyticsAi (FR-R508.1)', () => {
  let svc: SchoolPerformanceAnalyticsAi

  beforeEach(() => {
    svc = new SchoolPerformanceAnalyticsAi()
  })

  it('우수 학교 → EXCELLENT', () => {
    svc.registerSchool(
      {
        schoolId: 'S1',
        region: '서울',
        enrolledStudents: 1000,
        graduationRatePct: 98,
        attendanceRatePct: 96,
        avgTestScore: 92,
        teacherStudentRatio: 12,
      },
      'O'
    )
    const r = svc.analyze('S1')
    expect(r.tier).toBe('EXCELLENT')
    expect(r.strengths.length).toBeGreaterThan(0)
  })

  it('개선 필요 학교 → NEEDS_IMPROVEMENT', () => {
    svc.registerSchool(
      {
        schoolId: 'S2',
        region: '경기',
        enrolledStudents: 500,
        graduationRatePct: 70,
        attendanceRatePct: 80,
        avgTestScore: 60,
        teacherStudentRatio: 30,
      },
      'O'
    )
    const r = svc.analyze('S2')
    expect(r.tier).toBe('NEEDS_IMPROVEMENT')
    expect(r.improvements.length).toBeGreaterThan(0)
  })

  it('백분위 계산 (다중 학교)', () => {
    svc.registerSchool(
      {
        schoolId: 'S3',
        region: '서울',
        enrolledStudents: 800,
        graduationRatePct: 95,
        attendanceRatePct: 95,
        avgTestScore: 90,
        teacherStudentRatio: 14,
      },
      'O'
    )
    svc.registerSchool(
      {
        schoolId: 'S4',
        region: '서울',
        enrolledStudents: 600,
        graduationRatePct: 75,
        attendanceRatePct: 82,
        avgTestScore: 65,
        teacherStudentRatio: 20,
      },
      'O'
    )
    const high = svc.analyze('S3')
    expect(high.percentile).toBeGreaterThanOrEqual(50)
  })

  it('잘못된 졸업률 거부', () => {
    expect(() =>
      svc.registerSchool(
        {
          schoolId: 'S5',
          region: '경남',
          enrolledStudents: 100,
          graduationRatePct: 150,
          attendanceRatePct: 90,
          avgTestScore: 80,
          teacherStudentRatio: 15,
        },
        'O'
      )
    ).toThrow(/graduationRatePct/)
  })

  it('C 등급 차단', () => {
    expect(() =>
      svc.registerSchool(
        {
          schoolId: 'S6',
          region: '서울',
          enrolledStudents: 100,
          graduationRatePct: 90,
          attendanceRatePct: 90,
          avgTestScore: 80,
          teacherStudentRatio: 15,
        },
        'C'
      )
    ).toThrow(/BLOCKED/)
  })

  it('감사 로그 기록', () => {
    svc.registerSchool(
      {
        schoolId: 'S7',
        region: '대전',
        enrolledStudents: 700,
        graduationRatePct: 90,
        attendanceRatePct: 92,
        avgTestScore: 85,
        teacherStudentRatio: 16,
      },
      'O'
    )
    svc.analyze('S7')
    expect(svc.getAuditLog().length).toBeGreaterThanOrEqual(2)
  })
})
