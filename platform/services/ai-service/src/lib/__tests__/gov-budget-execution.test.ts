import { describe, it, expect } from 'vitest';
import { GovBudgetExecution, type BudgetLineItem, type Expenditure } from '../gov-budget-execution';

describe('GovBudgetExecution', () => {
  const svc = new GovBudgetExecution();
  const items: BudgetLineItem[] = [
    { itemId: 'I1', category: 'IT', plannedAmount: 10_000_000, fiscalYear: 2026 },
    { itemId: 'I2', category: 'EDU', plannedAmount: 5_000_000, fiscalYear: 2026 },
  ];

  it('calculates execution pace', () => {
    const exps: Expenditure[] = [
      { txId: 'T1', itemId: 'I1', amount: 3_000_000, date: '2026-03-01' },
    ];
    const pace = svc.calcPace(items, exps, 90);
    const p1 = pace.find((p) => p.itemId === 'I1')!;
    expect(p1.executionRate).toBe(0.3);
    expect(p1.status).toBeDefined();
  });

  it('detects spike anomaly', () => {
    const exps: Expenditure[] = [
      { txId: 'T1', itemId: 'I1', amount: 100_000, date: '2026-02-01' },
      { txId: 'T2', itemId: 'I1', amount: 120_000, date: '2026-02-15' },
      { txId: 'T3', itemId: 'I1', amount: 5_000_000, date: '2026-03-01' },
    ];
    const anomalies = svc.detectAnomalies(items, exps);
    const spike = anomalies.find((a) => a.kind === 'spike');
    expect(spike).toBeDefined();
    expect(spike!.severity).toBe('high');
  });

  it('detects duplicate expenditure', () => {
    const exps: Expenditure[] = [
      { txId: 'D1', itemId: 'I1', amount: 100_000, date: '2026-02-01', vendor: 'V' },
      { txId: 'D2', itemId: 'I1', amount: 100_000, date: '2026-02-01', vendor: 'V' },
    ];
    const anomalies = svc.detectAnomalies(items, exps);
    expect(anomalies.some((a) => a.kind === 'duplicate')).toBe(true);
  });

  it('suggests savings for lagging items', () => {
    const exps: Expenditure[] = [
      { txId: 'T1', itemId: 'I2', amount: 100_000, date: '2026-01-01' },
    ];
    const pace = svc.calcPace(items, exps, 300);
    const sugg = svc.suggestSavings(pace);
    expect(sugg.length).toBeGreaterThan(0);
  });

  it('forecasts unused budget', () => {
    const exps: Expenditure[] = [
      { txId: 'T1', itemId: 'I1', amount: 1_000_000, date: '2026-01-01' },
    ];
    const pace = svc.calcPace(items, exps, 300);
    const forecast = svc.forecastUnused(pace);
    expect(forecast).toHaveLength(2);
    expect(forecast[0]!.forecastUnused).toBeGreaterThanOrEqual(0);
  });
});
