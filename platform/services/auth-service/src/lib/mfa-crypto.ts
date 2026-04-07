// MFA 시크릿 암호화/복호화
// Design Ref: DESIGN-MTU-P01 Section 3
// Plan SC: FR-P01.10
// CSAP: D-09 -- MFA 시크릿은 AES-256-GCM으로 암호화 저장 필수

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * MFA 암호화 키 로드
 * CSAP D-09: 환경 변수에서 암호화 키 로드 (하드코딩 금지)
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env['MFA_ENCRYPTION_KEY'];
  if (!keyHex) {
    throw new Error('MFA_ENCRYPTION_KEY 환경 변수가 설정되지 않았습니다 (CSAP D-09)');
  }
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('MFA_ENCRYPTION_KEY는 64자 hex (32바이트)여야 합니다');
  }
  return key;
}

/**
 * MFA 시크릿 암호화 (AES-256-GCM)
 * 반환: hex 인코딩된 IV + AuthTag + 암호문
 */
export function encryptMfaSecret(secret: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // IV(16) + AuthTag(16) + 암호문
  return Buffer.concat([iv, authTag, encrypted]).toString('hex');
}

/**
 * MFA 시크릿 복호화
 */
export function decryptMfaSecret(encryptedHex: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(encryptedHex, 'hex');

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8');
}
