// Plan SC: SVC-AI-ADV-R347
import { describe, it, expect, beforeEach } from 'vitest'
import { HrDataAnalyzerAI } from '../hr-data-analyzer-ai'

describe('HrDataAnalyzerAI', () => {
  let analyzer: HrDataAnalyzerAI

  beforeEach(() => {
    analyzer = new HrDataAnalyzerAI()
  })

  it('registerEmployee — 감사 로그에 maskedId 기록 (PII 보호)', () => {
    analyzer.registerEmployee('emp001', '인사팀')
    const log = analyzer.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('employee.register')
    // SHA-256 마스킹 — 원본 ID 노출 금지
    expect(log[0]!.detail).not.toBe('emp001')
    expect(log[0]!.detail).toHaveLength(16)
  })

  it('getDepartmentStats — 부서 헤드카운트, 평균 성과 계산', () => {
    analyzer.registerEmployee('emp001', '인사팀')
    analyzer.registerEmployee('emp002', '인사팀')
    analyzer.registerEmployee('emp003', '기획팀')
    analyzer.recordPerformance('emp001', 90, '2026-Q1')
    analyzer.recordPerformance('emp001', 80, '2026-Q2')
    analyzer.recordPerformance('emp002', 70, '2026-Q1')
    const stats = analyzer.getDepartmentStats('인사팀')
    expect(stats.headcount).toBe(2)
    // avgPerformance: (90+80+70)/3 = 80
    expect(stats.avgPerformance).toBe(80)
  })

  it('getTopPerformers — 평균 점수 높은 순 정렬', () => {
    analyzer.registerEmployee('emp001', '인사팀')
    analyzer.registerEmployee('emp002', '인사팀')
    analyzer.recordPerformance('emp001', 95, '2026-Q1')
    analyzer.recordPerformance('emp002', 75, '2026-Q1')
    const top = analyzer.getTopPerformers(1)
    expect(top).toHaveLength(1)
    expect(top[0]!.avgScore).toBe(95)
  })

  it('getTopPerformers — maskedEmployeeId는 16자 hex (PII 보호)', () => {
    analyzer.registerEmployee('emp001', '인사팀')
    analyzer.recordPerformance('emp001', 85, '2026-Q1')
    const top = analyzer.getTopPerformers(1)
    expect(top[0]!.maskedEmployeeId).not.toBe('emp001')
    expect(top[0]!.maskedEmployeeId).toHaveLength(16)
  })

  it('registerEmployee — C등급 데이터 등록 차단 (N2SF N-05)', () => {
    expect(() => analyzer.registerEmployee('emp001', '인사팀', 'C')).toThrow('BLOCKED')
  })

  it('recordPerformance — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    analyzer.registerEmployee('emp001', '인사팀')
    expect(() => analyzer.recordPerformance('emp001', 90, '2026-Q1', 'S')).toThrow('N2SF N-05')
  })

  it('getDepartmentStats — 없는 부서 headcount=0 반환', () => {
    const stats = analyzer.getDepartmentStats('없는팀')
    expect(stats.headcount).toBe(0)
    expect(stats.avgPerformance).toBe(0)
  })

  it('getTopPerformers — 성과 기록 없는 직원은 제외', () => {
    analyzer.registerEmployee('emp001', '인사팀') // 성과 없음
    analyzer.registerEmployee('emp002', '인사팀')
    analyzer.recordPerformance('emp002', 85, '2026-Q1')
    const top = analyzer.getTopPerformers(5)
    expect(top).toHaveLength(1)
    expect(top[0]!.avgScore).toBe(85)
  })
})
