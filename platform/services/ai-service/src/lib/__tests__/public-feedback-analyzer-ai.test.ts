import { describe, it, expect, beforeEach } from 'vitest'
import { PublicFeedbackAnalyzerAi, type FeedbackItem } from '../public-feedback-analyzer-ai'

describe('PublicFeedbackAnalyzerAi', () => {
  let analyzer: PublicFeedbackAnalyzerAi

  const positiveFeedback: FeedbackItem = {
    feedbackId: 'FB001',
    serviceId: 'SVC001',
    userId: 'USR0012345',
    content: '서비스가 빠르고 편리합니다',
    rating: 5,
    submittedAt: new Date().toISOString(),
  }

  beforeEach(() => {
    analyzer = new PublicFeedbackAnalyzerAi()
  })

  it('긍정 피드백 (rating≥4) → POSITIVE', () => {
    const result = analyzer.submitFeedback(positiveFeedback)
    expect(result.sentiment).toBe('POSITIVE')
  })

  it('부정 피드백 (rating≤2) → NEGATIVE', () => {
    const result = analyzer.submitFeedback({ ...positiveFeedback, feedbackId: 'FB002', rating: 1, content: '오류가 너무 많습니다' })
    expect(result.sentiment).toBe('NEGATIVE')
  })

  it('중립 피드백 (rating=3) → NEUTRAL', () => {
    const result = analyzer.submitFeedback({ ...positiveFeedback, feedbackId: 'FB003', rating: 3 })
    expect(result.sentiment).toBe('NEUTRAL')
  })

  it('userId 마스킹 — 원본 노출 없음', () => {
    const result = analyzer.submitFeedback(positiveFeedback)
    expect(result.maskedUserId).not.toBe(positiveFeedback.userId)
    expect(result.maskedUserId.includes('*')).toBe(true)
  })

  it('rating=1 → requiresEscalation true', () => {
    const result = analyzer.submitFeedback({ ...positiveFeedback, feedbackId: 'FB004', rating: 1 })
    expect(result.requiresEscalation).toBe(true)
  })

  it('성능 키워드 → PERFORMANCE 카테고리', () => {
    const result = analyzer.submitFeedback({ ...positiveFeedback, feedbackId: 'FB005', content: '속도가 너무 느립니다' })
    expect(result.category).toBe('PERFORMANCE')
  })

  it('서비스 피드백 요약', () => {
    analyzer.submitFeedback(positiveFeedback)
    analyzer.submitFeedback({ ...positiveFeedback, feedbackId: 'FB006', rating: 1, content: '오류 발생' })
    const summary = analyzer.summarize('SVC001')
    expect(summary.totalFeedback).toBe(2)
    expect(summary.positiveCount).toBe(1)
    expect(summary.negativeCount).toBe(1)
  })

  it('피드백 제출 후 감사 로그', () => {
    analyzer.submitFeedback(positiveFeedback)
    const log = analyzer.getAuditLog()
    expect(log.some((e) => e.action === 'feedback.submit')).toBe(true)
  })
})
