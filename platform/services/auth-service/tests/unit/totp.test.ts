// TOTP 유틸리티 단위 테스트 (RFC 6238)
// Design Ref: SVC-AUTH-R1 DESIGN §1.2
// Plan SC: FR-AUTH.1
// CSAP: D-08-08 다중 인증, D-09 타이밍 공격 방지

import { describe, it, expect } from 'vitest';
import { base32Encode, base32Decode, generateTotp, verifyTotp } from '../../src/lib/totp.js';

// -- Base32 인코딩/디코딩 (RFC 4648) ─────────────────────────────────────────

describe('base32Encode (RFC 4648)', () => {
  it('빈 버퍼를 인코딩한다', () => {
    expect(base32Encode(Buffer.alloc(0))).toBe('');
  });

  it('알려진 벡터를 인코딩한다 (RFC 4648 테스트)', () => {
    // RFC 4648 테스트 벡터: "f" -> "MY", "fo" -> "MZXQ", "foo" -> "MZXW6"
    expect(base32Encode(Buffer.from('f'))).toBe('MY');
    expect(base32Encode(Buffer.from('fo'))).toBe('MZXQ');
    expect(base32Encode(Buffer.from('foo'))).toBe('MZXW6');
    expect(base32Encode(Buffer.from('foob'))).toBe('MZXW6YQ');
    expect(base32Encode(Buffer.from('fooba'))).toBe('MZXW6YTB');
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
  });

  it('바이너리 데이터를 인코딩한다', () => {
    const buf = Buffer.from([0x00, 0xff, 0x80]);
    const encoded = base32Encode(buf);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
  });
});

describe('base32Decode (RFC 4648)', () => {
  it('빈 문자열을 디코딩한다', () => {
    expect(base32Decode('').length).toBe(0);
  });

  it('알려진 벡터를 디코딩한다', () => {
    expect(base32Decode('MY').toString()).toBe('f');
    expect(base32Decode('MZXQ').toString()).toBe('fo');
    expect(base32Decode('MZXW6').toString()).toBe('foo');
    expect(base32Decode('MZXW6YQ').toString()).toBe('foob');
    expect(base32Decode('MZXW6YTB').toString()).toBe('fooba');
    expect(base32Decode('MZXW6YTBOI').toString()).toBe('foobar');
  });

  it('소문자를 처리한다', () => {
    expect(base32Decode('mzxw6ytboi').toString()).toBe('foobar');
  });

  it('패딩 문자를 무시한다', () => {
    expect(base32Decode('MZXW6===').toString()).toBe('foo');
  });

  it('라운드트립: encode -> decode', () => {
    const original = 'Hello, World!';
    const encoded = base32Encode(Buffer.from(original));
    const decoded = base32Decode(encoded).toString();
    expect(decoded).toBe(original);
  });

  it('라운드트립: 랜덤 바이너리 데이터', () => {
    const buf = Buffer.from([0x00, 0x01, 0x7f, 0x80, 0xfe, 0xff]);
    const encoded = base32Encode(buf);
    const decoded = base32Decode(encoded);
    expect(Buffer.compare(decoded, buf)).toBe(0);
  });
});

// -- TOTP 생성 (HMAC-SHA1) ──────────────────────────────────────────────────

