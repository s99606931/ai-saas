/**
 * 탄소배출 추적 테스트
 * Design Ref: MTU-N451 §3
 * Plan SC: FR-CARBON.1~5
 */

import {
  CarbonTracker,
  EmissionFactorDB,
  Scope1Calculator,
  Scope2Calculator,
  Scope3Estimator,
  ReportAggregator,
  ActivityData,
} from '../src/carbon-tracker';

describe('EmissionFactorDB', () => {
  it('기본 KR 배출계수 3종 등록 (전력/가스/디젤)', () => {
    const db = new EmissionFactorDB();
    expect(db.get('electricity-grid-kr')?.co2eKgPerUnit).toBeCloseTo(0.4594);
    expect(db.get('natural-gas')?.co2eKgPerUnit).toBeCloseTo(2.176);
    expect(db.get('diesel')?.co2eKgPerUnit).toBeCloseTo(2.682);
  });

  it('register: 신규 배출계수 추가 가능', () => {
    const db = new EmissionFactorDB();
    db.register({
      category: 'lpg',
      unit: 'L',
      co2eKgPerUnit: 1.6,
      version: '2026Q3',
      validFrom: '2026-07-01',
    });
    expect(db.get('lpg')?.co2eKgPerUnit).toBe(1.6);
  });

  it('listVersions: 등록된 버전 목록 반환', () => {
    const db = new EmissionFactorDB();
    expect(db.listVersions()).toContain('2026Q2');
  });

  it('get: 미등록 카테고리는 undefined', () => {
    const db = new EmissionFactorDB();
    expect(db.get('unknown')).toBeUndefined();
  });
});

describe('Scope1Calculator', () => {
  const db = new EmissionFactorDB();
  const calc = new Scope1Calculator(db);

  it('직접 배출 계산 (자동차 디젤)', () => {
    const result = calc.calculate({
      activityId: 'car-001',
      scope: '1',
      category: 'diesel',
      amount: 100,
      unit: 'L',
      period: '2026-04',
      source: 'fleet',
    });
    expect(result.co2eKg).toBeCloseTo(268.2);
    expect(result.scope).toBe('1');
    expect(result.factorVersion).toBe('2026Q2');
  });

  it('scope 2 입력 시 오류', () => {
    expect(() =>
      calc.calculate({
        activityId: 'x',
        scope: '2',
        category: 'diesel',
        amount: 1,
        unit: 'L',
        period: '2026-04',
        source: 'x',
      }),
    ).toThrow(/Scope 1/);
  });

  it('미등록 카테고리 시 오류', () => {
    expect(() =>
      calc.calculate({
        activityId: 'x',
        scope: '1',
        category: 'unknown-fuel',
        amount: 1,
        unit: 'L',
        period: '2026-04',
        source: 'x',
      }),
    ).toThrow(/배출계수 없음/);
  });
});

describe('Scope2Calculator', () => {
  const db = new EmissionFactorDB();
  const calc = new Scope2Calculator(db);

  it('전력 사용량 계산', () => {
    const result = calc.calculate({
      activityId: 'office-001',
      scope: '2',
      category: 'electricity-grid-kr',
      amount: 1000,
      unit: 'kWh',
      period: '2026-04',
      source: 'kepco',
    });
    expect(result.co2eKg).toBeCloseTo(459.4);
  });

  it('카테고리 미등록 시 기본 전력계수 사용', () => {
    const result = calc.calculate({
      activityId: 'x',
      scope: '2',
      category: 'foo',
      amount: 100,
      unit: 'kWh',
      period: '2026-04',
      source: 'y',
    });
    expect(result.co2eKg).toBeCloseTo(45.94);
  });

  it('scope 1 입력 시 오류', () => {
    expect(() =>
      calc.calculate({
        activityId: 'x',
        scope: '1',
        category: 'electricity-grid-kr',
        amount: 1,
        unit: 'kWh',
        period: '2026-04',
        source: 'x',
      }),
    ).toThrow(/Scope 2/);
  });
});

