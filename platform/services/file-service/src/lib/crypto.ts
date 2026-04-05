// 파일 암호화 유틸리티
// Design Ref: DESIGN-MTU-P12
// Plan SC: FR-P12.3
// CSAP: D-09 — AES-256 암호화

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * AES-256-GCM 암호화
 * CSAP D-09: 저장 데이터 암호화 필수
 */
export function encrypt(data: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // IV(16) + AuthTag(16) + Encrypted Data
  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * AES-256-GCM 복호화
 */
export function decrypt(encryptedData: Buffer, key: Buffer): Buffer {
  const iv = encryptedData.subarray(0, IV_LENGTH);
  const authTag = encryptedData.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const data = encryptedData.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/**
 * 암호화 키 생성 (환경 변수에서 로드하거나 생성)
 */
export function getEncryptionKey(): Buffer {
  const keyHex = process.env['FILE_ENCRYPTION_KEY'];
  if (!keyHex) {
    throw new Error('FILE_ENCRYPTION_KEY 환경 변수가 설정되지 않았습니다 (CSAP D-09)');
  }
  return Buffer.from(keyHex, 'hex');
}