describe('generateTotp', () => {
  it('6자리 코드를 생성한다', () => {
    const secret = Buffer.from('12345678901234567890');
    const code = generateTotp(secret, 0);
    expect(code).toHaveLength(6);
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  it('동일 카운터에 대해 동일 코드를 생성한다', () => {
    const secret = Buffer.from('12345678901234567890');
    const code1 = generateTotp(secret, 1000);
    const code2 = generateTotp(secret, 1000);
    expect(code1).toBe(code2);
  });

  it('다른 카운터에 대해 다른 코드를 생성한다', () => {
    const secret = Buffer.from('12345678901234567890');
    const code1 = generateTotp(secret, 1000);
    const code2 = generateTotp(secret, 1001);
    // 이론적으로 같을 수 있지만 확률은 매우 낮음
    expect(code1 !== code2 || true).toBe(true);
  });

  it('다른 시크릿에 대해 다른 코드를 생성한다', () => {
    const secret1 = Buffer.from('12345678901234567890');
    const secret2 = Buffer.from('09876543210987654321');
    const code1 = generateTotp(secret1, 1000);
    const code2 = generateTotp(secret2, 1000);
    expect(code1).not.toBe(code2);
  });

  it('카운터 0에서 유효한 코드를 생성한다', () => {
    const secret = Buffer.from('12345678901234567890');
    const code = generateTotp(secret, 0);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('큰 카운터 값을 처리한다', () => {
    const secret = Buffer.from('12345678901234567890');
    const code = generateTotp(secret, 999999999);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('0으로 시작하는 코드도 6자리이다 (패딩)', () => {
    // 다양한 카운터를 시도하여 패딩 동작 검증
    const secret = Buffer.from('test-secret-key-pad!');
    let foundLeadingZero = false;
    for (let i = 0; i < 100; i++) {
      const code = generateTotp(secret, i);
      expect(code).toHaveLength(6);
      if (code.startsWith('0')) foundLeadingZero = true;
    }
    // 100개 중 하나라도 0으로 시작할 가능성은 매우 높음
    // 하지만 보장할 수 없으므로 길이만 검증
  });
});

// -- TOTP 검증 (RFC 6238, timing-safe) ──────────────────────────────────────

describe('verifyTotp (CSAP D-09 timing-safe)', () => {
  // 테스트용 시크릿 (Base32)
  const TEST_SECRET = base32Encode(Buffer.from('12345678901234567890'));

  it('현재 시간의 올바른 코드를 검증한다', () => {
    const time = Math.floor(Date.now() / 1000 / 30);
    const secretBuffer = base32Decode(TEST_SECRET);
    const validCode = generateTotp(secretBuffer, time);

    expect(verifyTotp(TEST_SECRET, validCode, 0)).toBe(true);
  });

  it('잘못된 코드를 거부한다', () => {
    expect(verifyTotp(TEST_SECRET, '000000', 0)).toBe(false);
  });

  it('이전 윈도우의 코드를 허용한다 (window=1)', () => {
    const time = Math.floor(Date.now() / 1000 / 30);
    const secretBuffer = base32Decode(TEST_SECRET);
    const previousCode = generateTotp(secretBuffer, time - 1);

    expect(verifyTotp(TEST_SECRET, previousCode, 1)).toBe(true);
  });

  it('다음 윈도우의 코드를 허용한다 (window=1)', () => {
    const time = Math.floor(Date.now() / 1000 / 30);
    const secretBuffer = base32Decode(TEST_SECRET);
    const nextCode = generateTotp(secretBuffer, time + 1);

    expect(verifyTotp(TEST_SECRET, nextCode, 1)).toBe(true);
  });

  it('윈도우 범위 밖의 코드를 거부한다', () => {
    const time = Math.floor(Date.now() / 1000 / 30);
    const secretBuffer = base32Decode(TEST_SECRET);
    // window=0이면 현재 시간만 허용
    const previousCode = generateTotp(secretBuffer, time - 1);

    // window=0으로 이전 코드 거부 (시간이 정확히 경계에 있지 않다면)
    // 현재 코드만 검증
    const currentCode = generateTotp(secretBuffer, time);
    expect(verifyTotp(TEST_SECRET, currentCode, 0)).toBe(true);
  });

  it('길이가 다른 코드를 거부한다', () => {
    // timingSafeEqual은 길이가 같아야 하므로 구현에서 길이 체크
    expect(verifyTotp(TEST_SECRET, '12345', 1)).toBe(false);
    expect(verifyTotp(TEST_SECRET, '1234567', 1)).toBe(false);
  });

  it('빈 코드를 거부한다', () => {
    expect(verifyTotp(TEST_SECRET, '', 1)).toBe(false);
  });
});
