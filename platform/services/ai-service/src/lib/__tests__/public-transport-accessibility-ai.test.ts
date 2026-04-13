import { describe, it, expect, beforeEach } from 'vitest';
import { PublicTransportAccessibilityAI } from '../public-transport-accessibility-ai';

describe('PublicTransportAccessibilityAI', () => {
  let ai: PublicTransportAccessibilityAI;

  beforeEach(() => {
    ai = new PublicTransportAccessibilityAI();
    ai.registerStop({ id: 's1', mode: 'subway', frequencyPerHour: 10, lineCount: 2 });
    ai.registerStop({ id: 's2', mode: 'bus', frequencyPerHour: 6, lineCount: 3 });
  });

  it('정류장과 존을 등록한다', () => {
    ai.registerZone({
      id: 'z1', population: 10000,
      nearestStops: [{ stopId: 's1', walkMinutes: 5 }],
    });
    expect(ai.getAuditLog().some(l => l.action === 'REGISTER_ZONE')).toBe(true);
  });

  it('가까운 지하철역이 있는 존은 우수 등급', () => {
    ai.registerZone({
      id: 'z1', population: 10000,
      nearestStops: [{ stopId: 's1', walkMinutes: 3 }],
    });
    const r = ai.computeScore('z1');
    expect(r.grade).toBe('excellent');
  });

  it('먼 정류장은 약점으로 기록된다', () => {
    ai.registerZone({
      id: 'z1', population: 5000,
      nearestStops: [{ stopId: 's2', walkMinutes: 18 }],
    });
    const r = ai.computeScore('z1');
    expect(r.weakPoints.some(p => p.includes('도보'))).toBe(true);
  });

  it('존 순위를 계산한다', () => {
    ai.registerZone({
      id: 'z1', population: 5000, nearestStops: [{ stopId: 's1', walkMinutes: 3 }],
    });
    ai.registerZone({
      id: 'z2', population: 3000, nearestStops: [{ stopId: 's2', walkMinutes: 15 }],
    });
    const ranked = ai.rankZones();
    const first = ranked[0];
    expect(first?.zoneId).toBe('z1');
  });

  it('미등록 존 조회 시 에러', () => {
    expect(() => ai.computeScore('unknown')).toThrow();
  });

  it('C등급을 차단한다', () => {
    expect(() => ai.registerZone({
      id: 'z1', population: 1000, nearestStops: [],
    }, 'C' as unknown as never)).toThrow(/BLOCKED/);
  });
});
