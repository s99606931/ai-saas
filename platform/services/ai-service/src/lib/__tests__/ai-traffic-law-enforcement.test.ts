import { describe, it, expect, beforeEach } from 'vitest';
import { AITrafficLawEnforcement } from '../ai-traffic-law-enforcement';

describe('AITrafficLawEnforcement', () => {
  let ai: AITrafficLawEnforcement;

  beforeEach(() => {
    ai = new AITrafficLawEnforcement();
  });

  it('기본 신호위반 과태료', () => {
    const r = ai.enforce({
      eventId: 'E1',
      timestamp: '2026-04-13T10:00:00Z',
      type: 'signal',
      vehicleClass: 'car',
      schoolZone: false,
    });
    expect(r.fine).toBe(60000);
    expect(r.demeritPoints).toBe(15);
  });

  it('스쿨존 2배 가중', () => {
    const r = ai.enforce({
      eventId: 'E2',
      timestamp: '2026-04-13T10:00:00Z',
      type: 'signal',
      vehicleClass: 'car',
      schoolZone: true,
    });
    expect(r.fine).toBe(120000);
  });

  it('40km/h 초과 시 가중', () => {
    const r = ai.enforce({
      eventId: 'E3',
      timestamp: '2026-04-13T10:00:00Z',
      type: 'speeding',
      vehicleClass: 'car',
      speedLimit: 60,
      actualSpeed: 105,
      schoolZone: false,
    });
    expect(r.fine).toBeGreaterThanOrEqual(70000);
    expect(r.demeritPoints).toBeGreaterThanOrEqual(45);
  });

  it('60km/h 초과 시 검토 필요', () => {
    const r = ai.enforce({
      eventId: 'E4',
      timestamp: '2026-04-13T10:00:00Z',
      type: 'speeding',
      vehicleClass: 'car',
      speedLimit: 60,
      actualSpeed: 130,
      schoolZone: false,
    });
    expect(r.reviewRequired).toBe(true);
  });

  it('대형차량 가중 10000원', () => {
    const r = ai.enforce({
      eventId: 'E5',
      timestamp: '2026-04-13T10:00:00Z',
      type: 'bus-lane',
      vehicleClass: 'truck',
      schoolZone: false,
    });
    expect(r.fine).toBe(60000);
  });

  it('속도 미달 시 오류', () => {
    expect(() =>
      ai.enforce({
        eventId: 'E6',
        timestamp: '2026-04-13T10:00:00Z',
        type: 'speeding',
        vehicleClass: 'car',
        speedLimit: 60,
        actualSpeed: 50,
        schoolZone: false,
      }),
    ).toThrow();
  });
});
