import { describe, it, expect } from 'vitest';
import { APIMarketplace, type APIListing, type PricingPlan, type UsageRecord } from '../api-marketplace';

describe('APIMarketplace', () => {
  const mp = new APIMarketplace();

  it('registers valid API', () => {
    const listing = mp.register({
      apiId: 'A1',
      publisherId: 'P1',
      name: '기상청 API',
      category: 'data',
      baseUrl: 'https://api.example.kr',
      openapiVersion: '3.0.3',
      endpoints: [{ path: '/weather', method: 'GET' }],
    });
    expect(listing.status).toBe('review');
  });

  it('rejects non-3.x openapi', () => {
    expect(() =>
      mp.register({
        apiId: 'A',
        publisherId: 'P',
        name: 'x',
        category: 'c',
        baseUrl: 'https://x.kr',
        openapiVersion: '2.0',
        endpoints: [{ path: '/', method: 'GET' }],
      }),
    ).toThrow();
  });

  it('validates subscription plan fee', () => {
    expect(() =>
      mp.createPlan({ planId: 'PL1', apiId: 'A1', kind: 'subscription' }),
    ).toThrow();
    const ok = mp.createPlan({
      planId: 'PL1',
      apiId: 'A1',
      kind: 'subscription',
      monthlyFee: 10000,
    });
    expect(ok.monthlyFee).toBe(10000);
  });

  it('computes payg charge with free quota', () => {
    const plan: PricingPlan = {
      planId: 'PL2',
      apiId: 'A1',
      kind: 'payg',
      unitPrice: 10,
      freeQuota: 100,
    };
    const usage: UsageRecord = {
      apiId: 'A1',
      consumerId: 'C1',
      planId: 'PL2',
      calls: 150,
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
    };
    const charge = mp.computeCharge(usage, plan);
    expect(charge.usageCharge).toBe(500);
    expect(charge.total).toBe(500);
  });

  it('aggregates reviews', () => {
    const agg = mp.aggregateReviews([
      { apiId: 'A1', consumerId: 'C1', rating: 5, createdAt: '' },
      { apiId: 'A1', consumerId: 'C2', rating: 3, createdAt: '' },
    ]);
    expect(agg.count).toBe(2);
    expect(agg.avg).toBe(4);
  });

  it('settles revenue with platform fee', () => {
    const listings: APIListing[] = [
      {
        apiId: 'A1',
        publisherId: 'P1',
        name: 'n',
        category: 'c',
        baseUrl: 'https://x.kr',
        openapiVersion: '3.0',
        endpoints: [{ path: '/', method: 'GET' }],
        status: 'approved',
      },
    ];
    const plans: PricingPlan[] = [
      { planId: 'PL', apiId: 'A1', kind: 'payg', unitPrice: 10, freeQuota: 0 },
    ];
    const usages: UsageRecord[] = [
      {
        apiId: 'A1',
        consumerId: 'C',
        planId: 'PL',
        calls: 100,
        periodStart: '',
        periodEnd: '',
      },
    ];
    const settle = mp.settleRevenue(usages, plans, listings);
    expect(settle).toHaveLength(1);
    expect(settle[0]!.gross).toBe(1000);
    expect(settle[0]!.platformFee).toBe(150);
    expect(settle[0]!.net).toBe(850);
  });
});
