/**
 * 정부 챗봇 응답 품질 평가기 단위 테스트 — SVC-AI-ADV-R464
 * Plan SC: FR-464.1~7
 */

import { describe, it, expect } from 'vitest';
import { GovChatbotQualityEvaluator } from '../gov-chatbot-quality-evaluator';

describe('GovChatbotQualityEvaluator — R464', () => {
  it('FR-464.2/3: 모든 키워드 포함 시 높은 점수', () => {
    const e = new GovChatbotQualityEvaluator();
    const r = e.evaluate({
      question: '세금 납부',
      answer: '세금은 홈택스에서 납부 가능합니다',
      keywords: ['세금', '홈택스', '납부'],
    });
    expect(r.relevance).toBe(100);
    expect(r.grade).toBe('A');
  });

  it('FR-464.4: 긴 답변일수록 clarity 감점', () => {
    const e = new GovChatbotQualityEvaluator();
    const long = 'x'.repeat(300);
    const r = e.evaluate({
      question: 'q',
      answer: long + '세금',
      keywords: ['세금'],
    });
    expect(r.clarity).toBeLessThan(100);
  });

  it('FR-464.6: 점수별 등급 반환', () => {
    const e = new GovChatbotQualityEvaluator();
    const r = e.evaluate({
      question: 'q',
      answer: '무관한 답변',
      keywords: ['세금', '홈택스'],
    });
    expect(['C', 'D']).toContain(r.grade);
  });

  it('FR-464.7: C 등급 차단', () => {
    const e = new GovChatbotQualityEvaluator();
    expect(() =>
      e.evaluate({ question: 'q', answer: 'a', keywords: ['k'] }, 'C'),
    ).toThrow(/N2SF_BLOCKED/);
  });

  it('FR-464.1: 빈 답변/키워드 에러', () => {
    const e = new GovChatbotQualityEvaluator();
    expect(() => e.evaluate({ question: 'q', answer: '', keywords: ['k'] })).toThrow();
    expect(() => e.evaluate({ question: 'q', answer: 'a', keywords: [] })).toThrow();
  });

  it('FR-464.7: audit log', () => {
    const e = new GovChatbotQualityEvaluator();
    e.evaluate({ question: 'q', answer: '답변', keywords: ['답'] });
    expect(e.getAuditLog().length).toBeGreaterThan(0);
  });
});
