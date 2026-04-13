import { describe, it, expect } from 'vitest';
import { PublicFinanceOptimizer } from '../public-finance-optimizer.js';

describe('SVC-AI-ADV-R403 PublicFinanceOptimizer', () => {
  const svc = new PublicFinanceOptimizer();

  it('FR-393.1: ROI 계산 및 정렬', () => {
    const r = svc.optimize([
      { id: 'a', name: 'A', benefit: 200, cost: 100 }, // roi=2.0
      { id: 'b', name: 'B', benefit: 50, cost: 100 }, // roi=0.5
      { id: 'c', name: 'C', benefit: 300, cost: 100 }, // roi=3.0
    ]);
    expect(r.ranked[0]?.id).toBe('c');
    expect(r.ranked[0]?.roi).toBe(3);
  });

  it('FR-393.2: 하위 항목 (roi < 1)', () => {
    const r = svc.optimize([
      { id: 'a', name: 'A', benefit: 200, cost: 100 },
      { id: 'b', name: 'B', benefit: 30, cost: 100 },
      { id: 'c', name: 'C', benefit: 10, cost: 50 },
    ]);
    const reduceIds = r.reduceList.map((x) => x.id);
    expect(reduceIds).toContain('b');
    expect(reduceIds).toContain('c');
  });

  it('FR-393.3: 재배분 금액', () => {
    const r = svc.optimize([
      { id: 'x', name: 'X', benefit: 10, cost: 100 },
      { id: 'y', name: 'Y', benefit: 1000, cost: 100 },
    ]);
    // reduceList: x (cost=100) → reallocAmount = 100*0.2 = 20
    expect(r.reallocAmount).toBe(20);
  });

  it('FR-393.4: S등급 차단', () => {
    expect(() => svc.optimize([{ id: 'a', name: 'A', benefit: 1, cost: 1 }], 'S')).toThrow(
      'N2SF_BLOCKED',
    );
  });

  it('FR-393.5: 빈 입력 거부', () => {
    expect(() => svc.optimize([])).toThrow('INVALID_INPUT');
  });

  it('음수 값 거부', () => {
    expect(() => svc.optimize([{ id: 'a', name: 'A', benefit: -1, cost: 1 }])).toThrow(
      'INVALID_ITEM',
    );
  });
});
