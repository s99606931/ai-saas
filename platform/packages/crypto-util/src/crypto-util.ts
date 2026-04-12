// Crypto Utility -- AES-256-GCM + HMAC-SHA256
// Design Ref: SVC-CRYPTO-R37 DESIGN
// Plan SC: FR-CR.1~FR-CR.6
// CSAP: D-09 암호화

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  pbkdf2Sync,
  timingSafeEqual,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export class CryptoError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'CryptoError';
  }
}

/**
 * AES-256-GCM 암호화
 * Plan SC: FR-CR.1
 *
 * @returns base64(iv || ciphertext || authTag)
 */
export function encrypt(plaintext: string, key: Buffer): string {
  if (key.length !== KEY_LENGTH) {
    throw new CryptoError(`키는 ${KEY_LENGTH} 바이트여야 합니다.`, 'INVALID_KEY_LENGTH');
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, ciphertext, authTag]).toString('base64');
}

/**
 * AES-256-GCM 복호화 (인증 태그 검증)
 * Plan SC: FR-CR.2
 */
export function decrypt(encrypted: string, key: Buffer): string {
  if (key.length !== KEY_LENGTH) {
    throw new CryptoError(`키는 ${KEY_LENGTH} 바이트여야 합니다.`, 'INVALID_KEY_LENGTH');
  }

  let data: Buffer;
  try {
    data = Buffer.from(encrypted, 'base64');
  } catch {
    throw new CryptoError('base64 디코딩 실패', 'INVALID_ENCODING');
  }

  if (data.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new CryptoError('암호문이 너무 짧습니다.', 'INVALID_CIPHERTEXT');
  }

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(data.length - AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH, data.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  } catch {
    throw new CryptoError('복호화 또는 인증 실패 (위변조 가능성)', 'AUTH_FAILED');
  }
}

/**
 * HMAC-SHA256 서명
 * Plan SC: FR-CR.3
 */
export function hmacSign(data: string, key: Buffer): string {
  return createHmac('sha256', key).update(data).digest('hex');
}

/**
 * HMAC-SHA256 검증 (타이밍 안전)
 * Plan SC: FR-CR.3, FR-CR.6
 */
export function hmacVerify(data: string, signature: string, key: Buffer): boolean {
  const expected = hmacSign(data, key);
  return timingSafeCompare(expected, signature);
}

/**
 * PBKDF2 키 파생
 * Plan SC: FR-CR.4
 */
export function deriveKey(
  password: string,
  salt: Buffer,
  iterations = 100_000,
  keyLength = KEY_LENGTH,
): Buffer {
  if (salt.length < 16) {
    throw new CryptoError('솔트는 최소 16바이트여야 합니다.', 'INVALID_SALT');
  }
  if (iterations < 10_000) {
    throw new CryptoError('반복 횟수는 최소 10,000 이상이어야 합니다.', 'INVALID_ITERATIONS');
  }
  return pbkdf2Sync(password, salt, iterations, keyLength, 'sha256');
}

/**
 * 안전한 랜덤 토큰 (base64url)
 * Plan SC: FR-CR.5
 */
export function generateToken(bytes = 32): string {
  if (bytes < 16) {
    throw new CryptoError('토큰은 최소 16바이트여야 합니다.', 'INVALID_BYTES');
  }
  return randomBytes(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * 타이밍 안전 문자열 비교
 * Plan SC: FR-CR.6
 */
export function timingSafeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * 랜덤 키 생성 (32바이트 = 256비트)
 */
export function generateKey(): Buffer {
  return randomBytes(KEY_LENGTH);
}

/**
 * 랜덤 솔트 생성
 */
export function generateSalt(bytes = 16): Buffer {
  return randomBytes(bytes);
}
