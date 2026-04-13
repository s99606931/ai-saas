import { describe, it, expect, beforeEach } from 'vitest';
import { AIForestFireDamageAssessor, type FireReport } from '../ai-forest-fire-damage-assessor';

describe('AIForestFireDamageAssessor', () => {
  let ai: AIForestFireDamageAssessor;

  const base = (): FireReport => ({
    fireId: 'F1',
    region: '강원',
    burnedAreaHa: 10,
    forestType: 'pine',
    terrain: 'hill',
    severity: 'moderate',
    affectedHouses: 2,
    injuredPeople: 0,
  });

  beforeEach(() => {
    ai = new AIForestFireDamageAssessor();
  });

  it('기본 피해 평가', () => {
    const r = ai.assess(base());
    expect(r.totalDamage).toBeGreaterThan(0);
    expect(r.timberLoss).toBeGreaterThan(0);
  });

  it('total 심각도는 low보다 큰 피해', () => {
    const low = ai.assess({ ...base(), severity: 'low' });
    const total = ai.assess({ ...base(), severity: 'total' });
    expect(total.totalDamage).toBeGreaterThan(low.totalDamage);
  });

  it('50ha 이상 시 우선지역', () => {
    const r = ai.assess({ ...base(), burnedAreaHa: 60 });
    expect(r.priorityRegion).toBe(true);
  });

  it('가파른 지형은 복원 비용 증가', () => {
    const hill = ai.assess({ ...base(), terrain: 'hill' });
    const steep = ai.assess({ ...base(), terrain: 'steep' });
    expect(steep.restorationCost).toBeGreaterThan(hill.restorationCost);
  });

  it('주택 피해 반영', () => {
    const r = ai.assess({ ...base(), affectedHouses: 5 });
    expect(r.infrastructureLoss).toBe(5 * 150_000_000);
  });

  it('음수 면적 오류', () => {
    expect(() => ai.assess({ ...base(), burnedAreaHa: 0 })).toThrow();
  });
});
