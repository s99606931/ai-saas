import { describe, it, expect } from 'vitest';
import { AiModelExplainabilityV2 } from '../ai-model-explainability-v2.js';

describe('SVC-AI-ADV-R366 AiModelExplainabilityV2', () => {
  const svc = new AiModelExplainabilityV2();

  const features = [
    { name: 'income', value: 100, weight: 0.5 },
    { name: 'age', value: 30, weight: 0.1 },
    { name: 'score', value: 80, weight: 0.4 },
  ];

  it('FR-366.1: 기여도 계산', () => {
    const r = svc.explain(features, 3);
    expect(r.topFeatures.length).toBe(3);
    expect(r.prediction).toBeCloseTo(100 * 0.5 + 30 * 0.1 + 80 * 0.4, 2);
  });

  it('FR-366.2: topN', () => {
    const r = svc.explain(features, 1);
    expect(r.topFeatures.length).toBe(1);
    expect(r.topFeatures[0]?.name).toBe('income');
  });

  it('FR-366.3: S등급 차단', () => {
    expect(() => svc.explain(features, 3, 'S')).toThrow('N2SF_BLOCKED');
  });

  it('FR-366.4: 감사 로그', () => {
    svc.explain(features, 3);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });

  it('빈 features 예외', () => {
    expect(() => svc.explain([], 3)).toThrow('INVALID_PARAMS');
  });
});
