import { describe, it, expect } from 'vitest';
import { CostObservabilityEngine, type EndpointUsage, type DailyCostPoint } from '../cost-observability-engine';

describe('CostObservabilityEngine', () => {
  const svc = new CostObservabilityEngine();

  const usage: EndpointUsage[] = [
    {
      endpoint: '/api/users',
      method: 'GET',
      cpuSeconds: 1000,
      memoryGbSeconds: 500,
      networkGb: 2,
      invocations: 10000,
    },
    {
      endpoint: '/api/heavy',
      method: 'POST',
      cpuSeconds: 5000,
      memoryGbSeconds: 2000,
      networkGb: 10,
      invocations: 1000,
    },
    {
      endpoint: '/api/zero',
      method: 'GET',
      cpuSeconds: 0,
      memoryGbSeconds: 0,
      networkGb: 0,
      invocations: 0,
    },
  ];

  const price = { cpuPerSecondKrw: 0.1, memoryGbSecondKrw: 0.05, networkGbKrw: 10 };

  it('normalizes usage excluding zero invocations', () => {
    const norm = svc.normalizeUsage(usage);
    expect(norm.length).toBe(2);
  });

  it('validates price table', () => {
    expect(svc.validatePriceTable(price)).toBe(true);
    expect(svc.validatePriceTable({ ...price, cpuPerSecondKrw: -1 })).toBe(false);
  });

  it('computes endpoint costs', () => {
    const costs = svc.computeCosts(svc.normalizeUsage(usage), price);
    expect(costs.length).toBe(2);
    expect(costs[0]?.totalKrw).toBeGreaterThan(0);
    expect(costs[1]?.totalKrw).toBeGreaterThan(costs[0]?.totalKrw ?? 0);
  });

  it('detects cost anomalies 2 sigma', () => {
    const history: DailyCostPoint[] = [
      { date: '2026-04-01', endpoint: '/x', totalKrw: 100 },
      { date: '2026-04-02', endpoint: '/x', totalKrw: 100 },
      { date: '2026-04-03', endpoint: '/x', totalKrw: 100 },
      { date: '2026-04-04', endpoint: '/x', totalKrw: 100 },
      { date: '2026-04-05', endpoint: '/x', totalKrw: 102 },
      { date: '2026-04-06', endpoint: '/x', totalKrw: 98 },
      { date: '2026-04-07', endpoint: '/x', totalKrw: 800 },
    ];
    const anomalies = svc.detectAnomalies(history);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0]?.endpoint).toBe('/x');
  });

  it('generates monthly report', () => {
    const costs = svc.computeCosts(svc.normalizeUsage(usage), price);
    const report = svc.generateReport(costs, '2026-04');
    expect(report).toContain('2026-04 비용 리포트');
    expect(report).toContain('총 비용');
  });
});
