import { describe, it, expect } from 'vitest';
import { TenantHealthScorecard, type TenantMetrics } from '../tenant-health-scorecard';

describe('TenantHealthScorecard', () => {
  const svc = new TenantHealthScorecard();

  const healthy: TenantMetrics = {
    tenantId: 'T1',
    dau: 80,
    wau: 90,
    mau: 100,
    totalUsers: 100,
    adoptedFeatures: 18,
    totalFeatures: 20,
    csat: 92,
    nps: 60,
    paymentFailures: 0,
    overdueDays: 0,
  };

  const critical: TenantMetrics = {
    tenantId: 'T2',
    dau: 2,
    wau: 5,
    mau: 10,
    totalUsers: 100,
    adoptedFeatures: 2,
    totalFeatures: 20,
    csat: 40,
    nps: -30,
    paymentFailures: 3,
    overdueDays: 30,
  };

  it('scores healthy tenant high', () => {
    const score = svc.calculate(healthy);
    expect(score.status).toBe('healthy');
    expect(score.total).toBeGreaterThan(0.65);
  });

  it('flags critical tenant', () => {
    const score = svc.calculate(critical);
    expect(score.status).toBe('critical');
    expect(score.alerts.length).toBeGreaterThan(0);
  });

  it('calculates breakdown', () => {
    const score = svc.calculate(healthy);
    expect(score.breakdown.usage).toBeGreaterThan(0);
    expect(score.breakdown.engagement).toBeGreaterThan(0);
    expect(score.breakdown.satisfaction).toBeGreaterThan(0);
    expect(score.breakdown.financial).toBe(1);
  });

  it('ranks at-risk tenants', () => {
    const ranked = svc.rankAtRisk([healthy, critical]);
    expect(ranked.length).toBe(1);
    expect(ranked[0]!.tenantId).toBe('T2');
  });

  it('handles zero totalUsers gracefully', () => {
    const empty: TenantMetrics = { ...healthy, tenantId: 'T3', totalUsers: 0, dau: 0, wau: 0 };
    const score = svc.calculate(empty);
    expect(score.breakdown.usage).toBe(0);
  });
});
