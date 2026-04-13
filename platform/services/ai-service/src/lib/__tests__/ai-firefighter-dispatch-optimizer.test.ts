import { describe, it, expect, beforeEach } from 'vitest';
import {
  FirefighterDispatchOptimizer,
  type FireStation,
  type Incident,
} from '../ai-firefighter-dispatch-optimizer';

const station = (id: string, over: Partial<FireStation> = {}): FireStation => ({
  stationId: id,
  lat: 37.5,
  lng: 127.0,
  availableTrucks: 3,
  equipments: ['fire', 'rescue', 'medical'],
  ...over,
});

const incident = (over: Partial<Incident> = {}): Incident => ({
  incidentId: 'i1',
  type: 'fire',
  lat: 37.51,
  lng: 127.02,
  severity: 3,
  ...over,
});

describe('FirefighterDispatchOptimizer', () => {
  let ai: FirefighterDispatchOptimizer;

  beforeEach(() => {
    ai = new FirefighterDispatchOptimizer();
  });

  it('가장 가까운 소방서 선택', () => {
    ai.registerStation(station('s1', { lat: 37.5, lng: 127.0 }));
    ai.registerStation(station('s2', { lat: 38.0, lng: 127.5 }));
    const plan = ai.optimize(incident());
    expect(plan.stationId).toBe('s1');
  });

  it('장비 없는 소방서 제외', () => {
    ai.registerStation(station('s1', { equipments: ['medical'] }));
    ai.registerStation(station('s2', { equipments: ['fire'], lat: 37.6, lng: 127.1 }));
    const plan = ai.optimize(incident({ type: 'fire' }));
    expect(plan.stationId).toBe('s2');
  });

  it('대응 불가 시 에러', () => {
    ai.registerStation(station('s1', { equipments: ['medical'] }));
    expect(() => ai.optimize(incident({ type: 'hazmat' }))).toThrow();
  });

  it('배차 후 차량 감소 및 복귀', () => {
    ai.registerStation(station('s1', { availableTrucks: 3 }));
    ai.optimize(incident({ severity: 4 }));
    ai.releaseTrucks('s1', 1);
    expect(ai.listDispatches().length).toBe(1);
  });

  it('감사 로그 기록', () => {
    ai.registerStation(station('s1'));
    ai.optimize(incident());
    expect(ai.getAuditLog().length).toBeGreaterThanOrEqual(2);
  });

  it('C등급 차단', () => {
    expect(() => ai.registerStation(station('s1'), 'C')).toThrow('BLOCKED');
  });
});
