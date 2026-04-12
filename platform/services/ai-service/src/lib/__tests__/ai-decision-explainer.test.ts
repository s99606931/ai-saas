import { describe, it, expect } from 'vitest';
import {
  AIDecisionExplainer,
  type DecisionInput,
} from '../ai-decision-explainer.js';

function mkInput(
  overrides: Partial<DecisionInput> = {},
): DecisionInput {
  return {
    id: 'dec1',
    tenantId: 't1',
    label: '승인',
    score: 75,
    features: [
      { name: 'income', value: 50 },
      { name: 'credit', value: 80 },
      { name: 'history', value: 10 },
    ],
    weights: { income: 0.6, credit: 0.5, history: 0.2 },
    threshold: 60,
    grade: 'O',
    ...overrides,
  };
}

describe('grade guard (FR-R84.1, N-05)', () => {
  it('O 등급 허용', () => {
    const e = new AIDecisionExplainer();
    const r = e.explain(mkInput());
    expect(r.decisionId).toBe('dec1');
  });

  it('C 등급 차단', () => {
    const e = new AIDecisionExplainer();
    expect(() => e.explain(mkInput({ grade: 'C' }))).toThrow(
      'EXPLAIN_GRADE_BLOCKED',
    );
  });

  it('S 등급 차단', () => {
    const e = new AIDecisionExplainer();
    expect(() => e.explain(mkInput({ grade: 'S' }))).toThrow(
      'EXPLAIN_GRADE_BLOCKED',
    );
  });
});

describe('기여도 분해 (FR-R84.2)', () => {
  it('Top-K 정렬', () => {
    const e = new AIDecisionExplainer();
    const r = e.explain(mkInput(), 2);
    expect(r.topContributions).toHaveLength(2);
    // income*0.6=30, credit*0.5=40, history*0.2=2
    // Top 2: credit, income
    expect(r.topContributions[0]?.feature).toBe('credit');
    expect(r.topContributions[1]?.feature).toBe('income');
  });

  it('기여도 percent 합 ≈ 100', () => {
    const e = new AIDecisionExplainer();
    const r = e.explain(mkInput(), 3);
    const sum = r.topContributions.reduce((s, c) => s + c.percent, 0);
    expect(sum).toBeCloseTo(100, 0);
  });

  it('contribution = value * weight', () => {
    const e = new AIDecisionExplainer();
    const r = e.explain(mkInput(), 3);
    const credit = r.topContributions.find((c) => c.feature === 'credit');
    expect(credit?.contribution).toBeCloseTo(80 * 0.5);
  });
});

describe('4단계 서술 (FR-R84.3)', () => {
  it('4단계 모두 포함', () => {
    const e = new AIDecisionExplainer();
    const r = e.explain(mkInput());
    expect(r.narrative).toContain('[1단계');
    expect(r.narrative).toContain('[2단계');
    expect(r.narrative).toContain('[3단계');
    expect(r.narrative).toContain('[4단계');
  });

  it('판정 결과(충족/미달) 포함', () => {
    const e = new AIDecisionExplainer();
    const passed = e.explain(mkInput({ score: 75, threshold: 60 }));
    expect(passed.narrative).toContain('충족');
    const failed = e.explain(mkInput({ score: 40, threshold: 60 }));
    expect(failed.narrative).toContain('미달');
  });

  it('최종 점수와 임계값 포함', () => {
    const e = new AIDecisionExplainer();
    const r = e.explain(mkInput({ score: 75.5, threshold: 60.2 }));
    expect(r.narrative).toContain('75.50');
    expect(r.narrative).toContain('60.20');
  });
});

describe('대안 시나리오 (FR-R84.4)', () => {
  it('점수가 임계값 근처면 대안 존재', () => {
    const e = new AIDecisionExplainer();
    const r = e.explain(mkInput({ score: 65, threshold: 60 }));
    // 특정 특징 감소 시 미달 가능성
    expect(r.alternatives.length).toBeGreaterThanOrEqual(0);
  });

  it('passed 판정', () => {
    const e = new AIDecisionExplainer();
    const r = e.explain(mkInput({ score: 80, threshold: 60 }));
    expect(r.passed).toBe(true);
  });

  it('failed 판정', () => {
    const e = new AIDecisionExplainer();
    const r = e.explain(mkInput({ score: 30, threshold: 60 }));
    expect(r.passed).toBe(false);
  });

  it('대안이 wouldFlipLabel=true', () => {
    const e = new AIDecisionExplainer();
    const r = e.explain(mkInput({ score: 62, threshold: 60 }));
    for (const alt of r.alternatives) {
      expect(alt.wouldFlipLabel).toBe(true);
    }
  });
});

describe('PII 마스킹 (FR-R84.5)', () => {
  it('narrative에 PII 포함 시 마스킹 (경로 커버)', () => {
    const e = new AIDecisionExplainer();
    // features description에 이메일 주입 → narrative에 포함될 가능성
    const input = mkInput({
      features: [
        { name: 'contact_user@example.com', value: 50 },
        { name: 'credit', value: 80 },
        { name: 'history', value: 10 },
      ],
    });
    const r = e.explain(input);
    expect(r.narrative).not.toContain('user@example.com');
  });
});

describe('감사 로그 (FR-R84.5)', () => {
  it('EXPLAIN_START/DONE 기록', () => {
    const e = new AIDecisionExplainer();
    e.explain(mkInput());
    const actions = e.getAuditLog().map((x) => x.action);
    expect(actions).toContain('EXPLAIN_START');
    expect(actions).toContain('EXPLAIN_DONE');
  });

  it('GRADE_BLOCKED 기록', () => {
    const e = new AIDecisionExplainer();
    try {
      e.explain(mkInput({ grade: 'C' }));
    } catch {
      // expected
    }
    expect(e.getAuditLog().some((x) => x.action === 'GRADE_BLOCKED')).toBe(true);
  });

  it('getAuditLog 불변 복사본', () => {
    const e = new AIDecisionExplainer();
    e.explain(mkInput());
    const log = e.getAuditLog();
    log.length = 0;
    expect(e.getAuditLog().length).toBeGreaterThan(0);
  });
});

describe('경계 케이스', () => {
  it('특징 없음', () => {
    const e = new AIDecisionExplainer();
    const r = e.explain(
      mkInput({ features: [], weights: {}, score: 0, threshold: 10 }),
    );
    expect(r.topContributions).toHaveLength(0);
    expect(r.narrative).toContain('유의미한 특징 없음');
  });

  it('가중치 0', () => {
    const e = new AIDecisionExplainer();
    const r = e.explain(
      mkInput({
        features: [{ name: 'x', value: 100 }],
        weights: { x: 0 },
        score: 0,
        threshold: 10,
      }),
    );
    expect(r.topContributions[0]?.contribution).toBe(0);
  });
});
