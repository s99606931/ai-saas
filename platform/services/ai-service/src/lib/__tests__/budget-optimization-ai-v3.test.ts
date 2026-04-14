import { describe, it, expect } from 'vitest';
import { BudgetOptimizationAiV3 } from '../budget-optimization-ai-v3.js';

describe('SVC-AI-ADV-R607 (v3) BudgetOptimizationAiV3', () => {
  const svc = new BudgetOptimizationAiV3();

  it('FR-R607v3.3: 저우선+저집행 → REDUCE', () => {
    const r = svc.optimize([{ id: 'b1', allocated: 1000, spent: 200, priority: 'LOW' }]);
    expect(r.items[0]?.action).toBe('REDUCE');
  });

  it('FR-R607v3.3: 고우선+고집행 → INCREASE', () => {
    const r = svc.optimize([{ id: 'b2', allocated: 1000, spent: 950, priority: 'HIGH' }]);
    expect(r.items[0]?.action).toBe('INCREASE');
  });

  it('FR-R607v3.3: 일반 → HOLD', () => {
    const r = svc.optimize([{ id: 'b3', allocated: 1000, spent: 700, priority: 'MEDIUM' }]);
    expect(r.items[0]?.action).toBe('HOLD');
  });

  it('FR-R607v3.2: allocated=0 → utilization=0', () => {
    const r = svc.optimize([{ id: 'b4', allocated: 0, spent: 0, priority: 'LOW' }]);
    expect(r.items[0]?.utilization).toBe(0);
  });

  it('FR-R607v3.4: 전체 집계', () => {
    const r = svc.optimize([
      { id: 'b5', allocated: 1000, spent: 500, priority: 'MEDIUM' },
      { id: 'b6', allocated: 2000, spent: 1500, priority: 'MEDIUM' },
    ]);
    expect(r.totalAllocated).toBe(3000);
    expect(r.totalSpent).toBe(2000);
    expect(r.overallUtilization).toBeCloseTo(2 / 3);
  });

  it('FR-R607v3.5: 감사 로그', () => {
    const local = new BudgetOptimizationAiV3();
    local.optimize([{ id: 'b7', allocated: 100, spent: 10, priority: 'LOW' }]);
    expect(local.getAuditLog()).toHaveLength(1);
  });
});
