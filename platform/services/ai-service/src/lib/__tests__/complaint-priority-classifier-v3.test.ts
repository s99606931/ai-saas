// Plan SC: SVC-AI-ADV-R410
import { describe, it, expect, beforeEach } from 'vitest'
import { ComplaintPriorityClassifierV3 } from '../complaint-priority-classifier-v3'

describe('ComplaintPriorityClassifierV3', () => {
  let classifier: ComplaintPriorityClassifierV3

  beforeEach(() => {
    classifier = new ComplaintPriorityClassifierV3()
  })

  it('submitComplaint — 감사 로그에 maskedId 기록 (PII 보호)', () => {
    classifier.submitComplaint('c1', '도로 파손 민원', 'citizen001')
    const log = classifier.getAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0]!.action).toBe('complaint.submit')
    expect(log[0]!.detail).not.toContain('citizen001')
  })

  it('submitComplaint — maskedSubmitterId는 16자 hex', () => {
    const entry = classifier.submitComplaint('c1', '민원 내용', 'citizen001')
    expect(entry.maskedSubmitterId).toHaveLength(16)
    expect(entry.maskedSubmitterId).not.toBe('citizen001')
  })

  it('submitComplaint — 긴급 키워드 없을 때 urgencyScore=10', () => {
    const entry = classifier.submitComplaint('c1', '도로 파손 민원', 'citizen001')
    expect(entry.urgencyScore).toBe(10)
  })

  it('submitComplaint — 긴급 키워드 1개 시 urgencyScore=40', () => {
    const entry = classifier.submitComplaint('c1', '긴급 도로 파손', 'citizen001')
    expect(entry.urgencyScore).toBe(40) // 10 + 1*30
  })

  it('getPriorityQueue — urgencyScore 내림차순 정렬', () => {
    classifier.submitComplaint('c1', '도로 파손', 'u1')          // score=10
    classifier.submitComplaint('c2', '긴급 화재 신고', 'u2')     // score=10+30+30=70
    classifier.submitComplaint('c3', '위험 사고 발생', 'u3')     // score=10+30+30=70 (같으면 c2 먼저)
    const queue = classifier.getPriorityQueue()
    expect(queue[0]!.urgencyScore).toBeGreaterThanOrEqual(queue[1]!.urgencyScore)
    expect(queue[0]!.urgencyScore).toBeGreaterThan(queue[2]!.urgencyScore)
  })

  it('markCompleted — 완료 후 대기열에서 제외', () => {
    classifier.submitComplaint('c1', '민원', 'u1')
    classifier.markCompleted('c1')
    expect(classifier.getPriorityQueue()).toHaveLength(0)
  })

  it('submitComplaint — C등급 데이터 전송 차단 (N2SF N-05)', () => {
    expect(() => classifier.submitComplaint('c1', '민원', 'u1', 'C')).toThrow('BLOCKED')
  })

  it('submitComplaint — S등급 데이터 전송 차단 (N2SF N-05)', () => {
    expect(() => classifier.submitComplaint('c1', '민원', 'u1', 'S')).toThrow('N2SF N-05')
  })
})
