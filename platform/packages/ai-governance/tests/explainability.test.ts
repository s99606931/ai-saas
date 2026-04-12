// Test Ref: MTU-N465 §explainability
import { describe, it, expect } from 'vitest';
import {
  ExplanationAuditor,
  extractFeatureContributions,
  generateNarrative,
} from '../src/index.js';

const decision = {
  decisionId: 'd1',
  subjectId: 's1',
  features: { credit_score: 700, income: 50_000_000, debt_ratio: 0.3 },
  outcome: 'approved',
  score: 0.82,
  timestamp: '2026-04-11T00:00:00Z',
};
const weights = { credit_score: 0.001, income: 0.00000002, debt_ratio: -1.5 };

describe('extractFeatureContributions — FR-XAI.1', () => {
  it('절댓값 기여도 정렬', () => {
    const c = extractFeatureContributions(decision, weights, 3);
    expect(c.length).toBe(3);
    expect(Math.abs(c[0].contribution)).toBeGreaterThanOrEqual(Math.abs(c[1].contribution));
  });

  it('부호 direction 부여', () => {
    const c = extractFeatureContributions(decision, weights);
    const debt = c.find((x) => x.feature === 'debt_ratio');
    expect(debt?.direction).toBe('negative');
  });
});

describe('generateNarrative — FR-XAI.2/3', () => {
  it('기술적 + 시민 친화 설명 생성', () => {
    const c = extractFeatureContributions(decision, weights);
    const { narrative, citizenFriendly } = generateNarrative(decision, c);
    expect(narrative).toContain('승인');
    expect(citizenFriendly).toContain('귀하');
    expect(citizenFriendly).toContain('이의제기');
  });
});

describe('ExplanationAuditor — FR-XAI.4/5', () => {
  it('설명 생성 + 이의제기 링크 포함', () => {
    const auditor = new ExplanationAuditor();
    const expl = auditor.explain(decision, weights, 'https://saas.gov.kr/appeal');
    expect(expl.appealUrl).toContain('d1');
    expect(expl.topFeatures.length).toBeGreaterThan(0);
  });

  it('설명 해시 감사 기록', () => {
    const auditor = new ExplanationAuditor();
    auditor.explain(decision, weights, 'https://x.kr/a');
    const hist = auditor.history('d1');
    expect(hist.length).toBe(1);
    expect(hist[0].explanationHash).toMatch(/^[0-9a-f]{8}$/);
  });
});
