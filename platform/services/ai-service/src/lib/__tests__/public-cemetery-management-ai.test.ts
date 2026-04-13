import { describe, it, expect, beforeEach } from 'vitest';
import { PublicCemeteryManagementAI } from '../public-cemetery-management-ai';

describe('PublicCemeteryManagementAI', () => {
  let ai: PublicCemeteryManagementAI;

  beforeEach(() => {
    ai = new PublicCemeteryManagementAI();
    ai.registerPlot({ plotId: 'p1', zone: 'A', kind: 'burial', status: 'available', capacity: 1 });
    ai.registerPlot({ plotId: 'p2', zone: 'A', kind: 'charnel', status: 'available', capacity: 1 });
    ai.registerPlot({ plotId: 'p3', zone: 'B', kind: 'naturalBurial', status: 'available', capacity: 1 });
  });

  it('구역을 등록한다', () => {
    const stats = ai.getOccupancyStats();
    expect(stats.totalPlots).toBe(3);
    expect(stats.available).toBe(3);
  });

  it('계약을 생성하고 점유 상태로 변경한다', () => {
    ai.createContract({
      contractId: 'c1',
      plotId: 'p1',
      familyIdHash: 'abcdef123456',
      startDate: '2026-01-01',
      endDate: '2031-01-01',
    });
    const stats = ai.getOccupancyStats();
    expect(stats.occupied).toBe(1);
    expect(stats.available).toBe(2);
  });

  it('PII가 포함된 가족ID는 거부한다', () => {
    expect(() =>
      ai.createContract({
        contractId: 'c1',
        plotId: 'p1',
        familyIdHash: '홍길동',
        startDate: '2026-01-01',
        endDate: '2031-01-01',
      }),
    ).toThrow('해시값');
  });

  it('만료 임박 계약을 조회한다', () => {
    ai.createContract({
      contractId: 'c1',
      plotId: 'p1',
      familyIdHash: 'deadbeef00',
      startDate: '2026-01-01',
      endDate: '2026-05-01',
    });
    const expiring = ai.getExpiringContracts(30, '2026-04-13T00:00:00Z');
    expect(expiring.length).toBe(1);
    expect(expiring[0]!.contractId).toBe('c1');
  });

  it('구역별 점유 통계를 계산한다', () => {
    ai.createContract({
      contractId: 'c1',
      plotId: 'p3',
      familyIdHash: 'cafebabe00',
      startDate: '2026-01-01',
      endDate: '2031-01-01',
    });
    const zoneA = ai.getOccupancyStats('A');
    const zoneB = ai.getOccupancyStats('B');
    expect(zoneA.occupied).toBe(0);
    expect(zoneB.occupied).toBe(1);
    expect(zoneB.utilizationPercent).toBe(100);
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerPlot(
        { plotId: 'pX', zone: 'Z', kind: 'burial', status: 'available', capacity: 1 },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
