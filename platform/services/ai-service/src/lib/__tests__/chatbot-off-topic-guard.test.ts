/**
 * Unit tests for Chatbot Off-Topic Guard — SVC-AI-ADV-R106
 */

import { describe, it, expect } from 'vitest'
import { ChatbotOffTopicGuard } from '../chatbot-off-topic-guard'

describe('SVC-AI-ADV-R106 ChatbotOffTopicGuard', () => {
  it('[FR-R106.2] classifies in-scope query', () => {
    const g = new ChatbotOffTopicGuard()
    g.registerDomain(['민원', '복지', '세금'])
    const result = g.classify('민원 신청 방법 알려주세요')
    expect(result.verdict).toBe('IN_SCOPE')
    expect(result.matchedKeywords).toContain('민원')
  })

  it('[FR-R106.2] classifies off-topic query', () => {
    const g = new ChatbotOffTopicGuard()
    g.registerDomain(['민원'])
    const result = g.classify('오늘 날씨가 어때요?')
    expect(result.verdict).toBe('OFF_TOPIC')
    expect(result.suggestedFallback).toBeTruthy()
  })

  it('[FR-R106.2] classifies forbidden query', () => {
    const g = new ChatbotOffTopicGuard()
    g.registerDomain(['민원'])
    const result = g.classify('대통령 선거는 언제인가요?')
    expect(result.verdict).toBe('FORBIDDEN')
    expect(result.matchedKeywords.length).toBeGreaterThan(0)
  })

  it('[FR-R106.4] stats counts classifications', () => {
    const g = new ChatbotOffTopicGuard()
    g.registerDomain(['민원'])
    g.classify('민원 문의')
    g.classify('아무말')
    g.classify('선거')
    const stats = g.stats()
    expect(stats.total).toBe(3)
    expect(stats.offTopic).toBe(1)
    expect(stats.forbidden).toBe(1)
  })

  it('[FR-R106.1] custom forbidden keywords', () => {
    const g = new ChatbotOffTopicGuard()
    g.registerDomain(['민원'], ['도박'])
    const result = g.classify('도박 사이트 문의')
    expect(result.verdict).toBe('FORBIDDEN')
  })

  it('[FR-R106.3] fallback provides message', () => {
    const g = new ChatbotOffTopicGuard()
    g.registerDomain(['민원'])
    const result = g.classify('xxx')
    expect(result.suggestedFallback).toContain('죄송')
  })

  it('[FR-R106.4] reset clears counters', () => {
    const g = new ChatbotOffTopicGuard()
    g.registerDomain(['민원'])
    g.classify('xxx')
    g.reset()
    expect(g.stats().total).toBe(0)
  })
})
