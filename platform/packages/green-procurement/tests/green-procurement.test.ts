// Test Ref: MTU-N454 §green-procurement
// Plan SC: FR-GP.1 ~ FR-GP.5
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CertifiedProductRegistry,
  GreenMatcher,
  ObligationTracker,
  type CertifiedProduct,
} from '../src/index.js';

function p(overrides: Partial<CertifiedProduct>): CertifiedProduct {
  return {
    id: 'p1',
    name: '친환경 복사용지 A4',
    category: 'office_paper',
    certType: 'ENV_MARK',
    certNumber: 'EL-001',
    validUntil: '2027-12-31',
    manufacturer: '그린종이',
    tags: ['재생지', 'A4', '복사'],
    ...overrides,
  };
}

describe('CertifiedProductRegistry — FR-GP.1', () => {
  it('등록 및 카테고리 조회', () => {
    const reg = new CertifiedProductRegistry();
    reg.register(p({ id: 'a1' }));
    reg.register(p({ id: 'a2', name: '저탄소 프린터 토너', category: 'toner' }));
    expect(reg.size()).toBe(2);
    expect(reg.byCategoryList('office_paper').length).toBe(1);
    expect(reg.byCategoryList('toner')[0].id).toBe('a2');
  });

  it('findExpiring — FR-GP.4', () => {
    const reg = new CertifiedProductRegistry();
    reg.register(p({ id: 'e1', validUntil: '2026-05-01' }));
    reg.register(p({ id: 'e2', validUntil: '2027-12-01' }));
    const expiring = reg.findExpiring(new Date('2026-04-11'), 60);
    expect(expiring.map((x) => x.id)).toContain('e1');
    expect(expiring.map((x) => x.id)).not.toContain('e2');
  });
});

describe('GreenMatcher — FR-GP.2/5', () => {
  let reg: CertifiedProductRegistry;
  let matcher: GreenMatcher;
  beforeEach(() => {
    reg = new CertifiedProductRegistry();
    reg.register(p({ id: 'a1', name: '친환경 복사용지 A4', tags: ['재생지', 'A4'] }));
    reg.register(
      p({
        id: 'a2',
        name: '저탄소 복사용지 A4',
        tags: ['저탄소', 'A4'],
        certType: 'LOW_CARBON',
      }),
    );
    reg.register(
      p({ id: 'a3', name: 'GR 복사용지 A4', tags: ['GR', 'A4'], certType: 'GR' }),
    );
    matcher = new GreenMatcher(reg);
  });

  it('카테고리+키워드 기반 매칭', () => {
    const result = matcher.match(
      {
        id: 'r1',
        name: '복사용지 A4',
        category: 'office_paper',
        keywords: ['복사'],
        budgetKrw: 100_000,
      },
      3,
    );
    expect(result.matches.length).toBeGreaterThan(0);
    // 저탄소 가산점으로 a2가 상위
    expect(result.matches[0].product.id).toBe('a2');
  });

  it('만료 제품은 매칭에서 제외', () => {
    reg.register(
      p({
        id: 'expired',
        name: '복사용지 A4',
        tags: ['A4'],
        validUntil: '2020-01-01',
      }),
    );
    const result = matcher.match(
      { id: 'r1', name: '복사용지 A4', category: 'office_paper', budgetKrw: 100_000 },
      10,
      new Date('2026-04-11'),
    );
    expect(result.matches.map((m) => m.product.id)).not.toContain('expired');
  });

  it('대체품 추천 — 제외 ID 필터', () => {
    const alts = matcher.suggestAlternatives(
      { id: 'r1', name: '복사용지 A4', category: 'office_paper', budgetKrw: 50_000 },
      'a2',
      2,
    );
    expect(alts.map((a) => a.id)).not.toContain('a2');
    expect(alts.length).toBeLessThanOrEqual(2);
  });
});

describe('ObligationTracker — FR-GP.3', () => {
  it('의무비율 미달 시 gap 계산', () => {
    const tracker = new ObligationTracker(0.2);
    const status = tracker.compute([
      { amountKrw: 80, isGreen: false },
      { amountKrw: 10, isGreen: true },
      { amountKrw: 10, isGreen: false },
    ]);
    expect(status.totalBudgetKrw).toBe(100);
    expect(status.greenBudgetKrw).toBe(10);
    expect(status.ratio).toBe(0.1);
    expect(status.achieved).toBe(false);
    expect(status.gapKrw).toBe(10);
  });

  it('의무비율 달성 시 achieved true', () => {
    const tracker = new ObligationTracker(0.2);
    const status = tracker.compute([
      { amountKrw: 80, isGreen: true },
      { amountKrw: 20, isGreen: false },
    ]);
    expect(status.achieved).toBe(true);
    expect(status.gapKrw).toBe(0);
  });

  it('빈 구매 내역 방어', () => {
    const tracker = new ObligationTracker(0.2);
    const status = tracker.compute([]);
    expect(status.totalBudgetKrw).toBe(0);
    expect(status.ratio).toBe(0);
    expect(status.achieved).toBe(false);
  });
});
