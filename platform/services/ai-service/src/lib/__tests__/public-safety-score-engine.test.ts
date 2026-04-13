import { describe, it, expect } from 'vitest';
import { PublicSafetyScoreEngine } from '../public-safety-score-engine.js';

describe('SVC-AI-ADV-R400 PublicSafetyScoreEngine', () => {
  const svc = new PublicSafetyScoreEngine();

  it('FR-390.1: 안전한 지역 A 등급', () => {
    const r = svc.evaluate({
      regionId: 'r1',
      crimeRate: 0.1,
      fireRate: 0.1,
      accidentRate: 0.1,
      disasterRate: 0.05,
    });
    expect(r.grade).toBe('A');
    expect(r.totalScore).toBeGreaterThanOrEqual(85);
  });

  it('FR-390.2: 위험 요소 식별', () => {
    const r = svc.evaluate({
      regionId: 'r2',
      crimeRate: 5, // crime score = 100-50 = 50 (<60)
      fireRate: 0.1,
      accidentRate: 0.1,
      disasterRate: 0.1,
    });
    expect(r.riskFactors).toContain('crime');
  });

  it('FR-390.3: D 등급', () => {
    const r = svc.evaluate({
      regionId: 'r3',
      crimeRate: 10,
      fireRate: 10,
      accidentRate: 20,
      disasterRate: 2,
    });
    expect(r.grade).toBe('D');
  });

  it('FR-390.4: S등급 차단', () => {
    expect(() =>
      svc.evaluate(
        { regionId: 'r', crimeRate: 0, fireRate: 0, accidentRate: 0, disasterRate: 0 },
        'S',
      ),
    ).toThrow('N2SF_BLOCKED');
  });

  it('FR-390.5: 음수 입력 거부', () => {
    expect(() =>
      svc.evaluate({
        regionId: 'r',
        crimeRate: -1,
        fireRate: 0,
        accidentRate: 0,
        disasterRate: 0,
      }),
    ).toThrow('INVALID_METRIC');
  });

  it('감사 로그', () => {
    svc.evaluate({ regionId: 'r4', crimeRate: 0, fireRate: 0, accidentRate: 0, disasterRate: 0 });
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
