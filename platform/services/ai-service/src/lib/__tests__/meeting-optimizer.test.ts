import { describe, it, expect } from 'vitest';
import { MeetingOptimizer, type MeetingRequest } from '../meeting-optimizer';

describe('MeetingOptimizer', () => {
  const svc = new MeetingOptimizer();

  const req: MeetingRequest = {
    id: 'm1',
    title: '예산 회의',
    durationMinutes: 60,
    attendees: [
      {
        id: 'a1',
        name: '김',
        priority: 10,
        availability: [{ start: '2026-04-15T09:00:00Z', end: '2026-04-15T12:00:00Z' }],
      },
      {
        id: 'a2',
        name: '이',
        priority: 5,
        availability: [{ start: '2026-04-15T10:00:00Z', end: '2026-04-15T14:00:00Z' }],
      },
    ],
  };

  it('FR-MO.1 공통 슬롯 탐색', () => {
    const slots = svc.findCommonSlots(req);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]!.start).toBe('2026-04-15T10:00:00Z');
  });

  it('FR-MO.3 시간대 추천', () => {
    const recs = svc.recommend(req);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0]!.availableAttendees).toBe(2);
  });

  it('FR-MO.4 충돌 해결', () => {
    const recs = svc.recommend(req);
    const best = svc.resolveConflicts(recs);
    expect(best).toBeDefined();
  });

  it('FR-MO.5 리마인더', () => {
    const rs = svc.scheduleReminders('m1', req.attendees, '2026-04-15T10:00:00Z', 15);
    expect(rs.length).toBe(2);
  });

  it('FR-MO.2 우선순위 스코어', () => {
    const recs = svc.recommend(req);
    expect(recs[0]!.priorityScore).toBe(1);
  });
});
