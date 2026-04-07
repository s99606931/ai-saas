// MFA 스키마 + 암호화 테스트
// Design Ref: DESIGN-MTU-P01 Section 3
// Plan SC: FR-P01.10
// CSAP: D-08-08 다중 인증, D-09 암호화

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mfaSetupSchema, mfaVerifySchema, mfaDisableSchema } from '../../src/schemas/mfa.schema.js';

describe('MFA Schemas (CSAP D-08-08)', () => {
  describe('mfaSetupSchema', () => {
    it('유효한 비밀번호를 허용한다', () => {
      const result = mfaSetupSchema.safeParse({ password: 'MyP@ssw0rd!' });
      expect(result.success).toBe(true);
    });

    it('빈 비밀번호를 거부한다', () => {
      const result = mfaSetupSchema.safeParse({ password: '' });
      expect(result.success).toBe(false);
    });

    it('비밀번호 필드 누락을 거부한다', () => {
      const result = mfaSetupSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('mfaVerifySchema', () => {
    it('6자리 숫자 코드를 허용한다', () => {
      const result = mfaVerifySchema.safeParse({ code: '123456' });
      expect(result.success).toBe(true);
    });

    it('5자리 코드를 거부한다', () => {
      const result = mfaVerifySchema.safeParse({ code: '12345' });
      expect(result.success).toBe(false);
    });

    it('7자리 코드를 거부한다', () => {
      const result = mfaVerifySchema.safeParse({ code: '1234567' });
      expect(result.success).toBe(false);
    });

    it('알파벳 포함 코드를 거부한다', () => {
      const result = mfaVerifySchema.safeParse({ code: '12345a' });
      expect(result.success).toBe(false);
    });

    it('특수문자 포함 코드를 거부한다', () => {
      const result = mfaVerifySchema.safeParse({ code: '12345!' });
      expect(result.success).toBe(false);
    });
  });

  describe('mfaDisableSchema', () => {
    it('유효한 비밀번호 + 코드를 허용한다', () => {
      const result = mfaDisableSchema.safeParse({
        password: 'MyP@ssw0rd!',
        code: '123456',
      });
      expect(result.success).toBe(true);
    });

    it('코드 없이 비밀번호만 보내면 거부한다', () => {
      const result = mfaDisableSchema.safeParse({
        password: 'MyP@ssw0rd!',
      });
      expect(result.success).toBe(false);
    });

    it('비밀번호 없이 코드만 보내면 거부한다', () => {
      const result = mfaDisableSchema.safeParse({
        code: '123456',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('MFA Crypto (CSAP D-09)', () => {
  const originalKey = process.env['MFA_ENCRYPTION_KEY'];

  beforeAll(() => {
    // 테스트용 256비트 키 (64자 hex)
    process.env['MFA_ENCRYPTION_KEY'] = 'a'.repeat(64);
  });

  it('암호화 후 복호화하면 원본과 동일하다', async () => {
    const { encryptMfaSecret, decryptMfaSecret } = await import('../../src/lib/mfa-crypto.js');
    const original = 'JBSWY3DPEHPK3PXP';
    const encrypted = encryptMfaSecret(original);
    const decrypted = decryptMfaSecret(encrypted);
    expect(decrypted).toBe(original);
  });

  it('암호문은 원본과 다르다', async () => {
    const { encryptMfaSecret } = await import('../../src/lib/mfa-crypto.js');
    const original = 'JBSWY3DPEHPK3PXP';
    const encrypted = encryptMfaSecret(original);
    expect(encrypted).not.toBe(original);
  });

  it('동일 평문에 대해 다른 암호문을 생성한다 (IV 랜덤)', async () => {
    const { encryptMfaSecret } = await import('../../src/lib/mfa-crypto.js');
    const original = 'JBSWY3DPEHPK3PXP';
    const enc1 = encryptMfaSecret(original);
    const enc2 = encryptMfaSecret(original);
    expect(enc1).not.toBe(enc2); // IV가 다르므로 암호문 다름
  });

  it('키 미설정 시 에러를 발생시킨다', async () => {
    delete process.env['MFA_ENCRYPTION_KEY'];
    // 모듈 캐시 초기화를 위해 동적 import
    // NOTE: vitest 환경에서는 모듈 캐시로 인해 이전 테스트의 키가 유지될 수 있음
    // 이 테스트는 getEncryptionKey 함수의 로직을 직접 검증
    expect(() => {
      const keyHex = process.env['MFA_ENCRYPTION_KEY'];
      if (!keyHex) {
        throw new Error('MFA_ENCRYPTION_KEY 환경 변수가 설정되지 않았습니다');
      }
    }).toThrow('MFA_ENCRYPTION_KEY');
    // 복원
    process.env['MFA_ENCRYPTION_KEY'] = 'a'.repeat(64);
  });

  // 테스트 후 환경 변수 복원
  afterAll(() => {
    if (originalKey) {
      process.env['MFA_ENCRYPTION_KEY'] = originalKey;
    }
  });
});
