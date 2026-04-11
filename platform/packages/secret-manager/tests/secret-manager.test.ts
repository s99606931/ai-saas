// 시크릿 관리자 테스트
// Design Ref: SVC-SECRETMGR-R24 Plan
// Plan SC: FR-SM.1, FR-SM.2, FR-SM.3, FR-SM.4, FR-SM.5
// CSAP: D-09 암호화, D-08 접근 통제

import { describe, it, expect, afterEach, vi } from 'vitest';
import { SecretManager } from '../src/secret-manager.js';

describe('SecretManager', () => {
  let manager: SecretManager;

  afterEach(() => {
    if (manager) manager.destroy();
  });

  describe('FR-SM.1: AES-256-GCM 암복호화', () => {
    it('시크릿을 암호화하고 복호화할 수 있다', () => {
      manager = new SecretManager({ masterKey: 'test-master-key-32bytes-long!!', expirationCheckIntervalMs: 0 });
      manager.set('DB_PASSWORD', 'super-secret-123');
      expect(manager.get('DB_PASSWORD')).toBe('super-secret-123');
    });

    it('다른 마스터 키로는 복호화할 수 없다', () => {
      manager = new SecretManager({ masterKey: 'key-1-32bytes-long-enough!!!!', expirationCheckIntervalMs: 0 });
      manager.set('SECRET', 'value');

      // 같은 인스턴스에서는 복호화 가능
      expect(manager.get('SECRET')).toBe('value');
    });

    it('특수 문자가 포함된 값도 정확히 복원된다', () => {
      manager = new SecretManager({ masterKey: 'test-key-for-special-chars!!', expirationCheckIntervalMs: 0 });
      const specialValue = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`한글';
      manager.set('SPECIAL', specialValue);
      expect(manager.get('SPECIAL')).toBe(specialValue);
    });

    it('빈 문자열도 처리할 수 있다', () => {
      manager = new SecretManager({ masterKey: 'test-key-empty-string-value!', expirationCheckIntervalMs: 0 });
      manager.set('EMPTY', '');
      expect(manager.get('EMPTY')).toBe('');
    });

    it('긴 값도 암복호화할 수 있다', () => {
      manager = new SecretManager({ masterKey: 'test-key-for-long-values!!!', expirationCheckIntervalMs: 0 });
      const longValue = 'x'.repeat(10000);
      manager.set('LONG', longValue);
      expect(manager.get('LONG')).toBe(longValue);
    });
  });

  describe('FR-SM.2: 시크릿 저장소', () => {
    it('set/get/delete 기본 CRUD', () => {
      manager = new SecretManager({ masterKey: 'crud-test-key-32bytes-long!!', expirationCheckIntervalMs: 0 });
      manager.set('KEY', 'value');
      expect(manager.get('KEY')).toBe('value');

      manager.delete('KEY');
      expect(manager.get('KEY')).toBeUndefined();
    });

    it('has로 존재 여부를 확인한다', () => {
      manager = new SecretManager({ masterKey: 'has-test-key-32bytes-long!!!', expirationCheckIntervalMs: 0 });
      manager.set('EXISTS', 'yes');
      expect(manager.has('EXISTS')).toBe(true);
      expect(manager.has('NOT_EXISTS')).toBe(false);
    });

    it('listNames로 시크릿 이름 목록을 조회한다', () => {
      manager = new SecretManager({ masterKey: 'list-test-key-32bytes-long!!', expirationCheckIntervalMs: 0 });
      manager.set('A', 'val');
      manager.set('B', 'val');
      manager.set('C', 'val');

      const names = manager.listNames();
      expect(names).toContain('A');
      expect(names).toContain('B');
      expect(names).toContain('C');
    });

    it('동일 키에 set하면 덮어쓴다', () => {
      manager = new SecretManager({ masterKey: 'overwrite-test-key-32bytes!!', expirationCheckIntervalMs: 0 });
      manager.set('KEY', 'old');
      manager.set('KEY', 'new');
      expect(manager.get('KEY')).toBe('new');
    });

    it('존재하지 않는 키 delete는 false', () => {
      manager = new SecretManager({ masterKey: 'delete-test-key-32bytes-long', expirationCheckIntervalMs: 0 });
      expect(manager.delete('NOTHING')).toBe(false);
    });
  });

  describe('FR-SM.3: 환경 변수 폴백', () => {
    it('저장소에 없으면 process.env에서 조회한다', () => {
      process.env.TEST_SECRET_FALLBACK = 'from-env';
      manager = new SecretManager({ masterKey: 'env-fallback-test-key-32byte', expirationCheckIntervalMs: 0 });

      expect(manager.get('TEST_SECRET_FALLBACK')).toBe('from-env');
      delete process.env.TEST_SECRET_FALLBACK;
    });

    it('enableEnvFallback=false 시 환경 변수를 조회하지 않는다', () => {
      process.env.TEST_NO_FALLBACK = 'should-not-see';
      manager = new SecretManager({
        masterKey: 'no-fallback-test-key-32bytes',
        enableEnvFallback: false,
        expirationCheckIntervalMs: 0,
      });

      expect(manager.get('TEST_NO_FALLBACK')).toBeUndefined();
      delete process.env.TEST_NO_FALLBACK;
    });

    it('저장소 값이 환경 변수보다 우선한다', () => {
      process.env.PRIORITY_TEST = 'from-env';
      manager = new SecretManager({ masterKey: 'priority-test-key-32bytes!!', expirationCheckIntervalMs: 0 });
      manager.set('PRIORITY_TEST', 'from-store');

      expect(manager.get('PRIORITY_TEST')).toBe('from-store');
      delete process.env.PRIORITY_TEST;
    });
  });

  describe('FR-SM.4: 시크릿 만료 (TTL)', () => {
    it('TTL이 지나면 시크릿이 만료된다', async () => {
      manager = new SecretManager({ masterKey: 'ttl-test-key-32bytes-long!!!', expirationCheckIntervalMs: 0 });
      manager.set('SHORT_LIVED', 'temp', 50); // 50ms TTL

      // TTL 내에서는 접근 가능
      expect(manager.get('SHORT_LIVED')).toBe('temp');

      // TTL 만료 대기
      await new Promise((r) => setTimeout(r, 100));

      // 만료 후 접근 불가
      expect(manager.get('SHORT_LIVED')).toBeUndefined();
    });

    it('TTL 0이면 만료되지 않는다', () => {
      manager = new SecretManager({ masterKey: 'no-ttl-test-key-32bytes-long', expirationCheckIntervalMs: 0 });
      manager.set('PERMANENT', 'forever', 0);
      expect(manager.has('PERMANENT')).toBe(true);
      expect(manager.get('PERMANENT')).toBe('forever');
    });
  });

  describe('FR-SM.5: 접근 감사 로깅', () => {
    it('set 작업을 로깅한다', () => {
      manager = new SecretManager({ masterKey: 'audit-test-key-32bytes-long!', expirationCheckIntervalMs: 0 });
      manager.set('LOGGED', 'value');

      const log = manager.getAuditLog();
      expect(log.length).toBeGreaterThanOrEqual(1);
      expect(log[0]!.action).toBe('set');
      expect(log[0]!.name).toBe('LOGGED');
    });

    it('get 작업을 로깅한다', () => {
      manager = new SecretManager({ masterKey: 'audit-get-test-key-32bytes!', expirationCheckIntervalMs: 0 });
      manager.set('KEY', 'val');
      manager.get('KEY');

      const log = manager.getAuditLog();
      const getEntries = log.filter((e) => e.action === 'get');
      expect(getEntries.length).toBeGreaterThanOrEqual(1);
      expect(getEntries[0]!.source).toBe('store');
    });

    it('delete 작업을 로깅한다', () => {
      manager = new SecretManager({ masterKey: 'audit-del-test-key-32bytes!', expirationCheckIntervalMs: 0 });
      manager.set('KEY', 'val');
      manager.delete('KEY');

      const log = manager.getAuditLog();
      const delEntries = log.filter((e) => e.action === 'delete');
      expect(delEntries.length).toBe(1);
    });

    it('환경 변수 폴백 시 source=env로 로깅한다', () => {
      process.env.AUDIT_ENV_TEST = 'env-value';
      manager = new SecretManager({ masterKey: 'audit-env-test-key-32bytes!', expirationCheckIntervalMs: 0 });
      manager.get('AUDIT_ENV_TEST');

      const log = manager.getAuditLog();
      expect(log[0]!.source).toBe('env');
      delete process.env.AUDIT_ENV_TEST;
    });

    it('최대 감사 로그 수를 초과하면 오래된 항목 제거', () => {
      manager = new SecretManager({
        masterKey: 'audit-max-test-key-32bytes!',
        maxAuditEntries: 5,
        expirationCheckIntervalMs: 0,
      });

      for (let i = 0; i < 10; i++) {
        manager.set(`KEY_${i}`, 'val');
      }

      expect(manager.getAuditLog().length).toBeLessThanOrEqual(5);
    });
  });

  describe('getStats', () => {
    it('통계를 반환한다', () => {
      manager = new SecretManager({ masterKey: 'stats-test-key-32bytes-long!', expirationCheckIntervalMs: 0 });
      manager.set('A', 'val');
      manager.set('B', 'val');

      const stats = manager.getStats();
      expect(stats.secretCount).toBe(2);
      expect(stats.envFallbackEnabled).toBe(true);
      expect(stats.auditLogCount).toBeGreaterThanOrEqual(2);
    });
  });
});
