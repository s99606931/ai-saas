import { describe, it, expect, beforeEach } from 'vitest'
import { ComplaintPriorityClassifierV2, type ComplaintV2 } from '../complaint-priority-classifier-v2'

describe('ComplaintPriorityClassifierV2', () => {
  let classifier: ComplaintPriorityClassifierV2

  beforeEach(() => {
    classifier = new ComplaintPriorityClassifierV2()
  })

  const makeComplaint = (overrides: Partial<ComplaintV2> & { complaintId: string }): ComplaintV2 => ({
    title: '일반 민원',
    body: '내용',
    channel: 'ONLINE',
    submittedAt: new Date().toISOString(),
    ...overrides,
  })

  // N2SF N-05 등급 차단
  it('C등급 민원 처리 차단', () => {
    const c = makeComplaint({ complaintId: 'c1', grade: 'C' })
    expect(() => classifier.classify(c)).toThrow('BLOCKED')
  })

  it('S등급 민원 처리 차단', () => {
    const c = makeComplaint({ complaintId: 'c1', grade: 'S' })
    expect(() => classifier.classify(c)).toThrow('BLOCKED')
  })

  // CRITICAL 분류
  it('긴급 키워드 → CRITICAL', () => {
    const c = makeComplaint({ complaintId: 'c1', title: '긴급 화재 사망 위험', body: '응급 상황' })
    const result = classifier.classify(c)
    expect(result.priority).toBe('CRITICAL')
    expect(result.estimatedResponseHours).toBe(2)
  })

  // HIGH 분류
  it('고위험 키워드 → HIGH', () => {
    const c = makeComplaint({ complaintId: 'c2', title: '불법 행위', body: '즉시 처리 요망 비리' })
    const result = classifier.classify(c)
    expect(['HIGH', 'CRITICAL']).toContain(result.priority)
  })

  // 반복 민원 가중치
  it('반복 민원 우선순위 상승', () => {
    const normal = makeComplaint({ complaintId: 'c3', title: '일반 문의', body: '문의 사항' })
    const repeat = makeComplaint({ complaintId: 'c4', title: '일반 문의', body: '문의 사항', isRepeat: true })
    const r1 = classifier.classify(normal)
    const r2 = classifier.classify(repeat)
    expect(r2.priorityScore).toBeGreaterThan(r1.priorityScore)
  })

  // 대기일수 가중치
  it('30일 이상 대기 우선순위 상승', () => {
    const fresh = makeComplaint({ complaintId: 'c5', title: '문의', body: '내용', daysWaiting: 0 })
    const old = makeComplaint({ complaintId: 'c6', title: '문의', body: '내용', daysWaiting: 35 })
    const r1 = classifier.classify(fresh)
    const r2 = classifier.classify(old)
    expect(r2.priorityScore).toBeGreaterThan(r1.priorityScore)
  })

  // 채널별 점수
  it('방문 민원이 온라인보다 높은 기본 점수', () => {
    const online = makeComplaint({ complaintId: 'c7', title: '문의', body: '내용', channel: 'ONLINE' })
    const visit = makeComplaint({ complaintId: 'c8', title: '문의', body: '내용', channel: 'VISIT' })
    const r1 = classifier.classify(online)
    const r2 = classifier.classify(visit)
    expect(r2.priorityScore).toBeGreaterThan(r1.priorityScore)
  })

  // 큐 배정
  it('우선순위별 큐 배정', () => {
    const c = makeComplaint({ complaintId: 'c9', title: '긴급', body: '화재 위험' })
    const result = classifier.classify(c)
    expect(result.assignedQueue).toContain('QUEUE-')
  })

  // 감사 로그
  it('분류 후 감사 로그 기록', () => {
    classifier.classify(makeComplaint({ complaintId: 'c10', title: '일반', body: '내용' }))
    const log = classifier.getAuditLog()
    expect(log.some((e) => e.action === 'classify')).toBe(true)
  })
})
