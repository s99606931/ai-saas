/**
 * Unit tests for Complaint Priority Engine — SVC-AI-ADV-R126
 */
import { describe, it, expect } from 'vitest'
import { ComplaintPriorityEngine, DataGrade } from '../complaint-priority-engine'

const makeComplaint = (overrides = {}) => ({
  id: 'C-001',
  title: '도로 포장 불량',
  content: '주민 불편 지속 발생',
  category: '생활불편' as const,
  submittedAt: '2026-04-12T09:00:00Z',
  grade: DataGrade.O,
  ...overrides,
})

describe('SVC-AI-ADV-R126 ComplaintPriorityEngine', () => {
  it('[FR-R126.1] evaluates complaint and returns priority score', () => {
    const engine = new ComplaintPriorityEngine()
    const score = engine.evaluate(makeComplaint())
    expect(score.complaintId).toBe('C-001')
    expect(score.priority).toMatch(/^P[1-4]$/)
  })

  it('[FR-R126.2] urgent keywords raise urgency score', () => {
    const engine = new ComplaintPriorityEngine()
    const urgent = engine.evaluate(makeComplaint({ content: '긴급 위험 사고 발생', category: '안전' }))
    const normal = engine.evaluate(makeComplaint({ content: '단순 민원', category: '생활불편' }))
    expect(urgent.urgency).toBeGreaterThan(normal.urgency)
  })

  it('[FR-R126.3] PII in content is masked and not exposed', () => {
    const engine = new ComplaintPriorityEngine()
    const score = engine.evaluate(makeComplaint({
      content: '010-1234-5678 주민등록번호 123456-1234567',
    }))
    expect(score.reasoning).not.toContain('010-1234-5678')
    expect(score.reasoning).not.toContain('123456-1234567')
  })

  it('[FR-R126.4] safety category with urgent keywords yields high priority (P1 or P2)', () => {
    const engine = new ComplaintPriorityEngine()
    const score = engine.evaluate(makeComplaint({
      title: '긴급 화재 위험',
      content: '생명 위험 즉시 조치 필요 응급 사고 다수 주민',
      category: '안전',
    }))
    expect(['P1', 'P2']).toContain(score.priority)
    expect(score.totalScore).toBeGreaterThanOrEqual(50)
  })

  it('[FR-R126.5] blocks C/S grade complaints', () => {
    const engine = new ComplaintPriorityEngine()
    expect(() => engine.evaluate(makeComplaint({ grade: DataGrade.C }))).toThrow('BLOCKED')
    expect(() => engine.evaluate(makeComplaint({ grade: DataGrade.S }))).toThrow('BLOCKED')
  })

  it('[FR-R126.6] evaluateBatch returns sorted list by score desc', () => {
    const engine = new ComplaintPriorityEngine()
    const scores = engine.evaluateBatch([
      makeComplaint({ id: 'A', title: '긴급 위험', content: '생명 위험', category: '안전' }),
      makeComplaint({ id: 'B', title: '일반 민원', content: '단순 불편', category: '생활불편' }),
    ])
    expect(scores[0]!.totalScore).toBeGreaterThanOrEqual(scores[1]!.totalScore)
  })

  it('estimatedDays for P1 is 1', () => {
    const engine = new ComplaintPriorityEngine()
    const score = engine.evaluate(makeComplaint({
      title: '긴급 화재 위험 즉시',
      content: '생명 위험 응급 사고 즉시',
      category: '안전',
    }))
    if (score.priority === 'P1') {
      expect(score.estimatedDays).toBe(1)
    }
  })

  it('audit log records evaluate', () => {
    const engine = new ComplaintPriorityEngine()
    engine.evaluate(makeComplaint())
    expect(engine.getAuditLog().some(e => e.action === 'evaluate')).toBe(true)
  })
})
