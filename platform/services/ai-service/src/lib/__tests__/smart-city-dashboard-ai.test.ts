import { describe, it, expect } from 'vitest';
import { SmartCityDashboardAI } from '../smart-city-dashboard-ai.js';

describe('SVC-AI-ADV-R440 SmartCityDashboardAI', () => {
  const svc = new SmartCityDashboardAI();

  it('FR-440.2: 이상 탐지 (|z|>=2)', () => {
    const s = svc.snapshot([
      { domain: 'traffic', name: 'jam', value: 100, baseline: 50, stddev: 10 },
    ]);
    expect(s.anomalies.length).toBe(1);
    expect(Math.abs(s.anomalies[0]!.z)).toBeGreaterThanOrEqual(2);
  });

  it('FR-440.3~4: 정상 값 → 높은 cityIndex', () => {
    const s = svc.snapshot([
      { domain: 'air', name: 'pm25', value: 50, baseline: 50, stddev: 10 },
      { domain: 'water', name: 'ph', value: 7, baseline: 7, stddev: 0.2 },
    ]);
    expect(s.cityIndex).toBe(1);
    expect(s.anomalies.length).toBe(0);
  });

  it('FR-440.4: 도메인별 점수 반환', () => {
    const s = svc.snapshot([
      { domain: 'traffic', name: 'x', value: 100, baseline: 50, stddev: 10 },
      { domain: 'air', name: 'y', value: 50, baseline: 50, stddev: 10 },
    ]);
    expect(Object.keys(s.domainScores)).toContain('traffic');
    expect(Object.keys(s.domainScores)).toContain('air');
  });

  it('빈 입력', () => {
    const s = svc.snapshot([]);
    expect(s.totalKpis).toBe(0);
    expect(s.cityIndex).toBe(0);
  });

  it('stddev ≤ 0 → 오류', () => {
    expect(() =>
      svc.snapshot([{ domain: 'x', name: 'y', value: 1, baseline: 1, stddev: 0 }]),
    ).toThrow('INVALID_STDDEV');
  });

  it('FR-440.5: C 차단', () => {
    expect(() => svc.snapshot([], 'C')).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.snapshot([{ domain: 'x', name: 'y', value: 1, baseline: 1, stddev: 1 }]);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
