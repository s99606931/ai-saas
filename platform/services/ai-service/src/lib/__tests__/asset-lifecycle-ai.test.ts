import { describe, it, expect } from 'vitest';
import { AssetLifecycleAi, type Asset } from '../asset-lifecycle-ai';

describe('AssetLifecycleAi', () => {
  const svc = new AssetLifecycleAi();

  const assets: Asset[] = [
    {
      assetId: 'PC-001',
      name: '노트북',
      category: 'computer',
      acquisitionDate: '2021-04-01',
      acquisitionCostKrw: 2_000_000,
      usefulLifeYears: 5,
      method: 'straight-line',
      actualUsageRate: 1.0,
    },
    {
      assetId: 'VEH-001',
      name: '업무차량',
      category: 'vehicle',
      acquisitionDate: '2024-04-01',
      acquisitionCostKrw: 30_000_000,
      usefulLifeYears: 7,
      method: 'declining-balance',
      actualUsageRate: 1.2,
    },
  ];

  it('registers valid assets', () => {
    const reg = svc.registerAssets(assets);
    expect(reg.length).toBe(2);
  });

  it('computes straight line depreciation', () => {
    const dep = svc.computeDepreciation(assets[0]!, '2026-04-01');
    expect(dep.yearsElapsed).toBeGreaterThan(4);
    expect(dep.accumulatedDepreciation).toBeGreaterThan(0);
  });

  it('computes declining balance depreciation', () => {
    const dep = svc.computeDepreciation(assets[1]!, '2026-04-01');
    expect(dep.accumulatedDepreciation).toBeGreaterThan(0);
    expect(dep.currentBookValue).toBeLessThan(assets[1]!.acquisitionCostKrw);
  });

  it('forecasts residual value', () => {
    const v = svc.forecastResidualValue(assets[0]!, 5);
    expect(v).toBe(0);
  });

  it('recommends replacement for old asset', () => {
    const rec = svc.recommendReplacement(assets[0]!, '2026-04-01');
    expect(rec.recommend).toBe(true);
  });

  it('estimates budget', () => {
    const est = svc.estimateBudget(assets, '2026-04-01');
    expect(est.totalBudgetKrw).toBeGreaterThanOrEqual(0);
  });
});
