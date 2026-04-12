// MTU-N326 감성 분석 엔진 테스트
import { describe, it, expect } from 'vitest';
import { SentimentAnalysisService } from '../sentiment-analysis-engine.js';

describe('MTU-N326 SentimentAnalysis', () => {
  const svc = new SentimentAnalysisService('tenant-n326');

  const inputs = [
    { textId: 't1', text: '서비스가 정말 좋아요', source: 'survey', category: 'satisfaction' },
    { textId: 't2', text: '불만족스럽고 느립니다', source: 'survey', category: 'complaint' },
  ];

  it('FR-N326.1: 단일 분석', () => {
    const first = inputs[0];
    if (!first) throw new Error('fixture missing');
    const result = svc.analyze(first);
    expect(result).toBeDefined();
  });

  it('FR-N326.2: 배치 분석', () => {
    const results = svc.analyzeBatch(inputs);
    expect(results.length).toBe(2);
  });

  it('FR-N326.3: 트렌드 계산', () => {
    const results = svc.analyzeBatch(inputs);
    const trend = svc.trend(results, '2026-04');
    expect(trend).toBeDefined();
  });

  it('FR-N326.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
