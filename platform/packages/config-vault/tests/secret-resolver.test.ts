// SecretResolver 단위 테스트
// Design Ref: SVC-CONFIG-R16 Plan
// Plan SC: FR-CFG.4

import { describe, it, expect } from 'vitest';
import { SecretResolver } from '../src/secret-resolver.js';

describe('SecretResolver', () => {
  const mockEnv: Record<string, string> = {
    DB_PASSWORD: 'super-secret-password',
    REDIS_URL: 'redis://localhost:6379',
    API_KEY: 'live-api-key-12345',
  };

  const resolver = new SecretResolver((key) => mockEnv[key]);

  it('$secret: 참조를 환경변수에서 해석한다', () => {
    const result = resolver.resolve({
      dbPassword: '$secret:DB_PASSWORD',
      redisUrl: '$secret:REDIS_URL',
    });

    expect(result.config['dbPassword']).toBe('super-secret-password');
    expect(result.config['redisUrl']).toBe('redis://localhost:6379');
    expect(result.resolved).toBe(2);
  });

  it('미해석 시크릿 참조를 보고한다', () => {
    const result = resolver.resolve({
      missing: '$secret:NONEXISTENT_KEY',
    });

    expect(result.unresolved).toEqual(['missing']);
    expect(result.config['missing']).toBe('$secret:NONEXISTENT_KEY'); // 원본 유지
  });

  it('일반 문자열은 그대로 유지한다', () => {
    const result = resolver.resolve({
      host: 'localhost',
      port: 3000,
      debug: true,
    });

    expect(result.config['host']).toBe('localhost');
    expect(result.config['port']).toBe(3000);
    expect(result.config['debug']).toBe(true);
    expect(result.resolved).toBe(0);
  });

  it('중첩 객체의 시크릿 참조를 해석한다', () => {
    const result = resolver.resolve({
      db: {
        host: 'localhost',
        password: '$secret:DB_PASSWORD',
      },
    });

    const dbConfig = result.config['db'] as Record<string, unknown>;
    expect(dbConfig['password']).toBe('super-secret-password');
    expect(result.resolved).toBe(1);
  });

  it('하드코딩 시크릿 패턴을 탐지한다', () => {
    const result = resolver.resolve({
      apiKey: 'sk-1234567890abcdefghijklmno', // API 키 패턴
      normalValue: 'just a normal string',
    });

    expect(result.hardcodedSuspects).toContain('apiKey');
    expect(result.hardcodedSuspects).not.toContain('normalValue');
  });

  it('isSecretReference()가 시크릿 참조를 판별한다', () => {
    expect(resolver.isSecretReference('$secret:DB_PASSWORD')).toBe(true);
    expect(resolver.isSecretReference('normal-value')).toBe(false);
    expect(resolver.isSecretReference('$secret:')).toBe(false);
  });

  it('isHardcodedSecret()이 하드코딩 패턴을 탐지한다', () => {
    expect(resolver.isHardcodedSecret('sk-1234567890abcdefghijklmno')).toBe(true);
    expect(resolver.isHardcodedSecret('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij')).toBe(true);
    expect(resolver.isHardcodedSecret('-----BEGIN RSA PRIVATE KEY-----')).toBe(true);
    expect(resolver.isHardcodedSecret('normal-config-value')).toBe(false);
  });

  it('중첩 객체의 미해석/하드코딩을 경로 포함 보고한다', () => {
    const result = resolver.resolve({
      services: {
        auth: {
          secret: '$secret:MISSING_SECRET',
          key: 'sk-hardcoded12345678901234567',
        },
      },
    });

    expect(result.unresolved).toEqual(['services.auth.secret']);
    expect(result.hardcodedSuspects).toEqual(['services.auth.key']);
  });
});
