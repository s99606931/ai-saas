import { describe, it, expect } from 'vitest';
import { LLMOutputQuality } from '../llm-output-quality';

describe('LLMOutputQuality', () => {
  const svc = new LLMOutputQuality();

  it('scores high faithfulness when answer grounded in context', () => {
    const score = svc.scoreFaithfulness({
      question: '수도는?',
      context: '대한민국의 수도는 서울입니다. 서울은 한강을 끼고 있습니다.',
      answer: '대한민국의 수도는 서울입니다.',
    });
    expect(score).toBeGreaterThan(0.5);
  });

  it('scores low faithfulness when answer has no support', () => {
    const score = svc.scoreFaithfulness({
      question: '수도는?',
      context: '대한민국의 수도는 서울입니다.',
      answer: '일본의 수도는 파리입니다.',
    });
    expect(score).toBeLessThan(0.8);
  });

  it('scores coherence', () => {
    const score = svc.scoreCoherence('첫 문장입니다. 두 번째 문장입니다. 세 번째 문장입니다.');
    expect(score).toBeGreaterThan(0.5);
  });

  it('scores relevance based on question keywords', () => {
    const score = svc.scoreRelevance({
      question: '서울 인구',
      context: '',
      answer: '서울의 인구는 약 950만 명입니다.',
    });
    expect(score).toBeGreaterThan(0.5);
  });

  it('detects hallucination with unsupported numbers', () => {
    const risk = svc.scoreHallucinationRisk({
      question: '인구?',
      context: '서울 인구는 950만',
      answer: '서울 인구는 9999만, 부산은 8888만입니다.',
    });
    expect(risk).toBeGreaterThan(0.3);
  });

  it('evaluates overall with pass/regenerate decision', () => {
    const verdict = svc.evaluate({
      question: '수도는 어디인가',
      context: '대한민국 수도는 서울. 서울은 한강에 있다.',
      answer: '대한민국 수도는 서울입니다. 한강이 지나갑니다.',
    });
    expect(verdict.scores.overall).toBeGreaterThan(0);
    expect(typeof verdict.passed).toBe('boolean');
  });
});
