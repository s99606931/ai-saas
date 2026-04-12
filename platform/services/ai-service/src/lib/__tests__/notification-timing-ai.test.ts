import { describe, it, expect } from 'vitest';
import { NotificationTimingAi, type NotificationEvent } from '../notification-timing-ai';

describe('NotificationTimingAi', () => {
  const svc = new NotificationTimingAi();

  const events: NotificationEvent[] = [
    { userId: 'u1', notificationId: 'n1', sentHour: 9, reacted: true, dayOfWeek: 1, reactionDelayMinutes: 5 },
    { userId: 'u1', notificationId: 'n2', sentHour: 9, reacted: true, dayOfWeek: 2 },
    { userId: 'u1', notificationId: 'n3', sentHour: 10, reacted: true, dayOfWeek: 1 },
    { userId: 'u1', notificationId: 'n4', sentHour: 14, reacted: false, dayOfWeek: 3 },
    { userId: 'u1', notificationId: 'n5', sentHour: 2, reacted: false, dayOfWeek: 1 },
    { userId: 'u1', notificationId: 'n6', sentHour: 2, reacted: false, dayOfWeek: 2 },
    { userId: 'u1', notificationId: 'n7', sentHour: 3, reacted: false, dayOfWeek: 1 },
    { userId: 'u1', notificationId: 'n8', sentHour: 3, reacted: false, dayOfWeek: 2 },
  ];

  it('ingests valid events', () => {
    expect(svc.ingest(events).length).toBe(8);
  });

  it('analyzes hourly rates', () => {
    const rates = svc.analyzeHourlyRates(events);
    expect(rates.length).toBe(24);
    const hour9 = rates.find((r) => r.hour === 9);
    expect(hour9?.rate).toBe(1);
  });

  it('finds optimal window with morning hours', () => {
    const window = svc.findOptimalWindow('u1', events);
    expect(window.bestHours.length).toBeGreaterThan(0);
    expect(window.bestHours).toContain(9);
  });

  it('detects do not disturb at night', () => {
    const dnd = svc.detectDoNotDisturb('u1', events);
    expect(dnd.startHour).toBe(2);
    expect(dnd.endHour).toBe(3);
  });

  it('schedules notifications avoiding DND', () => {
    const window = svc.findOptimalWindow('u1', events);
    const dnd = svc.detectDoNotDisturb('u1', events);
    const schedule = svc.scheduleNotifications(['m1', 'm2'], window, dnd);
    expect(schedule.length).toBe(2);
    for (const s of schedule) {
      expect(s.scheduledHour).not.toBe(2);
      expect(s.scheduledHour).not.toBe(3);
    }
  });
});
