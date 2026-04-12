// Test Ref: MTU-N451 §carbon-tracker
// Plan SC: FR-CARBON.1 ~ FR-CARBON.5
import { describe, it, expect } from 'vitest';
import {
  Scope1Calculator,
  Scope2Calculator,
  Scope3Estimator,
  ReportAggregator,
  DefaultFactorDB,
} from '../src/index.js';

describe('Scope1Calculator — FR-CARBON.1', () => {
  it('계산 scope 1 diesel L', () => {
    const calc = new Scope1Calculator();
    const r = calc.calculate([{ fuel: 'diesel', amount: 1000, unit: 'L' }]);
    expect(r.scope).toBe(1);
    expect(r.tCO2e).toBeCloseTo(2.68, 5);
    expect(r.breakdown.diesel).toBeCloseTo(2.68, 5);
  });

  it('다중 연료 합산 breakdown', () => {
    const calc = new Scope1Calculator();
    const r = calc.calculate([
      { fuel: 'diesel', amount: 500, unit: 'L' },
      { fuel: 'gasoline', amount: 500, unit: 'L' },
    ]);
    expect(r.tCO2e).toBeCloseTo(500 * 0.00268 + 500 * 0.00231, 5);
    expect(Object.keys(r.breakdown)).toEqual(['diesel', 'gasoline']);
  });

  it('LNG kg 계산', () => {
    const calc = new Scope1Calculator();
    const r = calc.calculate([{ fuel: 'lng', amount: 100, unit: 'kg' }]);
    expect(r.tCO2e).toBeCloseTo(0.272, 5);
  });

  it('잘못된 단위 조합 에러', () => {
    const calc = new Scope1Calculator();
    expect(() => calc.calculate([{ fuel: 'lng', amount: 100, unit: 'L' }])).toThrow(
      /No factor/,
    );
  });
});

describe('Scope2Calculator — FR-CARBON.2', () => {
  it('기본 KR 전력 배출계수', () => {
    const calc = new Scope2Calculator();
    const r = calc.calculate([{ kwh: 10000 }]);
    expect(r.scope).toBe(2);
    expect(r.tCO2e).toBeCloseTo(4.59, 4);
    expect(r.breakdown.KR).toBeCloseTo(4.59, 4);
  });

  it('KR-JEJU 지역 계수', () => {
    const calc = new Scope2Calculator();
    const r = calc.calculate([{ kwh: 10000, gridRegion: 'KR-JEJU' }]);
    expect(r.tCO2e).toBeCloseTo(4.12, 4);
  });
});

describe('Scope3Estimator — FR-CARBON.3', () => {
  it('출장 배출량', () => {
    const est = new Scope3Estimator();
    const r = est.estimate([
      { category: 'business_travel', amount: 1000, unit: 'km' },
    ]);
    expect(r.scope).toBe(3);
    expect(r.tCO2e).toBeCloseTo(0.157, 4);
  });

  it('폐기물 ton', () => {
    const est = new Scope3Estimator();
    const r = est.estimate([{ category: 'waste', amount: 10, unit: 'ton' }]);
    expect(r.tCO2e).toBeCloseTo(4.67, 3);
  });

  it('알 수 없는 단위 에러', () => {
    const est = new Scope3Estimator();
    expect(() =>
      est.estimate([{ category: 'waste', amount: 10, unit: 'krw' }]),
    ).toThrow(/No factor/);
  });
});

describe('ReportAggregator — FR-CARBON.5', () => {
  it('3개 scope 집계 + 감축 목표 대비 gap', () => {
    const s1 = new Scope1Calculator().calculate([
      { fuel: 'diesel', amount: 1000, unit: 'L' },
    ]);
    const s2 = new Scope2Calculator().calculate([{ kwh: 10000 }]);
    const s3 = new Scope3Estimator().estimate([
      { category: 'business_travel', amount: 1000, unit: 'km' },
    ]);
    const agg = new ReportAggregator().aggregate({
      period: '2026Q1',
      scope1: s1,
      scope2: s2,
      scope3: s3,
      reductionTargetTco2e: 5,
    });
    expect(agg.total).toBeCloseTo(2.68 + 4.59 + 0.157, 3);
    expect(agg.gapTco2e).toBeCloseTo(agg.total - 5, 3);
    expect(agg.factorVersion).toBe('2025-ME-KR-v1');
  });

  it('감축 목표 미제공 시 gap undefined', () => {
    const s1 = new Scope1Calculator().calculate([
      { fuel: 'diesel', amount: 100, unit: 'L' },
    ]);
    const s2 = new Scope2Calculator().calculate([{ kwh: 100 }]);
    const s3 = new Scope3Estimator().estimate([
      { category: 'waste', amount: 1, unit: 'ton' },
    ]);
    const agg = new ReportAggregator().aggregate({
      period: '2026-03',
      scope1: s1,
      scope2: s2,
      scope3: s3,
    });
    expect(agg.gapTco2e).toBeUndefined();
    expect(agg.reductionTargetTco2e).toBeUndefined();
  });
});

describe('DefaultFactorDB — FR-CARBON.4', () => {
  it('factor version 고정', () => {
    const db = new DefaultFactorDB();
    expect(db.version).toBe('2025-ME-KR-v1');
  });

  it('알 수 없는 연료 null', () => {
    const db = new DefaultFactorDB();
    // @ts-expect-error 의도적 잘못된 타입
    expect(db.scope1('nuclear')).toBeNull();
  });
});
