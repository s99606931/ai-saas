// TenantEncryption 단위 테스트
// Design Ref: SVC-TENANT-R14 Plan
// Plan SC: FR-TENANT.4

import { describe, it, expect, beforeEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import { TenantContext } from '../src/tenant-context.js';
import { TenantEncryption, TenantEncryptionError } from '../src/tenant-encryption.js';

describe('TenantEncryption', () => {
  let ctx: TenantContext;
  let encryption: TenantEncryption;
  const masterKey = randomBytes(32).toString('hex'); // 256-bit 랜덤 키

  beforeEach(() => {
    ctx = new TenantContext();
    encryption = new TenantEncryption(ctx, masterKey);
  });

  it('잘못된 마스터 키 길이에 에러를 발생한다', () => {
    expect(() => new TenantEncryption(ctx, 'short-key')).toThrow(
      '마스터 키는 256bit (hex 64자)여야 합니다',
    );
  });

  it('텍스트를 암호화/복호화한다 (왕복 검증)', () => {
    const plaintext = '민감한 테넌트 데이터: 사업자번호 123-45-67890';

    const result = ctx.run({ tenantId: 'tenant-001' }, () => {
      const encrypted = encryption.encrypt(plaintext);
      return encryption.decrypt(encrypted);
    });

    expect(result).toBe(plaintext);
  });

  it('암호화 결과에 테넌트 ID와 키 버전이 포함된다', () => {
    const encrypted = ctx.run({ tenantId: 'tenant-002' }, () => {
      return encryption.encrypt('test data');
    });

    expect(encrypted.tenantId).toBe('tenant-002');
    expect(encrypted.keyVersion).toBe(1);
    expect(encrypted.ciphertext.length).toBeGreaterThan(0);
    expect(encrypted.iv.length).toBe(24); // 12 bytes = 24 hex chars
    expect(encrypted.authTag.length).toBe(32); // 16 bytes = 32 hex chars
  });

  it('동일 평문이 다른 암호문을 생성한다 (IV 랜덤)', () => {
    const [enc1, enc2] = ctx.run({ tenantId: 'tenant-003' }, () => {
      return [encryption.encrypt('same text'), encryption.encrypt('same text')];
    });

    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
    expect(enc1.iv).not.toBe(enc2.iv);
  });

  it('다른 테넌트의 데이터 복호화를 차단한다', () => {
    // 테넌트 A가 암호화
    const encrypted = ctx.run({ tenantId: 'tenant-A' }, () => {
      return encryption.encrypt('secret');
    });

    // 테넌트 B가 복호화 시도
    expect(() => {
      ctx.run({ tenantId: 'tenant-B' }, () => {
        encryption.decrypt(encrypted);
      });
    }).toThrow(TenantEncryptionError);
  });

  it('SUPER_ADMIN은 다른 테넌트 데이터를 복호화할 수 있다', () => {
    const encrypted = ctx.run({ tenantId: 'tenant-A' }, () => {
      return encryption.encrypt('admin-access-test');
    });

    const result = ctx.run({ tenantId: 'admin', isSuperAdmin: true }, () => {
      return encryption.decrypt(encrypted);
    });

    expect(result).toBe('admin-access-test');
  });

  it('테넌트별로 다른 키가 파생된다', () => {
    const keyA = encryption.deriveTenantKey('tenant-A');
    const keyB = encryption.deriveTenantKey('tenant-B');

    expect(keyA.toString('hex')).not.toBe(keyB.toString('hex'));
    expect(keyA.length).toBe(32); // 256 bits
  });

  it('같은 테넌트는 항상 같은 키가 파생된다 (결정적)', () => {
    const key1 = encryption.deriveTenantKey('consistent-tenant');
    const key2 = encryption.deriveTenantKey('consistent-tenant');

    expect(key1.toString('hex')).toBe(key2.toString('hex'));
  });

  it('키 버전이 다르면 다른 키가 파생된다', () => {
    const v1 = new TenantEncryption(ctx, masterKey, 1);
    const v2 = new TenantEncryption(ctx, masterKey, 2);

    const key1 = v1.deriveTenantKey('tenant-X');
    const key2 = v2.deriveTenantKey('tenant-X');

    expect(key1.toString('hex')).not.toBe(key2.toString('hex'));
  });

  it('getKeyVersion()이 키 버전을 반환한다', () => {
    expect(encryption.getKeyVersion()).toBe(1);

    const v3 = new TenantEncryption(ctx, masterKey, 3);
    expect(v3.getKeyVersion()).toBe(3);
  });

  it('한글/이모지 등 유니코드를 정상 처리한다', () => {
    const plaintext = '공공기관 SaaS 보안 데이터';

    const result = ctx.run({ tenantId: 'unicode-test' }, () => {
      const encrypted = encryption.encrypt(plaintext);
      return encryption.decrypt(encrypted);
    });

    expect(result).toBe(plaintext);
  });

  it('빈 문자열을 암호화/복호화한다', () => {
    const result = ctx.run({ tenantId: 'empty-test' }, () => {
      const encrypted = encryption.encrypt('');
      return encryption.decrypt(encrypted);
    });

    expect(result).toBe('');
  });

  it('테넌트 컨텍스트 없이 암호화 시 에러를 발생한다', () => {
    expect(() => encryption.encrypt('test')).toThrow(
      '테넌트 컨텍스트가 설정되지 않았습니다',
    );
  });
});
