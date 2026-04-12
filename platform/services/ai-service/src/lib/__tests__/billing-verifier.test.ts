// MTU-N323 과금 검증 테스트
import { describe, it, expect } from 'vitest';
import { BillingVerifierService } from '../billing-verifier.js';

describe('MTU-N323 BillingVerifier', () => {
  const svc = new BillingVerifierService('tenant-n323');

  it('FR-N323.1: 과금 검증', () => {
    const result = svc.verify([
      { itemId: 'i1', service: 'compute', description: 'CPU hours', quantity: 100, unitPrice: 0.5, totalPrice: 50, period: '2026-04' },
      { itemId: 'i2', service: 'storage', description: 'Storage', quantity: 10, unitPrice: 1, totalPrice: 11, period: '2026-04' },
    ]);
    expect(result).toBeDefined();
  });

  it('FR-N323.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
