import { describe, it, expect, beforeEach } from 'vitest'
import { CitizenRequestAutoProcessor } from '../citizen-request-auto-processor'

describe('CitizenRequestAutoProcessor', () => {
  let processor: CitizenRequestAutoProcessor

  beforeEach(() => {
    processor = new CitizenRequestAutoProcessor()
  })

  it('N2SF C등급 민원 처리 차단', () => {
    expect(() => processor.process({ requestId: 'R-1', citizenName: '홍길동', requestType: 'INQUIRY', subject: '문의', body: '내용', attachments: 0, grade: 'C', submittedAt: '2026-04-12' })).toThrow('BLOCKED')
  })

  it('서류 발급 요청 — 자동 처리 완료', () => {
    const result = processor.process({ requestId: 'R-2', citizenName: '김철수', requestType: 'DOCUMENT_REQUEST', subject: '주민등록등본 발급', body: '발급 요청합니다', attachments: 0, submittedAt: '2026-04-12' })
    expect(result.status).toBe('COMPLETED')
    expect(result.autoResolved).toBe(true)
    expect(result.response).toContain('자동으로 처리')
  })

  it('민원 문의 — 자동 처리 완료', () => {
    const result = processor.process({ requestId: 'R-3', citizenName: '이영희', requestType: 'INQUIRY', subject: '시청 운영 시간', body: '궁금합니다', attachments: 0, submittedAt: '2026-04-12' })
    expect(result.autoResolved).toBe(true)
  })

  it('부패 신고 민원 — 민원감사팀 이관', () => {
    const result = processor.process({ requestId: 'R-4', citizenName: '박민수', requestType: 'REPORT', subject: '부패 신고', body: '불법 비리 고발합니다', attachments: 1, submittedAt: '2026-04-12' })
    expect(result.status).toBe('ESCALATED')
    expect(result.escalatedTo).toBe('민원감사팀')
    expect(result.autoResolved).toBe(false)
  })

  it('일반 민원(COMPLAINT) — 담당부서 이관', () => {
    const result = processor.process({ requestId: 'R-5', citizenName: '최지수', requestType: 'COMPLAINT', subject: '도로 파손', body: '보수 요청', attachments: 0, submittedAt: '2026-04-12' })
    expect(result.status).toBe('ESCALATED')
    expect(result.escalatedTo).toBe('담당부서')
  })

  it('감사 로그 복사본 반환', () => {
    processor.process({ requestId: 'R-6', citizenName: '테스터', requestType: 'INQUIRY', subject: '문의', body: '내용', attachments: 0, submittedAt: '2026-04-12' })
    const log = processor.getAuditLog()
    log.push({ timestamp: '', action: 'injected', requestId: 'X', detail: {} })
    expect(processor.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
