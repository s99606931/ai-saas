import { describe, it, expect, beforeEach } from 'vitest'
import { ChatbotManagementAi, type ChatbotConfig, type ChatMessage } from '../chatbot-management-ai'

describe('ChatbotManagementAi', () => {
  let ai: ChatbotManagementAi

  const config: ChatbotConfig = {
    botId: 'BOT001',
    name: '민원 안내 챗봇',
    department: '민원팀',
    dataGrade: 'O',
    maxSessionMinutes: 30,
  }

  const makeMsg = (sessionId: string, input: string, resolved: boolean): ChatMessage => ({
    botId: 'BOT001',
    sessionId,
    userInput: input,
    timestamp: Date.now(),
    resolved,
  })

  beforeEach(() => {
    ai = new ChatbotManagementAi()
    ai.registerBot(config)
  })

  it('C등급 봇 등록 차단', () => {
    expect(() => ai.registerBot({ ...config, botId: 'BOT_C', dataGrade: 'C' })).toThrow('BLOCKED')
  })

  it('S등급 봇 등록 차단', () => {
    expect(() => ai.registerBot({ ...config, botId: 'BOT_S', dataGrade: 'S' })).toThrow('BLOCKED')
  })

  it('봇 등록 감사 로그', () => {
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'bot.register')).toBe(true)
  })

  it('세션 없으면 OFFLINE', () => {
    const report = ai.generateReport('BOT001')
    expect(report.status).toBe('OFFLINE')
    expect(report.totalSessions).toBe(0)
  })

  it('낮은 해결률 → DEGRADED', () => {
    for (let i = 0; i < 10; i++) ai.recordMessage(makeMsg(`S${i}`, '도움이 필요해요', false))
    const report = ai.generateReport('BOT001')
    expect(report.status).toBe('DEGRADED')
    expect(report.alerts.length).toBeGreaterThan(0)
  })

  it('높은 해결률 → ACTIVE', () => {
    for (let i = 0; i < 8; i++) ai.recordMessage(makeMsg(`S${i}`, '민원 신청 방법', true))
    for (let i = 8; i < 10; i++) ai.recordMessage(makeMsg(`S${i}`, '기타 문의', false))
    const report = ai.generateReport('BOT001')
    expect(report.status).toBe('ACTIVE')
    expect(report.resolutionRate).toBeGreaterThan(0.5)
  })

  it('미등록 봇 에러', () => {
    expect(() => ai.generateReport('UNKNOWN')).toThrow()
  })

  it('미등록 봇 메시지 기록 에러', () => {
    expect(() => ai.recordMessage({ ...makeMsg('S1', 'test', true), botId: 'UNKNOWN' })).toThrow()
  })

  it('보고서 생성 후 감사 로그', () => {
    ai.generateReport('BOT001')
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'bot.report')).toBe(true)
  })
})
