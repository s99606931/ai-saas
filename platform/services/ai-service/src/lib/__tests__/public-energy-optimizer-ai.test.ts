import { describe, it, expect } from 'vitest';
import { PublicEnergyOptimizerAI } from '../public-energy-optimizer-ai.js';

describe('SVC-AI-ADV-R446 PublicEnergyOptimizerAI', () => {
  const svc = new PublicEnergyOptimizerAI();

  it('FR-446.4: 낭비 건물 감지 (ratio > 1.3)', () => {
    const r = svc.optimize([
      { id: 'b1', area: 1000, use: 'office', kwh: 200000 },
    ]);
    expect(r[0]!.status).toBe('WASTE');
    expect(r[0]!.recommendations.length).toBeGreaterThan(0);
  });

  it('FR-446.3: 정상 건물', () => {
    const r = svc.optimize([{ id: 'b1', area: 1000, use: 'office', kwh: 80000 }]);
    expect(r[0]!.status).toBe('NORMAL');
    expect(r[0]!.ratio).toBe(0.8);
  });

  it('FR-446.2: 용도별 기준 차이', () => {
    const school = svc.optimize([{ id: 's', area: 1000, use: 'school', kwh: 80000 }]);
    const hospital = svc.optimize([
      { id: 'h', area: 1000, use: 'hospital', kwh: 80000 },
    ]);
    expect(school[0]!.ratio).toBe(1);
    expect(hospital[0]!.ratio).toBeLessThan(1);
  });

  it('빈 배열', () => {
    expect(svc.optimize([])).toEqual([]);
  });

  it('area <= 0 오류', () => {
    expect(() =>
      svc.optimize([{ id: 'b', area: 0, use: 'office', kwh: 100 }]),
    ).toThrow('INVALID_AREA');
  });

  it('kwh 음수 오류', () => {
    expect(() =>
      svc.optimize([{ id: 'b', area: 100, use: 'office', kwh: -1 }]),
    ).toThrow('INVALID_KWH');
  });

  it('FR-446.5: S 차단', () => {
    expect(() => svc.optimize([], 'S')).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.optimize([{ id: 'b', area: 100, use: 'office', kwh: 1000 }]);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
