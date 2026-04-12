// Signature 단위 테스트
// Design Ref: SVC-WEBHOOK-R52.design.md §2
// Plan SC: FR-WH.1, FR-WH.2, FR-WH.7, FR-WH.8

import { describe, it, expect } from 'vitest';
import {
  signPayload,
  verifySignature,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  DEFAULT_TOLERANCE_SECONDS,
} from '../src/signature.js';

describe('signPayload (FR-WH.1)', () => {
  it('서명은 "sha256=" 접두사를 포함한다', () => {
    const result = signPayload('{"event":"test"}', 'my-secret', 1700000000);
    expect(result.signature.startsWith('sha256=')).toBe(true);
  });

  it('동일한 body/secret/timestamp는 결정적인 서명을 반환한다', () => {
    const a = signPayload('{"x":1}', 'secret', 100);
    const b = signPayload('{"x":1}', 'secret', 100);
    expect(a.signature).toBe(b.signature);
  });

  it('서로 다른 secret은 다른 서명을 만든다', () => {
    const a = signPayload('{"x":1}', 'sec-a', 100);
    const b = signPayload('{"x":1}', 'sec-b', 100);
    expect(a.signature).not.toBe(b.signature);
  });

  it('timestamp 생략 시 현재 시각을 사용한다', () => {
    const before = Math.floor(Date.now() / 1000);
    const result = signPayload('body', 'secret');
    const after = Math.floor(Date.now() / 1000);
    expect(result.timestamp).toBeGreaterThanOrEqual(before);
    expect(result.timestamp).toBeLessThanOrEqual(after + 1);
  });

  it('body가 문자열이 아니면 TypeError를 throw한다', () => {
    expect(() => signPayload(123 as unknown as string, 'secret')).toThrow(TypeError);
  });

  it('secret이 빈 문자열이면 TypeError를 throw한다', () => {
    expect(() => signPayload('body', '')).toThrow(TypeError);
  });
});

describe('verifySignature (FR-WH.2, FR-WH.7)', () => {
  const body = '{"event":"order.created","id":42}';
  const secret = 'webhook-secret';

  it('정상 서명을 검증한다', () => {
    const ts = 1_700_000_000;
    const { signature } = signPayload(body, secret, ts);
    const result = verifySignature(body, signature, secret, ts, {
      now: () => ts + 10,
    });
    expect(result.valid).toBe(true);
  });

  it('비밀키가 다르면 signature-mismatch를 반환한다', () => {
    const ts = 1_700_000_000;
    const { signature } = signPayload(body, secret, ts);
    const result = verifySignature(body, signature, 'other-secret', ts, {
      now: () => ts,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('signature-mismatch');
  });

  it('body가 변조되면 signature-mismatch를 반환한다', () => {
    const ts = 1_700_000_000;
    const { signature } = signPayload(body, secret, ts);
    const tampered = body.replace('42', '43');
    const result = verifySignature(tampered, signature, secret, ts, {
      now: () => ts,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('signature-mismatch');
  });

  it('timestamp를 변조하면 signature-mismatch를 반환한다', () => {
    const ts = 1_700_000_000;
    const { signature } = signPayload(body, secret, ts);
    // 원래 timestamp와 다른 값으로 검증 → 기대 서명 다름
    const result = verifySignature(body, signature, secret, ts + 1, {
      now: () => ts + 1,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('signature-mismatch');
  });

  it('tolerance 기본값(300초) 내에서 허용한다', () => {
    const ts = 1_700_000_000;
    const { signature } = signPayload(body, secret, ts);
    const result = verifySignature(body, signature, secret, ts, {
      now: () => ts + 250,
    });
    expect(result.valid).toBe(true);
  });

  it('tolerance 기본값(300초)을 초과하면 거부한다', () => {
    const ts = 1_700_000_000;
    const { signature } = signPayload(body, secret, ts);
    const result = verifySignature(body, signature, secret, ts, {
      now: () => ts + 400,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('timestamp-out-of-tolerance');
  });

  it('DEFAULT_TOLERANCE_SECONDS 상수는 300이다', () => {
    expect(DEFAULT_TOLERANCE_SECONDS).toBe(300);
  });

  it('invalid timestamp(NaN)는 invalid-timestamp를 반환한다', () => {
    const ts = 1_700_000_000;
    const { signature } = signPayload(body, secret, ts);
    const result = verifySignature(body, signature, secret, NaN);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid-timestamp');
  });

  it('길이가 다른 서명은 length-mismatch를 반환한다', () => {
    const ts = 1_700_000_000;
    const result = verifySignature(body, 'sha256=short', secret, ts, {
      now: () => ts,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('length-mismatch');
  });

  it('custom toleranceSeconds를 지원한다', () => {
    const ts = 1_700_000_000;
    const { signature } = signPayload(body, secret, ts);
    const result = verifySignature(body, signature, secret, ts, {
      now: () => ts + 20,
      toleranceSeconds: 10,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('timestamp-out-of-tolerance');
  });
});

describe('상수 (FR-WH.8)', () => {
  it('SIGNATURE_HEADER = x-public-saas-signature', () => {
    expect(SIGNATURE_HEADER).toBe('x-public-saas-signature');
  });

  it('TIMESTAMP_HEADER = x-public-saas-timestamp', () => {
    expect(TIMESTAMP_HEADER).toBe('x-public-saas-timestamp');
  });
});
