/**
 * 녹색구매 테스트
 * Plan SC: FR-GP.1~5
 */

import {
  GreenProductRegistry,
  GreenProcurementMatcher,
  MandatoryRatioTracker,
  CertifiedProduct,
} from '../src/green-procurement';

const sampleProduct = (overrides: Partial<CertifiedProduct> = {}): CertifiedProduct => ({
  productId: 'P-001',
  name: '재생용지 A4',
  category: 'paper',
  certificationType: 'eco-label',
  certificationNo: 'EL-2026-001',
  validUntil: '2027-12-31',
  vendor: 'GreenCo',
  pricePerUnit: 5000,
  ...overrides,
});

describe('GreenProductRegistry', () => {
  it('register + list', () => {
    const reg = new GreenProductRegistry();
    reg.register(sampleProduct());
    expect(reg.list().length).toBe(1);
  });

  it('findByCategory', () => {
    const reg = new GreenProductRegistry();
    reg.register(sampleProduct({ productId: 'P-1', category: 'paper' }));
    reg.register(sampleProduct({ productId: 'P-2', category: 'electronics' }));
    expect(reg.findByCategory('paper').length).toBe(1);
    expect(reg.findByCategory('paper')[0]?.productId).toBe('P-1');
  });

  it('findExpiring: 임계일 내 만료 검색', () => {
    const reg = new GreenProductRegistry();
    const today = new Date('2026-04-12');
    reg.register(
      sampleProduct({ productId: 'A', validUntil: '2026-05-01' }), // 임박
    );
    reg.register(
      sampleProduct({ productId: 'B', validUntil: '2027-12-31' }), // 여유
    );
    reg.register(
      sampleProduct({ productId: 'C', validUntil: '2026-04-01' }), // 이미 만료
    );
    const expiring = reg.findExpiring(30, today);
    expect(expiring.find((p) => p.productId === 'A')).toBeTruthy();
    expect(expiring.find((p) => p.productId === 'B')).toBeFalsy();
    expect(expiring.find((p) => p.productId === 'C')).toBeFalsy();
  });

  it('register: zod 검증 실패 시 오류', () => {
    const reg = new GreenProductRegistry();
    expect(() =>
      reg.register({ ...sampleProduct(), pricePerUnit: -100 }),
    ).toThrow();
  });
});

describe('GreenProcurementMatcher', () => {
  it('카테고리 + 키워드 + 예산 점수로 추천', () => {
    const reg = new GreenProductRegistry();
    reg.register(sampleProduct({ productId: 'A', name: '재생 A4 용지' }));
    reg.register(
      sampleProduct({
        productId: 'B',
        name: '저탄소 A4 용지',
        certificationType: 'low-carbon',
        pricePerUnit: 4500,
      }),
    );
    const matcher = new GreenProcurementMatcher(reg);
    const result = matcher.recommend({
      requestId: 'r1',
      category: 'paper',
      quantity: 100,
      maxBudgetKrw: 1000000,
      keywords: ['저탄소', 'A4'],
    });
    expect(result.length).toBe(2);
    // 저탄소 인증 + 키워드 일치 = 더 높은 점수
    expect(result[0]?.product.productId).toBe('B');
  });

  it('빈 카테고리 결과', () => {
    const reg = new GreenProductRegistry();
    const matcher = new GreenProcurementMatcher(reg);
    const result = matcher.recommend({
      requestId: 'r1',
      category: 'paper',
      quantity: 1,
      maxBudgetKrw: 1000,
      keywords: [],
    });
    expect(result).toEqual([]);
  });

  it('예산 초과 시 withinBudget false', () => {
    const reg = new GreenProductRegistry();
    reg.register(sampleProduct({ pricePerUnit: 100000 }));
    const matcher = new GreenProcurementMatcher(reg);
    const result = matcher.recommend({
      requestId: 'r1',
      category: 'paper',
      quantity: 100,
      maxBudgetKrw: 1000,
      keywords: [],
    });
    expect(result[0]?.withinBudget).toBe(false);
  });
});

describe('MandatoryRatioTracker', () => {
  it('20% 의무비율 달성 확인', () => {
    const t = new MandatoryRatioTracker();
    t.addRecord({
      recordId: '1',
      productId: 'A',
      amountKrw: 300,
      isCertified: true,
      period: '2026-Q2',
    });
    t.addRecord({
      recordId: '2',
      productId: 'B',
      amountKrw: 700,
      isCertified: false,
      period: '2026-Q2',
    });
    const result = t.calculateRatio('2026-Q2');
    expect(result.totalKrw).toBe(1000);
    expect(result.certifiedKrw).toBe(300);
    expect(result.ratioPercent).toBe(30);
    expect(result.achieved).toBe(true);
  });

  it('의무비율 미달', () => {
    const t = new MandatoryRatioTracker();
    t.addRecord({
      recordId: '1',
      productId: 'A',
      amountKrw: 100,
      isCertified: true,
      period: '2026-Q2',
    });
    t.addRecord({
      recordId: '2',
      productId: 'B',
      amountKrw: 900,
      isCertified: false,
      period: '2026-Q2',
    });
    const result = t.calculateRatio('2026-Q2');
    expect(result.achieved).toBe(false);
  });

  it('다른 period 레코드는 무관', () => {
    const t = new MandatoryRatioTracker();
    t.addRecord({
      recordId: '1',
      productId: 'A',
      amountKrw: 100,
      isCertified: true,
      period: '2026-Q1',
    });
    const result = t.calculateRatio('2026-Q2');
    expect(result.totalKrw).toBe(0);
    expect(result.ratioPercent).toBe(0);
  });
});
