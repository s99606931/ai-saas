import { describe, it, expect, beforeEach } from 'vitest'
import { PublicServiceChatbotV2 } from '../public-service-chatbot-v2'

describe('PublicServiceChatbotV2', () => {
  let chatbot: PublicServiceChatbotV2

  beforeEach(() => {
    chatbot = new PublicServiceChatbotV2()
  })

  it('N2SF C등급 세션 생성 차단', () => {
    expect(() => chatbot.startSession('S1', 'persona', 'C')).toThrow('BLOCKED')
  })

  it('N2SF S등급 세션 생성 차단', () => {
    expect(() => chatbot.startSession('S2', 'persona', 'S')).toThrow('BLOCKED')
  })

  it('O등급 세션 정상 생성', () => {
    const session = chatbot.startSession('S3', '공공서비스봇', 'O')
    expect(session.sessionId).toBe('S3')
    expect(session.grade).toBe('O')
  })

  it('턴 추가 및 컨텍스트 조회 (슬라이딩 윈도우)', () => {
    chatbot.startSession('S4', 'bot', 'O')
    chatbot.addTurn('S4', 'user', '안녕하세요')
    chatbot.addTurn('S4', 'assistant', '반갑습니다')
    chatbot.addTurn('S4', 'user', '민원 신청 방법은?')
    const ctx = chatbot.getContext('S4', 2)
    expect(ctx.length).toBe(2)
    expect(ctx[1]!.content).toBe('민원 신청 방법은?')
  })

  it('세션 종료 후 턴 추가 시 오류', () => {
    chatbot.startSession('S5', 'bot', 'O')
    chatbot.endSession('S5')
    expect(() => chatbot.addTurn('S5', 'user', '계속')).toThrow('Session ended')
  })

  it('세션 요약: 키워드 + 턴 수 포함', () => {
    chatbot.startSession('S6', 'bot', 'O')
    chatbot.addTurn('S6', 'user', '민원 신청 민원 처리 민원')
    const summary = chatbot.summarizeSession('S6')
    expect(summary.keywords).toContain('민원')
    expect(summary.turnCount).toBe(1)
  })

  it('감사 로그 복사본 반환 확인', () => {
    chatbot.startSession('S7', 'bot', 'O')
    const log = chatbot.getAuditLog()
    log.push({ timestamp: '', action: 'injected', sessionId: 'X', detail: {} })
    expect(chatbot.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
