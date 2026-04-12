import { describe, it, expect, beforeEach } from 'vitest';
import { AiCostAllocation, type PricingRule } from '../ai-cost-allocation.js';

const T0 = 1_700_000_000_000;

const baseRule: PricingRule = {
  modelId: 'gpt-x',
  inputPerKTok: 1,
  outputPerKTok: 2,
  effectiveFrom: T0,
};

describe('AiCostAllocation.setPricing/getPricing (FR-R55.2)', () => {
  let svc: AiCostAllocation;
  beforeEach(() => {
    svc = new AiCostAllocation();
  });

  it('단가 규칙 등록/조회', () => {
    svc.setPricing(baseRule);
    expect(svc.getPricing('gpt-x', T0 + 100)?.inputPerKTok).toBe(1);
  });

  it('시점에 따라 최신 규칙 선택', () => {
    svc.setPricing(baseRule);
    svc.setPricing({ ...baseRule, effectiveFrom: T0 + 1000, inputPerKTok: 5 });
    expect(svc.getPricing('gpt-x', T0 + 500)?.inputPerKTok).toBe(1);
    expect(svc.getPricing('gpt-x', T0 + 2000)?.inputPerKTok).toBe(5);
  });

  it('음수 단가 거부', () => {
    expect(() => svc.setPricing({ ...baseRule, inputPerKTok: -1 })).toThrow(
      'COST_INVALID_PRICING',
    );
  });

  it('미등록 모델 undefined', () => {
    expect(svc.getPricing('unknown', T0)).toBeUndefined();
  });
});

describe('AiCostAllocation.computeCost / record (FR-R55.1, R55.3)', () => {
  let svc: AiCostAllocation;
  beforeEach(() => {
    svc = new AiCostAllocation();
    svc.setPricing(baseRule);
  });

  it('input+output 비용 합산', () => {
    const cost = svc.computeCost({
      id: '1',
      tenantId: 't1',
      modelId: 'gpt-x',
      inputTokens: 1000,
      outputTokens: 500,
      timestamp: T0 + 1,
    });
    expect(cost).toBe(1 * 1 + 0.5 * 2);
  });

  it('record 시 entry 반환', () => {
    const entry = svc.record({
      id: '1',
      tenantId: 't1',
      modelId: 'gpt-x',
      inputTokens: 2000,
      outputTokens: 1000,
      timestamp: T0 + 1,
    });
    expect(entry.cost).toBe(2 + 2);
  });

  it('단가 미등록 시 예외', () => {
    expect(() =>
      svc.record({
        id: '1',
        tenantId: 't1',
        modelId: 'other',
        inputTokens: 1,
        outputTokens: 1,
        timestamp: T0,
      }),
    ).toThrow('COST_PRICING_NOT_FOUND');
  });

  it('음수 토큰 거부', () => {
    expect(() =>
      svc.record({
        id: '1',
        tenantId: 't1',
        modelId: 'gpt-x',
        inputTokens: -1,
        outputTokens: 0,
        timestamp: T0 + 1,
      }),
    ).toThrow('COST_INVALID_TOKENS');
  });
});

describe('AiCostAllocation aggregations (FR-R55.4, R55.5)', () => {
  let svc: AiCostAllocation;
  beforeEach(() => {
    svc = new AiCostAllocation();
    svc.setPricing(baseRule);
    svc.setPricing({
      modelId: 'gpt-y',
      inputPerKTok: 3,
      outputPerKTok: 3,
      effectiveFrom: T0,
    });
    const samples = [
      { tenant: 't1', model: 'gpt-x', i: 1000, o: 1000 },
      { tenant: 't1', model: 'gpt-y', i: 1000, o: 1000 },
      { tenant: 't2', model: 'gpt-x', i: 2000, o: 0 },
    ];
    samples.forEach((s, idx) => {
      svc.record({
        id: `${idx}`,
        tenantId: s.tenant,
        modelId: s.model,
        inputTokens: s.i,
        outputTokens: s.o,
        timestamp: T0 + idx,
      });
    });
  });

  it('테넌트별 집계', () => {
    const rows = svc.aggregateByTenant(T0, T0 + 100);
    expect(rows.get('t1')?.calls).toBe(2);
    expect(rows.get('t1')?.cost).toBe(1 * 1 + 1 * 2 + 3 + 3);
    expect(rows.get('t2')?.calls).toBe(1);
    expect(rows.get('t2')?.cost).toBe(2);
  });

  it('모델별 집계', () => {
    const rows = svc.aggregateByModel(T0, T0 + 100);
    expect(rows.get('gpt-x')?.calls).toBe(2);
    expect(rows.get('gpt-y')?.calls).toBe(1);
  });

  it('기간 필터', () => {
    const rows = svc.aggregateByTenant(T0 + 2, T0 + 100);
    expect(rows.get('t1')).toBeUndefined();
    expect(rows.get('t2')?.calls).toBe(1);
  });
});

describe('AiCostAllocation audit (FR-R55.6)', () => {
  it('record/aggregate/pricing 액션 기록', () => {
    const svc = new AiCostAllocation();
    svc.setPricing(baseRule);
    svc.record({
      id: '1',
      tenantId: 't1',
      modelId: 'gpt-x',
      inputTokens: 1000,
      outputTokens: 0,
      timestamp: T0 + 1,
    });
    svc.aggregateByTenant(T0, T0 + 100);
    const log = svc.getAuditLog();
    expect(log.some((e) => e.action === 'PRICING_CHANGED')).toBe(true);
    expect(log.some((e) => e.action === 'COST_RECORDED')).toBe(true);
    expect(log.some((e) => e.action === 'AGGREGATE_EXECUTED')).toBe(true);
  });
});
