import { describe, it, expect, beforeEach } from 'vitest';
import { LocalTaxOptimizerAi } from '../local-tax-optimizer-ai';

describe('LocalTaxOptimizerAi', () => {
  let ai: LocalTaxOptimizerAi;

  beforeEach(() => {
    ai = new LocalTaxOptimizerAi();
  });

  it('취득세 데이터를 적재한다', () => {
    ai.ingest({
      year: 2025,
      taxType: 'acquisition',
      assessedKrw: 100_000_000,
      collectedKrw: 95_000_000,
      arrearsKrw: 5_000_000,
      taxpayerCount: 500,
    });
    expect(ai.totalArrears()).toBe(5_000_000);
  });

  it('데이터 없는 세목의 예측은 0이다', () => {
    const f = ai.forecast('property');
    expect(f.nextYearForecastKrw).toBe(0);
  });

  it('성장률 기반으로 다음 해를 예측한다', () => {
    ai.ingest({
      year: 2024,
      taxType: 'property',
      assessedKrw: 100_000_000,
      collectedKrw: 100_000_000,
      arrearsKrw: 0,
      taxpayerCount: 1000,
    });
    ai.ingest({
      year: 2025,
      taxType: 'property',
      assessedKrw: 110_000_000,
      collectedKrw: 110_000_000,
      arrearsKrw: 0,
      taxpayerCount: 1100,
    });
    const f = ai.forecast('property');
    expect(f.nextYearForecastKrw).toBeGreaterThan(110_000_000);
  });

  it('징수율 70% 미만은 arrears_collection 우선', () => {
    ai.ingest({
      year: 2025,
      taxType: 'auto',
      assessedKrw: 100_000_000,
      collectedKrw: 60_000_000,
      arrearsKrw: 40_000_000,
      taxpayerCount: 800,
    });
    const f = ai.forecast('auto');
    expect(f.priorityAction).toBe('arrears_collection');
    expect(f.riskLevel).toBe('high');
  });

  it('음수 금액 입력은 거부한다', () => {
    expect(() =>
      ai.ingest({
        year: 2025,
        taxType: 'tobacco',
        assessedKrw: -1,
        collectedKrw: 0,
        arrearsKrw: 0,
        taxpayerCount: 0,
      }),
    ).toThrow('VALIDATION');
  });

  it('C등급 데이터는 차단된다', () => {
    expect(() =>
      ai.ingest(
        {
          year: 2025,
          taxType: 'leisure',
          assessedKrw: 1,
          collectedKrw: 1,
          arrearsKrw: 0,
          taxpayerCount: 1,
        },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
