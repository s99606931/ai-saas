// TOTP 유틸리티 (RFC 6238)
// Design Ref: SVC-AUTH-R1 DESIGN §1.2
// Plan SC: FR-AUTH.1
// CSAP: D-08-08 다중 인증

import crypto from 'node:crypto';

/**
 * Base32 인코딩 (RFC 4648)
 *
 * @param buffer - 인코딩할 바이트 버퍼
 * @returns Base32 인코딩된 문자열
 */
export function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let result = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += alphabet[(value >>> bits) & 0x1f];
    }
  }

  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 0x1f];
  }

  return result;
}

/**
 * Base32 디코딩
 *
 * @param input - Base32 인코딩된 문자열
 * @returns 디코딩된 바이트 버퍼
 */
export function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanInput = input.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of cleanInput) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((value >>> bits) & 0xff);
    }
  }

  return Buffer.from(output);
}

/**
 * TOTP 코드 생성 (HMAC-SHA1)
 *
 * @param secret - 바이트 시크릿
 * @param counter - 시간 카운터
 * @returns 6자리 TOTP 코드
 */
export function generateTotp(secret: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', secret).update(counterBuffer).digest();

  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);

  return (code % 1_000_000).toString().padStart(6, '0');
}

/**
 * TOTP 코드 검증 (RFC 6238)
 *
 * @param secret - Base32 인코딩된 시크릿
 * @param code - 6자리 TOTP 코드
 * @param window - 허용 시간 윈도우 (기본 1 = 전후 30초)
 * @returns 코드 유효 여부
 */
export function verifyTotp(secret: string, code: string, window = 1): boolean {
  const time = Math.floor(Date.now() / 1000 / 30);
  const secretBuffer = base32Decode(secret);

  for (let i = -window; i <= window; i++) {
    const counter = time + i;
    const generated = generateTotp(secretBuffer, counter);
    if (generated === code) {
      return true;
    }
  }

  return false;
}
