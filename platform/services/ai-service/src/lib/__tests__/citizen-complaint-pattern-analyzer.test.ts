import { describe, it, expect, beforeEach } from 'vitest'
import { CitizenComplaintPatternAnalyzer } from '../citizen-complaint-pattern-analyzer'

describe('CitizenComplaintPatternAnalyzer', () => {
  let ai: CitizenComplaintPatternAnalyzer

  beforeEach(() => {
    ai = new CitizenComplaintPatternAnalyzer()
    ai.registerComplaintType('t1', '소음민원', 5)
  })

  it('유형 등록 감사 로그', () => {
    expect(ai.getAuditLog().some((e) => e.action === 'type.register')).toBe(true)
  })

  it('민원 기록 및 평균 처리일 계산', () => {
    ai.recordComplaint('t1', 'c001', 4)
    ai.recordComplaint('t1', 'c002', 6)
    const stats = ai.getTypeStats('t1')
    expect(stats.count).toBe(2)
    expect(stats.avgProcessingDays).toBe(5)
  })

  it('지연 탐지 — avgProcessingDays > targetDays * 1.2', () => {
    ai.recordComplaint('t1', 'c001', 7)
    ai.recordComplaint('t1', 'c002', 8)
    const stats = ai.getTypeStats('t1')
    expect(stats.isDelayed).toBe(true)
    const delayed = ai.getDelayedTypes()
    expect(delayed.length).toBe(1)
    expect(delayed[0]?.typeId).toBe('t1')
  })

  it('정상 처리일은 지연 아님', () => {
    ai.recordComplaint('t1', 'c001', 4)
    ai.recordComplaint('t1', 'c002', 5)
    expect(ai.getTypeStats('t1').isDelayed).toBe(false)
    expect(ai.getDelayedTypes().length).toBe(0)
  })

  it('지연 시 개선 제안 반환', () => {
    ai.recordComplaint('t1', 'c001', 12)
    const reports = ai.getDelayedTypes()
    expect(reports[0]?.suggestions.length).toBeGreaterThan(0)
  })

  it('PII SHA-256 마스킹 — maskedId 16자', () => {
    ai.recordComplaint('t1', 'citizen-hong', 3)
    const log = ai.getAuditLog().find((e) => e.action === 'complaint.record')!
    expect(log.detail).toContain('t1:')
    const maskedPart = log.detail.split(':')[1]
    expect(maskedPart?.length).toBe(16)
  })

  it('C등급 데이터 차단', () => {
    expect(() => ai.recordComplaint('t1', 'c001', 3, 'C')).toThrow('BLOCKED')
  })

  it('미등록 유형 에러', () => {
    expect(() => ai.getTypeStats('unknown')).toThrow()
  })
})
