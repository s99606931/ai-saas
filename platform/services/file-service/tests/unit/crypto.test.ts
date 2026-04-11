// 파일 암호화 유틸리티 단위 테스트
// Design Ref: DESIGN-MTU-P12
// Plan SC: FR-P12.3
// CSAP: D-09 AES-256-GCM 암호화

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { encrypt, decrypt, getEncryptionKey } from '../../src/lib/crypto.js';
import { randomBytes } from 'node:crypto';

describe('encrypt / decrypt (CSAP D-09)', () => {
  const key = randomBytes(32); // AES-256 = 32 bytes

  it('암호화 후 복호화하면 원본과 동일하다', () => {
    const original = Buffer.from('공공기관 SaaS 프레임워크 테스트 데이터');
    const encrypted = encrypt(original, key);
    const decrypted = decrypt(encrypted, key);
    expect(Buffer.compare(decrypted, original)).toBe(0);
  });

  it('빈 데이터도 암복호화한다', () => {
    const original = Buffer.alloc(0);
    const encrypted = encrypt(original, key);
    const decrypted = decrypt(encrypted, key);
    expect(decrypted.length).toBe(0);
  });

  it('큰 데이터를 암복호화한다', () => {
    const original = randomBytes(10000);
    const encrypted = encrypt(original, key);
    const decrypted = decrypt(encrypted, key);
    expect(Buffer.compare(decrypted, original)).toBe(0);
  });

  it('암호문은 원본과 다르다', () => {
    const original = Buffer.from('sensitive data');
    const encrypted = encrypt(original, key);
    expect(Buffer.compare(encrypted, original)).not.toBe(0);
  });

  it('동일 평문에 대해 다른 암호문을 생성한다 (IV 랜덤)', () => {
    const original = Buffer.from('same data');
    const enc1 = encrypt(original, key);
    const enc2 = encrypt(original, key);
    expect(Buffer.compare(enc1, enc2)).not.toBe(0);
  });

  it('암호문은 IV(16) + AuthTag(16) + 데이터 구조이다', () => {
    const original = Buffer.from('test');
    const encrypted = encrypt(original, key);
    // 최소 32바이트 (IV 16 + AuthTag 16) + 암호화된 데이터
    expect(encrypted.length).toBeGreaterThanOrEqual(32);
  });

  it('잘못된 키로 복호화하면 에러가 발생한다', () => {
    const original = Buffer.from('protected data');
    const encrypted = encrypt(original, key);
    const wrongKey = randomBytes(32);
    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });

  it('변조된 암호문은 복호화에 실패한다 (GCM 인증)', () => {
    const original = Buffer.from('tamper test');
    const encrypted = encrypt(original, key);
    // 마지막 바이트 변조
    encrypted[encrypted.length - 1] = encrypted[encrypted.length - 1]! ^ 0xff;
    expect(() => decrypt(encrypted, key)).toThrow();
  });

  it('바이너리 데이터를 암복호화한다', () => {
    const original = Buffer.from([0x00, 0x01, 0x7f, 0x80, 0xfe, 0xff]);
    const encrypted = encrypt(original, key);
    const decrypted = decrypt(encrypted, key);
    expect(Buffer.compare(decrypted, original)).toBe(0);
  });
});

describe('getEncryptionKey (CSAP D-09)', () => {
  const originalKey = process.env['FILE_ENCRYPTION_KEY'];

  afterAll(() => {
    if (originalKey) {
      process.env['FILE_ENCRYPTION_KEY'] = originalKey;
    } else {
      delete process.env['FILE_ENCRYPTION_KEY'];
    }
  });

  it('환경 변수에서 키를 로드한다', () => {
    process.env['FILE_ENCRYPTION_KEY'] = 'a'.repeat(64); // 32 bytes hex
    const key = getEncryptionKey();
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  it('환경 변수 미설정 시 에러를 발생시킨다', () => {
    delete process.env['FILE_ENCRYPTION_KEY'];
    expect(() => getEncryptionKey()).toThrow('FILE_ENCRYPTION_KEY');
  });
});
