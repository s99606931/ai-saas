// MTU-N358 민원 피드백 분류 테스트
import { describe, it, expect } from 'vitest';
import { CitizenFeedbackCategorizerService } from '../citizen-feedback-categorizer.js';

describe('MTU-N358 CitizenFeedbackCategorizer', () => {
  const svc = new CitizenFeedbackCategorizerService('tenant-n358');

  it('FR-N358.1: 카테고리 정의', () => {
    const cat = svc.define('complaint', ['불만', '느림'], 1);
    expect(cat).toBeDefined();
  });

  it('FR-N358.2: 분류', () => {
    svc.define('positive', ['좋음', '감사'], 2);
    const result = svc.categorize({
      feedbackId: 'f1',
      content: '서비스 정말 좋음',
      source: 'web',
      submittedAt: '2026-04-11',
    });
    expect(result).toBeDefined();
  });

  it('FR-N358.3: 배치 분류', () => {
    const results = svc.batch([
      { feedbackId: 'f1', content: '불만 사항', source: 'phone', submittedAt: '2026-04-11' },
      { feedbackId: 'f2', content: '좋은 정책', source: 'web', submittedAt: '2026-04-11' },
    ]);
    expect(results.length).toBe(2);
  });

  it('FR-N358.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
