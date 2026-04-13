import { describe, it, expect, beforeEach } from 'vitest';
import { BusRouteOptimizerAI } from '../bus-route-optimizer-ai';

describe('BusRouteOptimizerAI', () => {
  let ai: BusRouteOptimizerAI;

  beforeEach(() => {
    ai = new BusRouteOptimizerAI();
  });

  it('정류장을 등록한다', () => {
    ai.registerStop({ stopId: 's1', name: '시청', demandScore: 80, transferHub: true });
    expect(ai.listStops().length).toBe(1);
  });

  it('노선을 제안한다', () => {
    ai.registerStop({ stopId: 's1', name: 'A', demandScore: 70, transferHub: true });
    ai.registerStop({ stopId: 's2', name: 'B', demandScore: 50, transferHub: false });
    ai.proposeRoute({ routeId: 'r1', stopIds: ['s1', 's2'], totalDistanceKm: 5 });
    expect(ai.listRoutes().length).toBe(1);
  });

  it('노선을 최적화한다', () => {
    ai.registerStop({ stopId: 's1', name: 'A', demandScore: 90, transferHub: true });
    ai.registerStop({ stopId: 's2', name: 'B', demandScore: 80, transferHub: true });
    ai.registerStop({ stopId: 's3', name: 'C', demandScore: 60, transferHub: false });
    ai.proposeRoute({ routeId: 'r1', stopIds: ['s1', 's2', 's3'], totalDistanceKm: 10 });
    const result = ai.optimize('r1');
    expect(result.hubCount).toBe(2);
    expect(['approve', 'revise', 'reject']).toContain(result.recommendation);
  });

  it('2개 미만 정류장 노선은 거부한다', () => {
    ai.registerStop({ stopId: 's1', name: 'A', demandScore: 50, transferHub: false });
    expect(() => ai.proposeRoute({ routeId: 'r1', stopIds: ['s1'], totalDistanceKm: 1 })).toThrow('최소 2개');
  });

  it('미등록 정류장은 거부한다', () => {
    expect(() => ai.proposeRoute({ routeId: 'r1', stopIds: ['s1', 's2'], totalDistanceKm: 5 })).toThrow(
      '정류장 미등록',
    );
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() => ai.registerStop({ stopId: 's1', name: 'X', demandScore: 50, transferHub: false }, 'C')).toThrow(
      'BLOCKED',
    );
  });
});
