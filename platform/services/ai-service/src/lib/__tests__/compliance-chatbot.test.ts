import { describe, it, expect, beforeEach } from 'vitest'
import { ComplianceChatbot } from '../compliance-chatbot'
import type { ComplianceRule } from '../compliance-chatbot'

const CSAP_RULE: ComplianceRule = {
  id: 'D-08-01', standard: 'CSAP', title: '접근 통제',
  description: '모든 API에 RBAC 적용 필수', keywords: ['접근', '인증', 'RBAC', 'API'],
  severity: 'high',
}
const N2SF_RULE: ComplianceRule = {
  id: 'N-05-01', standard: 'N2SF', title: 'AI API 데이터 등급',
  description: 'C/S 등급 데이터 AI API 전송 금지', keywords: ['C등급', 'S등급', 'AI', '전송금지'],
  severity: 'high',
}

describe('ComplianceChatbot', () => {
  let chatbot: ComplianceChatbot

  beforeEach(() => {
    chatbot = new ComplianceChatbot()
    chatbot.registerRule(CSAP_RULE)
    chatbot.registerRule(N2SF_RULE)
  })

  it('N2SF C등급 질의 차단', () => {
    expect(() => chatbot.chat('S1', 'CSAP 접근 통제', 'C')).toThrow('BLOCKED')
  })

  it('N2SF S등급 질의 차단', () => {
    expect(() => chatbot.chat('S2', 'N2SF 규정', 'S')).toThrow('BLOCKED')
  })

  it('키워드 일치 규정 반환', () => {
    const reply = chatbot.chat('S3', 'RBAC 인증 규정 알려줘')
    expect(reply.referenceIds).toContain('D-08-01')
    expect(reply.content).toContain('관련 규정')
  })

  it('일치 규정 없으면 안내 메시지', () => {
    const reply = chatbot.chat('S4', '완전히 무관한 주제')
    expect(reply.content).toContain('찾지 못했습니다')
    expect(reply.referenceIds?.length).toBe(0)
  })

  it('멀티턴 대화 이력 누적', () => {
    chatbot.chat('S5', '접근 통제 규정')
    chatbot.chat('S5', 'S등급 데이터 처리')
    const history = chatbot.getHistory('S5')
    expect(history.length).toBe(4)  // user+assistant × 2턴
  })

  it('존재하지 않는 세션 이력 빈 배열', () => {
    expect(chatbot.getHistory('NO_SESSION')).toEqual([])
  })

  it('감사 로그 복사본 반환', () => {
    chatbot.chat('S6', '규정 질의')
    const log = chatbot.getAuditLog()
    log.push({ timestamp: '', action: 'injected', sessionId: 'X', detail: {} })
    expect(chatbot.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
