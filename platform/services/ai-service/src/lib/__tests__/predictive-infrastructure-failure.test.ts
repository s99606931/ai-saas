/**
 * 인프라 장애 예측기 단위 테스트 — SVC-AI-ADV-R465
 * Plan SC: FR-465.1~6
 */

import { describe, it, expect } from 'vitest';
import { PredictiveInfrastructureFailure } from '../predictive-infrastructure-failure';

describe('PredictiveInfrastructureFailure — R465', () => {
  it('FR-465.3/4: 고위험 시설 식별', () => {
    const p = new PredictiveInfrastructureFailure();
    const r = p.predict({
      id: 'B1',
      type: 'bridge',
      ageYears: 50,
      crackIndex: 1,
      vibration: 1,
      corrosion: 1,
    });
    expect(r.failureProbability).toBeGreaterThanOrEqual(0.75);
    expect(r.riskLevel).toBe('high');
    expect(r.inspectionPriority).toBe(1);
  });

  it('FR-465.3/4: 저위험 시설', () => {
    const p = new PredictiveInfrastructureFailure();
    const r = p.predict({
      id: 'T1',
      type: 'tunnel',
      ageYears: 1,
      crackIndex: 0,
      vibration: 0,
      corrosion: 0,
    });
    expect(r.riskLevel).toBe('low');
    expect(r.inspectionPriority).toBe(5);
  });

  it('FR-465.3: 중위험 시설', () => {
    const p = new PredictiveInfrastructureFailure();
    const r = p.predict({
      id: 'W1',
      type: 'water',
      ageYears: 25,
      crackIndex: 0.5,
      vibration: 0.5,
      corrosion: 0.5,
    });
    expect(r.riskLevel).toBe('mid');
  });

  it('FR-465.1: invalid 값 거부', () => {
    const p = new PredictiveInfrastructureFailure();
    expect(() =>
      p.predict({
        id: 'x',
        type: 'bridge',
        ageYears: -1,
        crackIndex: 0,
        vibration: 0,
        corrosion: 0,
      }),
    ).toThrow();
  });

  it('FR-465.6: C/S 차단 + audit log', () => {
    const p = new PredictiveInfrastructureFailure();
    expect(() =>
      p.predict(
        { id: 'x', type: 'bridge', ageYears: 10, crackIndex: 0, vibration: 0, corrosion: 0 },
        'S',
      ),
    ).toThrow(/N2SF_BLOCKED/);
    p.predict({ id: 'x', type: 'bridge', ageYears: 10, crackIndex: 0, vibration: 0, corrosion: 0 });
    expect(p.getAuditLog().length).toBeGreaterThan(0);
  });
});
