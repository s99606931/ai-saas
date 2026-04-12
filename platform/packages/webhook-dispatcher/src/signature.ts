// Webhook 서명 생성/검증 (HMAC-SHA256 + timestamp replay 방지)
// Design Ref: SVC-WEBHOOK-R52.design.md §2
// Plan SC: FR-WH.1, FR-WH.2, FR-WH.7, FR-WH.8
// CSAP: D-09-02 암호화, D-12-02 입력 검증

import { createHmac, timingSafeEqual } from 'node:crypto';

/** 표준 HMAC 서명 헤더 이름 */
export const SIGNATURE_HEADER = 'x-public-saas-signature';
/** 표준 타임스탬프 헤더 이름 */
export const TIMESTAMP_HEADER = 'x-public-saas-timestamp';
/** 기본 replay 허용 범위 (5분) */
export const DEFAULT_TOLERANCE_SECONDS = 300;

export interface SignResult {
  /** 서명 값 (sha256=<hex>) */
  signature: string;
  /** 서명 생성 시점 (epoch seconds) */
  timestamp: number;
}

export interface VerifyOptions {
  /** replay 허용 범위 (초, 기본 300) */
  toleranceSeconds?: number;
  /** 현재 시각 주입 (테스트용, epoch seconds) */
  now?: () => number;
}

export type VerifyReason =
  | 'invalid-timestamp'
  | 'timestamp-out-of-tolerance'
  | 'length-mismatch'
  | 'signature-mismatch';

export interface VerifyResult {
  valid: boolean;
  reason?: VerifyReason;
}

/**
 * 페이로드에 HMAC-SHA256 서명을 생성한다.
 * Plan SC: FR-WH.1
 *
 * @param body - 원본 페이로드 문자열 (JSON.stringify 결과)
 * @param secret - HMAC 비밀키
 * @param timestamp - 선택: 강제 타임스탬프 (epoch seconds)
 * @returns 서명 + 타임스탬프
 */
export function signPayload(
  body: string,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000),
): SignResult {
  if (typeof body !== 'string') {
    throw new TypeError('body must be a string');
  }
  if (!secret || typeof secret !== 'string') {
    throw new TypeError('secret must be a non-empty string');
  }
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    throw new RangeError('timestamp must be a non-negative finite number');
  }

  const payload = `${timestamp}.${body}`;
  const digest = createHmac('sha256', secret).update(payload).digest('hex');
  return { signature: `sha256=${digest}`, timestamp };
}

/**
 * HMAC 서명 검증 (타이밍 상수 비교 + replay 허용 범위 검증)
 * Plan SC: FR-WH.2, FR-WH.7
 *
 * @param body - 원본 페이로드 문자열
 * @param signature - `sha256=<hex>` 형식 서명
 * @param secret - HMAC 비밀키
 * @param timestamp - 서명 생성 시점 (epoch seconds)
 * @param options - 검증 옵션
 */
export function verifySignature(
  body: string,
  signature: string,
  secret: string,
  timestamp: number,
  options: VerifyOptions = {},
): VerifyResult {
  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const now = options.now?.() ?? Math.floor(Date.now() / 1000);

  if (!Number.isFinite(timestamp) || timestamp < 0) {
    return { valid: false, reason: 'invalid-timestamp' };
  }

  if (Math.abs(now - timestamp) > tolerance) {
    return { valid: false, reason: 'timestamp-out-of-tolerance' };
  }

  const expectedDigest = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  const expected = `sha256=${expectedDigest}`;

  const actualBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);

  if (actualBuf.length !== expectedBuf.length) {
    return { valid: false, reason: 'length-mismatch' };
  }
  if (!timingSafeEqual(actualBuf, expectedBuf)) {
    return { valid: false, reason: 'signature-mismatch' };
  }

  return { valid: true };
}
