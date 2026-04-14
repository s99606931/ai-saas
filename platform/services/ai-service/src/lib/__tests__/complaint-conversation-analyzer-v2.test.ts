import { describe, it, expect, beforeEach } from 'vitest'
import { ComplaintConversationAnalyzerV2 } from '../complaint-conversation-analyzer-v2'

describe('ComplaintConversationAnalyzerV2', () => {
  let analyzer: ComplaintConversationAnalyzerV2

  beforeEach(() => {
    analyzer = new ComplaintConversationAnalyzerV2()
  })

  it('대화 등록 후 조회 가능', () => {
    const convo = analyzer.registerConversation('conv-1', 'citizen-1', 'phone')
    expect(convo.conversationId).toBe('conv-1')
    expect(convo.channel).toBe('phone')
  })

  it('메시지 추가 후 감정 통계 계산', () => {
    analyzer.registerConversation('conv-1', 'citizen-1', 'phone')
    analyzer.addMessage('conv-1', '감사합니다', 'positive')
    analyzer.addMessage('conv-1', '보통이에요', 'neutral')
    const stats = analyzer.getSentimentStats('conv-1')
    expect(stats.positive).toBeCloseTo(0.5, 1)
    expect(stats.neutral).toBeCloseTo(0.5, 1)
    expect(stats.negative).toBe(0)
  })

  it('메시지 없으면 통계 0', () => {
    analyzer.registerConversation('conv-1', 'citizen-1', 'phone')
    const stats = analyzer.getSentimentStats('conv-1')
    expect(stats.positive).toBe(0)
    expect(stats.negative).toBe(0)
  })

  it('getNegativeConversations: negative 비율 50% 초과', () => {
    analyzer.registerConversation('conv-1', 'citizen-1', 'phone')
    analyzer.registerConversation('conv-2', 'citizen-2', 'web')
    analyzer.addMessage('conv-1', '불만이에요', 'negative')
    analyzer.addMessage('conv-1', '또 불만', 'negative')
    analyzer.addMessage('conv-1', '그나마', 'positive')
    analyzer.addMessage('conv-2', '좋아요', 'positive')
    const negative = analyzer.getNegativeConversations()
    expect(negative.map((c) => c.conversationId)).toContain('conv-1')
    expect(negative.map((c) => c.conversationId)).not.toContain('conv-2')
  })

  it('C등급 데이터 전송 차단', () => {
    analyzer.registerConversation('conv-1', 'citizen-1', 'phone')
    expect(() => analyzer.addMessage('conv-1', '내용', 'positive', 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    analyzer.registerConversation('conv-1', 'citizen-1', 'phone')
    expect(() => analyzer.addMessage('conv-1', '내용', 'positive', 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    analyzer.registerConversation('conv-1', 'citizen-1', 'phone')
    analyzer.addMessage('conv-1', '내용', 'positive')
    const log = analyzer.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
