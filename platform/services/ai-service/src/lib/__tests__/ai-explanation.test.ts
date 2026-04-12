import { describe, it, expect, beforeEach } from 'vitest';
import { AiExplanation, type AiDecision } from '../ai-explanation';

describe('AiExplanation', () => {
  let svc: AiExplanation;
  const decision: AiDecision = {
    decisionId: 'd1',
    modelId: 'm-complaint',
    outcome: '승인',
    contributions: [
      { feature: '소득', value: 30000, weight: 0.5 },
      { feature: '가족수', value: 4, weight: 0.3 },
      { feature: '지역', value: '서울', weight: -0.1 },
      { feature: '연령', value: 45, weight: 0.05 },
    ],
    timestamp: '2026-04-11T00:00:00Z',
  };

  beforeEach(() => {
    svc = new AiExplanation();
  });

  it('FR-XAI.1 feature 중요도', () => {
    const top = svc.extractImportance(decision, 2);
    expect(top.length).toBe(2);
    expect(top[0]!.feature).toBe('소득');
  });

  it('FR-XAI.2 설명 생성', () => {
    const exp = svc.generateExplanation(decision);
    expect(exp.summary).toContain('m-complaint');
    expect(exp.details.length).toBe(3);
  });

  it('FR-XAI.3 민원인 친화 포맷', () => {
    const exp = svc.generateExplanation(decision);
    const formatted = svc.formatForCitizen(exp);
    expect(formatted).toContain('결정 사유');
    expect(formatted).toContain('세부 근거');
  });

  it('FR-XAI.4 이의제기 링크', () => {
    const exp = svc.generateExplanation(decision);
    expect(exp.appealLink).toContain('/appeals/new');
  });

  it('FR-XAI.5 감사 로그', () => {
    svc.logDelivery('d1', 'citizen-1');
    expect(svc.getAuditLog().length).toBe(1);
  });
});
