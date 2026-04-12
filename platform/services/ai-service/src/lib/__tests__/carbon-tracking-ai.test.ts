import { describe, it, expect, beforeEach } from 'vitest';
import { CarbonTrackingAi, type ActivityRecord } from '../carbon-tracking-ai';

describe('CarbonTrackingAi', () => {
  let svc: CarbonTrackingAi;

  beforeEach(() => {
    svc = new CarbonTrackingAi();
    svc.registerFactor({
      category: 'diesel',
      factor: 2.68,
      unit: 'L',
      version: 'kr-2025',
      source: '환경부',
    });
    svc.registerFactor({
      category: 'electricity',
      factor: 0.4567,
      unit: 'kWh',
      version: 'kr-2025',
      source: '한전',
    });
    svc.registerFactor({
      category: 'business-travel',
      factor: 0.12,
      unit: 'km',
      version: 'kr-2025',
      source: '환경부',
    });
  });

  it('FR-CARBON.1 Scope 1 계산', () => {
    const a: ActivityRecord = { id: 'a1', scope: 1, category: 'diesel', amount: 100, unit: 'L', period: '2026-04' };
    const r = svc.calculateScope1(a);
    expect(r.scope).toBe(1);
    expect(r.emissionKgCO2).toBeCloseTo(268, 1);
  });

  it('FR-CARBON.2 Scope 2 계산', () => {
    const a: ActivityRecord = { id: 'a2', scope: 2, category: 'electricity', amount: 1000, unit: 'kWh', period: '2026-04' };
    const r = svc.calculateScope2(a);
    expect(r.emissionKgCO2).toBeCloseTo(456.7, 1);
  });

  it('FR-CARBON.3 Scope 3 추정', () => {
    const a: ActivityRecord = { id: 'a3', scope: 3, category: 'business-travel', amount: 500, unit: 'km', period: '2026-04' };
    const r = svc.estimateScope3(a);
    expect(r.emissionKgCO2).toBeCloseTo(60, 1);
  });

  it('FR-CARBON.4 배출계수 미등록 오류', () => {
    const a: ActivityRecord = { id: 'x', scope: 1, category: 'unknown', amount: 10, unit: 'L', period: '2026-04' };
    expect(() => svc.calculateScope1(a)).toThrow();
  });

  it('FR-CARBON.5 월별 집계', () => {
    const r1 = svc.calculateScope1({ id: 'a1', scope: 1, category: 'diesel', amount: 100, unit: 'L', period: '2026-04' });
    const r2 = svc.calculateScope2({ id: 'a2', scope: 2, category: 'electricity', amount: 1000, unit: 'kWh', period: '2026-04' });
    const report = svc.aggregatePeriod('2026-04', [r1, r2], 500);
    expect(report.total).toBeGreaterThan(700);
    expect(report.targetDelta).toBeGreaterThan(0);
  });
});
