import { describe, it, expect, beforeEach } from 'vitest'
import { PublicServiceChatbotEnhancerV3 } from '../public-service-chatbot-enhancer-v3'

describe('PublicServiceChatbotEnhancerV3', () => {
  let bot: PublicServiceChatbotEnhancerV3

  beforeEach(() => {
    bot = new PublicServiceChatbotEnhancerV3()
  })

  it('N2SF S등급 라우팅 차단', () => {
    expect(() => bot.route('민원', 'S')).toThrow('BLOCKED')
  })

  it('도메인 등록 및 라우팅 — 일치 시 해당 도메인 반환', () => {
    bot.registerDomain({ domainId: 'tax', keywords: ['세금', '신고'], persona: '세무 안내' })
    const result = bot.route('세금 신고 방법')
    expect(result.domainId).toBe('tax')
    expect(result.fallback).toBe(false)
  })

  it('낮은 신뢰도 시 fallback general 도메인', () => {
    bot.registerDomain({ domainId: 'tax', keywords: ['세금'], persona: 'X' })
    const result = bot.route('오늘 날씨 어떤가요')
    expect(result.fallback).toBe(true)
    expect(result.domainId).toBe('general')
  })

  it('PII 마스킹: 이메일이 utteranceMasked에 해시로', () => {
    bot.registerDomain({ domainId: 'help', keywords: ['도움'], persona: 'X' })
    const result = bot.route('도움 admin@gov.kr')
    expect(result.utteranceMasked).not.toContain('admin@gov.kr')
    expect(result.utteranceMasked).toMatch(/[a-f0-9]{16}/)
  })

  it("'general' 도메인 직접 등록 시도 차단", () => {
    expect(() =>
      bot.registerDomain({ domainId: 'general', keywords: [], persona: 'X' }),
    ).toThrow('Reserved')
  })

  it('감사 로그 복사본 반환', () => {
    bot.registerDomain({ domainId: 'tax', keywords: ['세금'], persona: 'X' })
    const log = bot.getAuditLog()
    log.push({ timestamp: '', action: 'injected', domainId: 'X', detail: {} })
    expect(bot.getAuditLog().some((e) => e.action === 'injected')).toBe(false)
  })
})
