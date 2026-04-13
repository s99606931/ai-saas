// Plan SC: SVC-AI-ADV-R395-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { PublicTaskRiskAssessorAI, type PublicTask } from '../public-task-risk-assessor-ai'

describe('PublicTaskRiskAssessorAI', () => {
  let assessor: PublicTaskRiskAssessorAI

  beforeEach(() => {
    assessor = new PublicTaskRiskAssessorAI()
  })

  const futureDate = (daysFromNow: number): string => {
    const d = new Date(Date.now() + daysFromNow * 24 * 3600 * 1000)
    return d.toISOString().split('T')[0] ?? d.toISOString()
  }

  const baseTask: PublicTask = {
    taskId: 'T1',
    title: '일반 행정 처리',
    department: '총무과',
    deadline: futureDate(30),
    budget: 100_000_000,
    stakeholderCount: 3,
    involvesPII: false,
    requiresExternal: false,
    grade: 'O',
  }

  it('N2SF: C등급 업무 등록 차단', () => {
    expect(() => assessor.registerTask({ ...baseTask, taskId: 'T-C', grade: 'C' })).toThrow('BLOCKED')
  })

  it('N2SF: S등급 업무 등록 차단', () => {
    expect(() => assessor.registerTask({ ...baseTask, taskId: 'T-S', grade: 'S' })).toThrow('BLOCKED')
  })

  it('미등록 업무 평가 시 오류 발생', () => {
    expect(() => assessor.assess('UNKNOWN')).toThrow('Unknown task')
  })

  it('마감 여유, 소규모 → LOW 위험도', () => {
    assessor.registerTask(baseTask)
    const result = assessor.assess('T1')
    expect(result.riskLevel).toBe('LOW')
    expect(result.riskScore).toBeLessThan(20)
  })

  it('마감 임박(7일 이내) → 위험도 상승', () => {
    assessor.registerTask({ ...baseTask, taskId: 'T-NEAR', deadline: futureDate(5) })
    const result = assessor.assess('T-NEAR')
    expect(result.riskScore).toBeGreaterThanOrEqual(20)
  })

  it('기한 초과 → 위험도 대폭 상승', () => {
    assessor.registerTask({ ...baseTask, taskId: 'T-OVER', deadline: futureDate(-1) })
    const result = assessor.assess('T-OVER')
    expect(result.riskScore).toBeGreaterThanOrEqual(30)
  })

  it('대규모 예산 + PII + 외부 의존 + 마감 임박 → CRITICAL', () => {
    assessor.registerTask({
      ...baseTask,
      taskId: 'T-HIGH',
      budget: 600_000_000,
      stakeholderCount: 12,
      involvesPII: true,
      requiresExternal: true,
      deadline: futureDate(3),
    })
    const result = assessor.assess('T-HIGH')
    expect(result.riskLevel).toBe('CRITICAL')
    expect(result.riskFactors.length).toBeGreaterThan(0)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    assessor.registerTask(baseTask)
    assessor.assess('T1')
    const log1 = assessor.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', taskId: 'X', detail: {} })
    const log2 = assessor.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
