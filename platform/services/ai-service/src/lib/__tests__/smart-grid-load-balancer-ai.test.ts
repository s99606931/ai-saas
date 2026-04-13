import { describe, it, expect } from 'vitest';
import { SmartGridLoadBalancerAI } from '../smart-grid-load-balancer-ai.js';

describe('SVC-AI-ADV-R430 SmartGridLoadBalancerAI', () => {
  const svc = new SmartGridLoadBalancerAI();

  it('FR-430.2: 상태 분류', () => {
    const r = svc.balance([
      { regionId: 'OL', demandMW: 950, capacityMW: 1000 }, // 0.95 OVERLOAD
      { regionId: 'NM', demandMW: 700, capacityMW: 1000 }, // 0.7 NORMAL
      { regionId: 'SL', demandMW: 300, capacityMW: 1000 }, // 0.3 SLACK
    ]);
    const statusMap = new Map(r.statuses.map((s) => [s.regionId, s.status]));
    expect(statusMap.get('OL')).toBe('OVERLOAD');
    expect(statusMap.get('NM')).toBe('NORMAL');
    expect(statusMap.get('SL')).toBe('SLACK');
  });

  it('FR-430.3~4: 과부하 → 저부하로 이전', () => {
    const r = svc.balance([
      { regionId: 'OL', demandMW: 950, capacityMW: 1000 }, // overflow=50
      { regionId: 'SL', demandMW: 100, capacityMW: 1000 }, // slack=800
    ]);
    expect(r.transfers.length).toBeGreaterThan(0);
    expect(r.transfers[0]!.from).toBe('SL');
    expect(r.transfers[0]!.to).toBe('OL');
    expect(r.transfers[0]!.mw).toBe(50);
  });

  it('FR-430.3: 과부하 여러 개, 가장 큰 slack부터 사용', () => {
    const r = svc.balance([
      { regionId: 'OL', demandMW: 1000, capacityMW: 1000 }, // overflow=100
      { regionId: 'S1', demandMW: 100, capacityMW: 1000 }, // slack=800
      { regionId: 'S2', demandMW: 300, capacityMW: 1000 }, // slack=600
    ]);
    expect(r.transfers[0]!.from).toBe('S1');
    expect(r.transfers[0]!.mw).toBe(100);
  });

  it('FR-430.3: 과부하 없음 → 이전 없음', () => {
    const r = svc.balance([
      { regionId: 'NM1', demandMW: 700, capacityMW: 1000 },
      { regionId: 'NM2', demandMW: 600, capacityMW: 1000 },
    ]);
    expect(r.transfers.length).toBe(0);
  });

  it('FR-430.5: C 차단', () => {
    expect(() => svc.balance([], 'C')).toThrow('N2SF_BLOCKED');
  });

  it('잘못된 capacity → 오류', () => {
    expect(() => svc.balance([{ regionId: 'x', demandMW: 10, capacityMW: 0 }])).toThrow(
      'INVALID_CAPACITY',
    );
  });

  it('감사 로그', () => {
    svc.balance([{ regionId: 'R', demandMW: 500, capacityMW: 1000 }]);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
