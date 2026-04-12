/**
 * AI 영향 평가 테스트
 * Plan SC: FR-AIA.1~5
 */

import {
  AiRiskClassifier,
  AiaObligationChecker,
  AiaReviewScheduler,
  AiSystem,
} from '../src/ai-impact-assessment';

const baseSystem = (overrides: Partial<AiSystem> = {}): AiSystem => ({
  systemId: 's1',
  name: 'AI 챗봇',
  useCase: 'inquiry-handler',
  deployed: true,
  affectedSubjects: 100,
  automatedDecision: false,
  humanInLoop: true,
  ...overrides,
});

describe('AiRiskClassifier', () => {
  const c = new AiRiskClassifier();

  it('금지 용도 → unacceptable', () => {
    const r = c.classify(baseSystem({ useCase: 'social-scoring' }));
    expect(r.level).toBe('unacceptable');
    expect(r.reasons[0]).toContain('금지 용도');
  });

  it('고위험 용도 단독 → limited (1개 이유)', () => {
    const r = c.classify(baseSystem({ useCase: 'employment-recruitment' }));
    expect(r.level).toBe('limited');
  });

  it('고위험 용도 + 10만+ 영향 → high (2개+ 이유)', () => {
    const r = c.classify(
      baseSystem({ useCase: 'employment-recruitment', affectedSubjects: 200000 }),
    );
    expect(r.level).toBe('high');
  });

  it('자동결정 + no human in loop → +1 reason', () => {
    const r = c.classify(
      baseSystem({
        useCase: 'inquiry-handler',
        automatedDecision: true,
        humanInLoop: false,
      }),
    );
    expect(r.level).toBe('limited');
  });

  it('전혀 위험 없는 시스템 → minimal', () => {
    const r = c.classify(baseSystem());
    expect(r.level).toBe('minimal');
  });
});

describe('AiaObligationChecker', () => {
  const ck = new AiaObligationChecker();

  it('high 등급 + 모든 의무 met → approved true', () => {
    const implemented = new Set([
      'AIA-DOC',
      'AIA-RMS',
      'AIA-DATA-QUALITY',
      'AIA-LOGGING',
      'AIA-HUMAN-OVERSIGHT',
      'AIA-ACCURACY',
      'AIA-TRANSPARENCY',
    ]);
    const r = ck.check('high', implemented);
    expect(r.approved).toBe(true);
  });

  it('high 등급 + 일부 met → approved false', () => {
    const r = ck.check('high', new Set(['AIA-DOC']));
    expect(r.approved).toBe(false);
  });

  it('limited 등급 + AIA-TRANSPARENCY만 → approved true', () => {
    const r = ck.check('limited', new Set(['AIA-TRANSPARENCY']));
    expect(r.approved).toBe(true);
  });

  it('minimal 등급 → 의무 없음 → approved true', () => {
    const r = ck.check('minimal', new Set());
    expect(r.approved).toBe(true);
  });
});

describe('AiaReviewScheduler', () => {
  const s = new AiaReviewScheduler();

  it('high → 6개월', () => {
    const next = s.nextReviewDate('high', new Date('2026-01-01'));
    expect(next.getMonth()).toBe(6); // 2026-07
  });

  it('limited → 12개월', () => {
    const next = s.nextReviewDate('limited', new Date('2026-01-01'));
    expect(next.getFullYear()).toBe(2027);
  });

  it('minimal → 24개월', () => {
    const next = s.nextReviewDate('minimal', new Date('2026-01-01'));
    expect(next.getFullYear()).toBe(2028);
  });
});
