// MTU-N364 장치 핑거프린팅 테스트
import { describe, it, expect } from 'vitest';
import { DeviceFingerprintTrackerService } from '../device-fingerprint-tracker.js';

describe('MTU-N364 DeviceFingerprintTracker', () => {
  const svc = new DeviceFingerprintTrackerService('tenant-n364');

  it('FR-N364.1: 핑거프린트 생성', () => {
    const fp = svc.fingerprint('user-1', 'Mozilla/5.0', '1920x1080', 'Asia/Seoul', 'ko-KR');
    expect(fp.hash.length).toBeGreaterThan(0);
  });

  it('FR-N364.2: 신규 장치 탐지', () => {
    const fp = svc.fingerprint('user-2', 'Chrome/120', '2560x1440', 'Asia/Seoul', 'ko-KR');
    const alert = svc.track('user-2', fp);
    expect(alert.isNew).toBe(true);
  });

  it('FR-N364.3: 장치 이력 조회', () => {
    const fp = svc.fingerprint('user-3', 'Safari', '1440x900', 'Asia/Seoul', 'ko-KR');
    svc.track('user-3', fp);
    const history = svc.history('user-3');
    expect(history.totalDevices).toBeGreaterThan(0);
  });

  it('FR-N364.4: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
