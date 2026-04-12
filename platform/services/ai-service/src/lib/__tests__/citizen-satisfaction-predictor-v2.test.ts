import { describe, it, expect } from 'vitest';
import { CitizenSatisfactionPredictorV2 } from '../citizen-satisfaction-predictor-v2.js';

describe('SVC-AI-ADV-R368 CitizenSatisfactionPredictorV2', () => {
  const svc = new CitizenSatisfactionPredictorV2();

  it('FR-368.1: 만족도 점수 계산', () => {
    const r = svc.predict('s1', {
      responseTime: 90,
      resolutionRate: 95,
      courtesy: 85,
    });
    expect(r.score).toBeCloseTo(90 * 0.3 + 95 * 0.4 + 85 * 0.3, 2);
    expect(r.grade).toBe('A');
  });

  it('FR-368.2: 약점 식별', () => {
    const r = svc.predict('s2', { responseTime: 40, resolutionRate: 80, courtesy: 90 });
    expect(r.weaknesses[0]?.metric).toBe('responseTime');
  });

  it('FR-368.3: S등급 차단', () => {
    expect(() =>
      svc.predict('s3', { responseTime: 80, resolutionRate: 80, courtesy: 80 }, 'S'),
    ).toThrow('N2SF_BLOCKED');
  });

  it('FR-368.4: 감사 로그', () => {
    svc.predict('s4', { responseTime: 80, resolutionRate: 80, courtesy: 80 });
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });

  it('범위 밖 값', () => {
    expect(() =>
      svc.predict('s5', { responseTime: 150, resolutionRate: 80, courtesy: 80 }),
    ).toThrow('INVALID_PARAMS');
  });

  it('낮은 점수 D등급', () => {
    const r = svc.predict('s6', { responseTime: 30, resolutionRate: 40, courtesy: 30 });
    expect(r.grade).toBe('D');
  });
});
