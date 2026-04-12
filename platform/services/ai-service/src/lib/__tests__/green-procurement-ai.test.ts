import { describe, it, expect, beforeEach } from 'vitest';
import { GreenProcurementAi, type CertifiedProduct } from '../green-procurement-ai';

describe('GreenProcurementAi', () => {
  let svc: GreenProcurementAi;
  const today = new Date('2026-04-11');

  const products: CertifiedProduct[] = [
    { id: 'p1', name: '재생지 A4', category: 'paper', certifications: ['환경마크', '저탄소'], expiresAt: '2027-01-01', price: 5000 },
    { id: 'p2', name: '일반 A4', category: 'paper', certifications: [], expiresAt: '2027-01-01', price: 3000 },
    { id: 'p3', name: '만료된 재생지', category: 'paper', certifications: ['환경마크'], expiresAt: '2025-01-01', price: 4000 },
    { id: 'p4', name: '재생지 B5', category: 'paper', certifications: ['환경마크'], expiresAt: '2026-05-01', price: 4500 },
  ];

  beforeEach(() => {
    svc = new GreenProcurementAi();
    products.forEach((p) => svc.registerProduct(p));
  });

  it('FR-GP.1 제품 등록', () => {
    expect(svc.recommend({ id: 'r0', category: 'paper', budget: 10000, quantity: 1 }, today).length).toBeGreaterThan(0);
  });

  it('FR-GP.2 추천 (만료 제외, 인증 우선)', () => {
    const recs = svc.recommend({ id: 'r1', category: 'paper', budget: 10000, quantity: 1 }, today);
    expect(recs.find((r) => r.productId === 'p3')).toBeUndefined();
    expect(recs[0]!.productId).toBe('p1');
  });

  it('FR-GP.3 의무비율 추적', () => {
    const status = svc.trackCompliance(
      [{ productId: 'p1', amount: 100000 }, { productId: 'p2', amount: 50000 }],
      0.2,
    );
    expect(status.ratio).toBeCloseTo(0.667, 2);
    expect(status.achieved).toBe(true);
  });

  it('FR-GP.4 만료 임박 알림', () => {
    const expiring = svc.findExpiring(60, today);
    expect(expiring.find((p) => p.id === 'p4')).toBeDefined();
  });

  it('FR-GP.5 대체품 추천', () => {
    const alts = svc.findAlternatives('p3', today);
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.find((p) => p.id === 'p1')).toBeDefined();
  });
});
