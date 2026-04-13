import { describe, it, expect, beforeEach } from 'vitest';
import { CulturalEventSchedulerAI } from '../cultural-event-scheduler-ai';

describe('CulturalEventSchedulerAI', () => {
  let ai: CulturalEventSchedulerAI;

  beforeEach(() => {
    ai = new CulturalEventSchedulerAI();
    ai.registerVenue({ venueId: 'v1', capacity: 100, indoor: true });
    ai.registerVenue({ venueId: 'v2', capacity: 500, indoor: true });
    ai.registerVenue({ venueId: 'v3', capacity: 2000, indoor: false });
  });

  it('venue 등록', () => {
    expect(ai.getAuditLog().filter(l => l.action === 'REGISTER_VENUE').length).toBe(3);
  });

  it('관객 수에 맞는 가장 작은 venue 배정', () => {
    const s = ai.schedule_({
      eventId: 'e1',
      category: 'concert',
      expectedAudience: 80,
      durationHours: 2,
      preferredStart: '2026-05-01T19:00:00Z',
    });
    expect(s.venueId).toBe('v1');
    expect(s.utilization).toBeCloseTo(0.8);
  });

  it('용량 초과는 더 큰 venue 선택', () => {
    const s = ai.schedule_({
      eventId: 'e1',
      category: 'festival',
      expectedAudience: 300,
      durationHours: 3,
      preferredStart: '2026-05-01T19:00:00Z',
    });
    expect(s.venueId).toBe('v2');
  });

  it('충돌 시 시간 이동', () => {
    ai.schedule_({
      eventId: 'e1',
      category: 'concert',
      expectedAudience: 80,
      durationHours: 2,
      preferredStart: '2026-05-01T19:00:00Z',
    });
    const s2 = ai.schedule_({
      eventId: 'e2',
      category: 'concert',
      expectedAudience: 80,
      durationHours: 2,
      preferredStart: '2026-05-01T19:00:00Z',
    });
    expect(s2.venueId).toBe('v1');
    expect(new Date(s2.startAt).getTime()).toBeGreaterThan(new Date('2026-05-01T19:00:00Z').getTime());
  });

  it('모든 venue 초과는 오류', () => {
    expect(() =>
      ai.schedule_({
        eventId: 'e1',
        category: 'festival',
        expectedAudience: 5000,
        durationHours: 3,
        preferredStart: '2026-05-01T19:00:00Z',
      }),
    ).toThrow(/적합 venue/);
  });

  it('S등급 차단', () => {
    expect(() =>
      ai.schedule_(
        { eventId: 'e1', category: 'concert', expectedAudience: 50, durationHours: 1, preferredStart: '2026-05-01T19:00:00Z' },
        'S' as unknown as never,
      ),
    ).toThrow(/BLOCKED/);
  });
});
