import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicPricingOptimizerV2 } from '../dynamic-pricing-optimizer-v2';

describe('DynamicPricingOptimizerV2', () => {
  let opt: DynamicPricingOptimizerV2;

  beforeEach(() => {
    opt = new DynamicPricingOptimizerV2();
  });

  it('clamps demand below 0.5', () => {
    const r = opt.optimize({ basePrice: 1000, demandRatio: 0.2, facilityOwner: 'gu1' });
    expect(r.demandFactor).toBe(0.5);
    expect(r.recommendedPrice).toBe(500);
  });

  it('clamps demand above 2.0', () => {
    const r = opt.optimize({ basePrice: 1000, demandRatio: 5.0, facilityOwner: 'gu1' });
    expect(r.demandFactor).toBe(2.0);
    expect(r.recommendedPrice).toBe(2000);
  });

  it('uses normal demand factor', () => {
    const r = opt.optimize({ basePrice: 1000, demandRatio: 1.2, facilityOwner: 'gu1' });
    expect(r.recommendedPrice).toBe(1200);
  });

  it('masks facilityOwner', () => {
    const r = opt.optimize({ basePrice: 100, demandRatio: 1.0, facilityOwner: 'park@city.gov' });
    expect(r.maskedOwner).toMatch(/^[0-9a-f]{16}$/);
    expect(r.maskedOwner).not.toContain('@');
  });

  it('rejects negative basePrice', () => {
    expect(() => opt.optimize({ basePrice: -10, demandRatio: 1, facilityOwner: 'g' })).toThrow();
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    const inp = { basePrice: 100, demandRatio: 1, facilityOwner: 'g' };
    expect(() => opt.optimize(inp, 'C')).toThrow('BLOCKED');
    expect(() => opt.optimize(inp, 'S')).toThrow('BLOCKED');
  });

  it('records audit log', () => {
    opt.optimize({ basePrice: 100, demandRatio: 1, facilityOwner: 'g' });
    expect(opt.getAuditLog().some((e) => e.action === 'OPTIMIZE_PRICE')).toBe(true);
  });
});
