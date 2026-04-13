// Design Ref: §R386 — AI기반 공공기관 대화형 AI 어시스턴트
import { describe, it, expect, beforeEach } from 'vitest'
import { PublicConversationalAiAssistant } from '../public-conversational-ai-assistant'

describe('PublicConversationalAiAssistant', () => {
  let assistant: PublicConversationalAiAssistant

  beforeEach(() => {
    assistant = new PublicConversationalAiAssistant()
  })

  it('N2SF: C등급 세션 생성 차단', () => {
    expect(() => assistant.createSession({ sessionId: 's1', userId: 'user01', department: 'IT', language: 'ko', dataGrade: 'C' }))
      .toThrow('BLOCKED')
  })

  it('N2SF: S등급 세션 생성 차단', () => {
    expect(() => assistant.createSession({ sessionId: 's2', userId: 'user01', department: 'IT', language: 'ko', dataGrade: 'S' }))
      .toThrow('BLOCKED')
  })

  it('COMPLAINT_INQUIRY: 민원 키워드 인텐트 매칭', () => {
    assistant.createSession({ sessionId: 's3', userId: 'user123456', department: '행정', language: 'ko', dataGrade: 'O' })
    const result = assistant.respond({ sessionId: 's3', turnId: 't1', userMessage: '민원 신청 방법 알려주세요', timestamp: Date.now() })
    expect(result.intent).toBe('COMPLAINT_INQUIRY')
    expect(result.requiresHumanHandoff).toBe(false)
  })

  it('DOCUMENT_REQUEST: 서류 발급 인텐트 매칭', () => {
    assistant.createSession({ sessionId: 's4', userId: 'user654321', department: '행정', language: 'ko', dataGrade: 'O' })
    const result = assistant.respond({ sessionId: 's4', turnId: 't1', userMessage: '주민등록증명서 발급 신청서 필요합니다', timestamp: Date.now() })
    expect(result.intent).toBe('DOCUMENT_REQUEST')
  })

  it('UNKNOWN: 알 수 없는 인텐트 → 인간 핸드오프 필요', () => {
    assistant.createSession({ sessionId: 's5', userId: 'user789012', department: '행정', language: 'ko', dataGrade: 'O' })
    const result = assistant.respond({ sessionId: 's5', turnId: 't1', userMessage: '뜬금없는 질문', timestamp: Date.now() })
    expect(result.intent).toBe('UNKNOWN')
    expect(result.requiresHumanHandoff).toBe(true)
  })

  it('PII: userId 응답에서 마스킹', () => {
    assistant.createSession({ sessionId: 's6', userId: 'user123456', department: '행정', language: 'ko', dataGrade: 'O' })
    const result = assistant.respond({ sessionId: 's6', turnId: 't1', userMessage: '납부 요금 조회', timestamp: Date.now() })
    expect(result.maskedUserId).not.toBe('user123456')
    expect(result.maskedUserId).toContain('*')
  })

  it('감사 로그에 세션 생성 및 응답 기록', () => {
    assistant.createSession({ sessionId: 's7', userId: 'user111222', department: '행정', language: 'ko', dataGrade: 'O' })
    assistant.respond({ sessionId: 's7', turnId: 't1', userMessage: '업무 운영시간', timestamp: Date.now() })
    const logs = assistant.getAuditLog()
    expect(logs.some((l) => l.action === 'session.create')).toBe(true)
    expect(logs.some((l) => l.action === 'assistant.respond')).toBe(true)
  })
})
