import { describe, it, expect } from 'vitest';
import { SmartNotificationRouterV2, type UserPrefs } from '../smart-notification-router-v2.js';

const prefs: UserPrefs = {
  userId: 'u1',
  preferred: ['push', 'email', 'sms'],
  quietStart: 22,
  quietEnd: 7,
};

describe('SVC-AI-ADV-R359 SmartNotificationRouterV2', () => {
  const svc = new SmartNotificationRouterV2();

  it('FR-359.1: CRITICAL 조용시간 override', () => {
    const r = svc.route({ userId: 'u1', priority: 'CRITICAL', grade: 'O', hour: 3 }, prefs);
    expect(r.selected).toBe('push');
    expect(r.quietOverride).toBe(true);
  });

  it('FR-359.2: 조용시간 non-critical → inapp', () => {
    const r = svc.route({ userId: 'u1', priority: 'NORMAL', grade: 'O', hour: 3 }, prefs);
    expect(r.selected).toBe('inapp');
  });

  it('주간: 선호 1순위 사용', () => {
    const r = svc.route({ userId: 'u1', priority: 'HIGH', grade: 'O', hour: 14 }, prefs);
    expect(r.selected).toBe('push');
    expect(r.fallbacks.length).toBe(2);
  });

  it('FR-359.3: C등급 차단', () => {
    expect(() =>
      svc.route({ userId: 'u1', priority: 'HIGH', grade: 'C', hour: 10 }, prefs),
    ).toThrow('N2SF_BLOCKED');
  });

  it('FR-359.4: 감사 로그', () => {
    svc.route({ userId: 'u1', priority: 'HIGH', grade: 'O', hour: 10 }, prefs);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });

  it('빈 선호 예외', () => {
    expect(() =>
      svc.route(
        { userId: 'u1', priority: 'HIGH', grade: 'O', hour: 10 },
        { ...prefs, preferred: [] },
      ),
    ).toThrow('INVALID_PARAMS');
  });
});
