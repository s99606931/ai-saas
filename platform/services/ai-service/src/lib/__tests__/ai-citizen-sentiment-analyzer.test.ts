/**
 * 시민 감정 AI 분석기 단위 테스트 — SVC-AI-ADV-R474
 * Plan SC: FR-474.1~6
 */

import { describe, it, expect } from 'vitest';
import { AiCitizenSentimentAnalyzer } from '../ai-citizen-sentiment-analyzer';

describe('AiCitizenSentimentAnalyzer — R474', () => {
  it('FR-474.1: 긍정 텍스트 POSITIVE', () => {
    const a = new AiCitizenSentimentAnalyzer();
    const r = a.analyze('매우 친절하고 신속한 처리에 감사합니다');
    expect(r.label).toBe('POSITIVE');
    expect(r.polarity).toBeGreaterThan(0);
  });

  it('FR-474.2: 부정 텍스트 NEGATIVE', () => {
    const a = new AiCitizenSentimentAnalyzer();
    const r = a.analyze('지연되고 불편하며 실망스럽다');
    expect(r.label).toBe('NEGATIVE');
    expect(r.polarity).toBeLessThan(0);
  });

  it('FR-474.3: 중립 텍스트', () => {
    const a = new AiCitizenSentimentAnalyzer();
    const r = a.analyze('오늘 민원 접수를 했습니다');
    expect(r.label).toBe('NEUTRAL');
  });

  it('FR-474.4: 집계 집합 기본 수치', () => {
    const a = new AiCitizenSentimentAnalyzer();
    const agg = a.aggregate([
      '친절하고 만족',
      '불편하고 실망',
      '좋은 서비스',
      '느리고 나쁨',
      '평범하다',
    ]);
    expect(agg.total).toBe(5);
    expect(agg.positive + agg.neutral + agg.negative).toBe(5);
  });

  it('FR-474.5: audit 로그', () => {
    const a = new AiCitizenSentimentAnalyzer();
    a.analyze('좋은 서비스');
    expect(a.getAuditLog().length).toBeGreaterThan(0);
  });

  it('FR-474.6: C/S 차단', () => {
    const a = new AiCitizenSentimentAnalyzer();
    expect(() => a.analyze('좋다', 'C')).toThrow(/N2SF_BLOCKED/);
  });
});
