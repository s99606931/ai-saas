// Crypto Utility 테스트
// Plan SC: FR-CR.1~FR-CR.6

import { describe, it, expect } from 'vitest';
import {
  encrypt,
  decrypt,
  hmacSign,
  hmacVerify,
  deriveKey,
  generateToken,
  generateKey,
  generateSalt,
  timingSafeCompare,
  CryptoError,
} from '../src/crypto-util.js';

describe('FR-CR.1/FR-CR.2: AES-256-GCM', () => {
  it('암호화 → 복호화 라운드트립', () => {
    const key = generateKey();
    const plaintext = '민감한 공공 데이터입니다.';
    const encrypted = encrypt(plaintext, key);
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted, key)).toBe(plaintext);
  });

  it('매번 다른 IV로 같은 입력도 다른 결과', () => {
    const key = generateKey();
    const e1 = encrypt('hello', key);
    const e2 = encrypt('hello', key);
    expect(e1).not.toBe(e2);
  });

  it('잘못된 키로 복호화 실패', () => {
    const key1 = generateKey();
    const key2 = generateKey();
    const encrypted = encrypt('secret', key1);
    expect(() => decrypt(encrypted, key2)).toThrow(CryptoError);
  });

  it('위변조된 암호문 거부', () => {
    const key = generateKey();
    const encrypted = encrypt('integrity-test', key);
    const tampered = encrypted.slice(0, -4) + 'XXXX';
    expect(() => decrypt(tampered, key)).toThrow(/인증/);
  });

  it('잘못된 키 길이 거부', () => {
    expect(() => encrypt('x', Buffer.alloc(16))).toThrow(/32/);
    expect(() => decrypt('x', Buffer.alloc(16))).toThrow(/32/);
  });

  it('짧은 암호문 거부', () => {
    const key = generateKey();
    expect(() => decrypt(Buffer.alloc(10).toString('base64'), key)).toThrow();
  });

  it('한글/이모지 지원', () => {
    const key = generateKey();
    const plaintext = '안녕하세요 🇰🇷';
    expect(decrypt(encrypt(plaintext, key), key)).toBe(plaintext);
  });
});

describe('FR-CR.3: HMAC-SHA256', () => {
  it('서명 후 검증 성공', () => {
    const key = generateKey();
    const data = 'authenticate-me';
    const sig = hmacSign(data, key);
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
    expect(hmacVerify(data, sig, key)).toBe(true);
  });

  it('변경된 데이터는 검증 실패', () => {
    const key = generateKey();
    const sig = hmacSign('original', key);
    expect(hmacVerify('modified', sig, key)).toBe(false);
  });

  it('잘못된 키는 검증 실패', () => {
    const k1 = generateKey();
    const k2 = generateKey();
    const sig = hmacSign('data', k1);
    expect(hmacVerify('data', sig, k2)).toBe(false);
  });
});

describe('FR-CR.4: PBKDF2 키 파생', () => {
  it('동일 입력은 동일 키', () => {
    const salt = Buffer.alloc(16, 1);
    const k1 = deriveKey('password', salt);
    const k2 = deriveKey('password', salt);
    expect(k1.equals(k2)).toBe(true);
    expect(k1.length).toBe(32);
  });

  it('다른 솔트는 다른 키', () => {
    const k1 = deriveKey('password', Buffer.alloc(16, 1));
    const k2 = deriveKey('password', Buffer.alloc(16, 2));
    expect(k1.equals(k2)).toBe(false);
  });

  it('짧은 솔트 거부', () => {
    expect(() => deriveKey('pw', Buffer.alloc(8))).toThrow();
  });

  it('낮은 반복 횟수 거부', () => {
    expect(() => deriveKey('pw', Buffer.alloc(16), 1000)).toThrow();
  });
});

describe('FR-CR.5: 랜덤 토큰', () => {
  it('기본 32바이트 토큰 생성', () => {
    const token = generateToken();
    expect(token.length).toBeGreaterThan(20);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('중복 없는 토큰', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) tokens.add(generateToken());
    expect(tokens.size).toBe(100);
  });

  it('짧은 토큰 거부', () => {
    expect(() => generateToken(8)).toThrow();
  });
});

describe('FR-CR.6: 타이밍 안전 비교', () => {
  it('같은 문자열은 true', () => {
    expect(timingSafeCompare('secret', 'secret')).toBe(true);
  });

  it('다른 문자열은 false', () => {
    expect(timingSafeCompare('secret', 'public')).toBe(false);
  });

  it('길이가 다르면 false', () => {
    expect(timingSafeCompare('short', 'longer-string')).toBe(false);
  });
});

describe('유틸리티', () => {
  it('generateKey 32바이트', () => {
    expect(generateKey().length).toBe(32);
  });

  it('generateSalt 기본 16바이트', () => {
    expect(generateSalt().length).toBe(16);
  });
});
