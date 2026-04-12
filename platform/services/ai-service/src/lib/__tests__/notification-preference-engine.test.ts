// MTU-N362 알림 선호 설정 엔진 테스트
import { describe, it, expect } from 'vitest';
import { NotificationPreferenceService } from '../notification-preference-engine.js';

describe('MTU-N362 NotificationPreferenceEngine', () => {
  const svc = new NotificationPreferenceService('tenant-n362');

  it('FR-N362.1: 채널 등록', () => {
    const ch = svc.registerChannel('이메일', 'email');
    expect(ch.enabled).toBe(true);
  });

  it('FR-N362.2: 선호 설정', () => {
    const pref = svc.setPreference('user-1', { email: true, sms: false }, { security: true });
    expect(pref.channels.email).toBe(true);
    expect(pref.channels.sms).toBe(false);
  });

  it('FR-N362.3: 알림 가부 판정', () => {
    svc.setPreference('user-2', { email: true, sms: false });
    expect(svc.shouldNotify('user-2', 'email', 'general')).toBe(true);
    expect(svc.shouldNotify('user-2', 'sms', 'general')).toBe(false);
  });

  it('FR-N362.4: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
