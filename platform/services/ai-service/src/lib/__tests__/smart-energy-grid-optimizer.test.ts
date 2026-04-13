/**
 * 스마트 에너지 그리드 최적화 단위 테스트 — SVC-AI-ADV-R466
 * Plan SC: FR-466.1~5
 */

import { describe, it, expect } from 'vitest';
import { SmartEnergyGridOptimizer } from '../smart-energy-grid-optimizer';

describe('SmartEnergyGridOptimizer — R466', () => {
  it('FR-466.3/4: 잉여 → 부족 지역 이체', () => {
    const o = new SmartEnergyGridOptimizer();
    const r = o.optimize([
      { id: 'A', demandKw: 100, supplyKw: 200 },
      { id: 'B', demandKw: 200, supplyKw: 100 },
    ]);
    expect(r.transfers).toHaveLength(1);
    expect(r.transfers[0]?.from).toBe('A');
    expect(r.transfers[0]?.to).toBe('B');
    expect(r.transfers[0]?.amountKw).toBe(100);
  });

  it('FR-466.2: 부분 이체 시 shortage 지역 남음', () => {
    const o = new SmartEnergyGridOptimizer();
    const r = o.optimize([
      { id: 'A', demandKw: 100, supplyKw: 150 },
      { id: 'B', demandKw: 300, supplyKw: 100 },
    ]);
    expect(r.shortageRegions).toContain('B');
  });

  it('FR-466.2: 균형 상태 시 이체 없음', () => {
    const o = new SmartEnergyGridOptimizer();
    const r = o.optimize([
      { id: 'A', demandKw: 100, supplyKw: 100 },
    ]);
    expect(r.transfers).toHaveLength(0);
  });

  it('FR-466.1: 음수 거부', () => {
    const o = new SmartEnergyGridOptimizer();
    expect(() =>
      o.optimize([{ id: 'A', demandKw: -1, supplyKw: 100 }]),
    ).toThrow();
  });

  it('FR-466.5: C/S 차단 + audit log', () => {
    const o = new SmartEnergyGridOptimizer();
    expect(() => o.optimize([], 'C')).toThrow(/N2SF_BLOCKED/);
    o.optimize([]);
    expect(o.getAuditLog().length).toBeGreaterThan(0);
  });
});
