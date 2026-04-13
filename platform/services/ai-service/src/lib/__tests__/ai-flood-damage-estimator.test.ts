import { describe, it, expect, beforeEach } from 'vitest';
import { AIFloodDamageEstimator } from '../ai-flood-damage-estimator';

describe('AIFloodDamageEstimator', () => {
  let est: AIFloodDamageEstimator;

  beforeEach(() => {
    est = new AIFloodDamageEstimator();
    est.registerAsset({
      id: 'a1', type: 'residential', valueKRW: 100_000_000, locationElevation: 0,
    });
    est.registerScenario({
      id: 's1', regionId: 'r1', waterDepthM: 2, durationHours: 24, forecastAt: '2026-04-13',
    });
  });

  it('자산과 시나리오를 등록한다', () => {
    expect(est.getAuditLog().some(l => l.action === 'REGISTER_ASSET')).toBe(true);
    expect(est.getAuditLog().some(l => l.action === 'REGISTER_SCENARIO')).toBe(true);
  });

  it('수심 2m 주거 자산 피해율을 계산한다', () => {
    const result = est.estimate('s1', 'a1');
    expect(result.damageRatio).toBeGreaterThan(0);
    expect(result.estimatedLossKRW).toBeGreaterThan(0);
  });

  it('고도가 수심보다 높으면 피해 없음', () => {
    est.registerAsset({ id: 'a2', type: 'commercial', valueKRW: 50_000_000, locationElevation: 5 });
    const result = est.estimate('s1', 'a2');
    expect(result.damageRatio).toBe(0);
    expect(result.severity).toBe('minor');
  });

  it('지역 전체 피해를 합산한다', () => {
    const total = est.estimateRegionTotal('s1');
    expect(total).toBeGreaterThan(0);
  });

  it('미등록 시나리오 시 에러', () => {
    expect(() => est.estimate('unknown', 'a1')).toThrow();
  });

  it('C등급을 차단한다', () => {
    expect(() => est.registerScenario({
      id: 's2', regionId: 'r2', waterDepthM: 1, durationHours: 10, forecastAt: 't',
    }, 'C' as unknown as never)).toThrow(/BLOCKED/);
  });
});