describe('Scope3Estimator', () => {
  const est = new Scope3Estimator();

  it('국내 항공 출장 추정', () => {
    const result = est.estimate({
      activityId: 't-001',
      scope: '3',
      category: 'business-travel-air-domestic',
      amount: 1000,
      unit: 'km',
      period: '2026-04',
      source: 'travel',
    });
    expect(result.co2eKg).toBeCloseTo(158);
    expect(result.factorVersion).toBe('estimator-v1');
  });

  it('미등록 카테고리는 기본계수 0.3', () => {
    const result = est.estimate({
      activityId: 'x',
      scope: '3',
      category: 'unknown',
      amount: 100,
      unit: 'unit',
      period: '2026-04',
      source: 'x',
    });
    expect(result.co2eKg).toBeCloseTo(30);
  });

  it('scope 1 입력 시 오류', () => {
    expect(() =>
      est.estimate({
        activityId: 'x',
        scope: '1',
        category: 'unknown',
        amount: 1,
        unit: 'x',
        period: '2026-04',
        source: 'x',
      }),
    ).toThrow();
  });
});

describe('ReportAggregator', () => {
  const agg = new ReportAggregator();

  it('Scope 1/2/3 합산 + 활동 수', () => {
    const report = agg.aggregate(
      [
        { activityId: '1', scope: '1', co2eKg: 100, factorVersion: 'v1', calculatedAt: '' },
        { activityId: '2', scope: '2', co2eKg: 200, factorVersion: 'v1', calculatedAt: '' },
        { activityId: '3', scope: '3', co2eKg: 50, factorVersion: 'v1', calculatedAt: '' },
      ],
      '2026-04',
    );
    expect(report.scope1Kg).toBe(100);
    expect(report.scope2Kg).toBe(200);
    expect(report.scope3Kg).toBe(50);
    expect(report.totalKg).toBe(350);
    expect(report.activityCount).toBe(3);
  });

  it('compareToTarget: 목표 달성', () => {
    const report = agg.aggregate(
      [{ activityId: '1', scope: '1', co2eKg: 80, factorVersion: 'v1', calculatedAt: '' }],
      '2026-04',
    );
    const cmp = agg.compareToTarget(report, 100);
    expect(cmp.achieved).toBe(true);
    expect(cmp.gapKg).toBe(-20);
  });

  it('compareToTarget: 목표 초과', () => {
    const report = agg.aggregate(
      [{ activityId: '1', scope: '1', co2eKg: 150, factorVersion: 'v1', calculatedAt: '' }],
      '2026-04',
    );
    const cmp = agg.compareToTarget(report, 100);
    expect(cmp.achieved).toBe(false);
    expect(cmp.gapPercent).toBe(50);
  });

  it('compareToTarget: target 0인 경우 0% 반환', () => {
    const report = agg.aggregate([], '2026-04');
    const cmp = agg.compareToTarget(report, 0);
    expect(cmp.gapPercent).toBe(0);
  });
});

describe('CarbonTracker (통합)', () => {
  const tracker = new CarbonTracker();

  const activities: ActivityData[] = [
    {
      activityId: 'a1',
      scope: '1',
      category: 'diesel',
      amount: 50,
      unit: 'L',
      period: '2026-04',
      source: 'fleet',
    },
    {
      activityId: 'a2',
      scope: '2',
      category: 'electricity-grid-kr',
      amount: 5000,
      unit: 'kWh',
      period: '2026-04',
      source: 'kepco',
    },
    {
      activityId: 'a3',
      scope: '3',
      category: 'business-travel-air-domestic',
      amount: 500,
      unit: 'km',
      period: '2026-04',
      source: 'travel',
    },
  ];

  it('calculate: scope에 따른 라우팅', () => {
    activities.forEach((a) => {
      const r = tracker.calculate(a);
      expect(r.co2eKg).toBeGreaterThan(0);
    });
  });

  it('report: 전체 활동 집계', () => {
    const r = tracker.report(activities, '2026-04');
    expect(r.activityCount).toBe(3);
    expect(r.totalKg).toBeGreaterThan(0);
    expect(r.scope1Kg).toBeGreaterThan(0);
    expect(r.scope2Kg).toBeGreaterThan(0);
    expect(r.scope3Kg).toBeGreaterThan(0);
  });

  it('getFactorDB: DB 인스턴스 반환', () => {
    expect(tracker.getFactorDB()).toBeInstanceOf(EmissionFactorDB);
  });

  it('잘못된 입력은 zod 검증 실패', () => {
    expect(() =>
      tracker.calculate({
        activityId: '',
        scope: '1',
        category: 'diesel',
        amount: -1,
        unit: 'L',
        period: '2026-04',
        source: 'x',
      } as ActivityData),
    ).toThrow();
  });
});
