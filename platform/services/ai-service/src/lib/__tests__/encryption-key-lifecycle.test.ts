// MTU-N305 암호화 키 수명주기 테스트
import { describe, it, expect } from 'vitest';
import { EncryptionKeyLifecycleService } from '../encryption-key-lifecycle.js';

describe('MTU-N305 EncryptionKeyLifecycle', () => {
  const svc = new EncryptionKeyLifecycleService('tenant-n305');

  it('FR-N305.1: 키 생성', () => {
    const k = svc.generate('AES-256', 'encryption', 90);
    expect(k).toBeDefined();
    expect(svc.getKeys().length).toBeGreaterThan(0);
  });

  it('FR-N305.2: 키 회전 스케줄', () => {
    const k = svc.generate('AES-256', 'encryption');
    const sched = svc.setRotation(k.keyId, 30);
    expect(sched).toBeDefined();
  });

  it('FR-N305.3: 키 사용 추적', () => {
    const k = svc.generate('AES-256', 'encryption');
    const usage = svc.trackUsage(k.keyId, 'encrypt', 'api-service');
    expect(usage).toBeDefined();
  });

  it('FR-N305.5: 키 폐기', () => {
    const k = svc.generate('AES-128', 'encryption');
    const ok = svc.destroy(k.keyId);
    expect(ok).toBe(true);
  });

  it('FR-N305.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
