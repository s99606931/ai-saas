// KST ISO 변환 테스트
// Plan SC: FR-TZ.1, FR-TZ.2

import { describe, it, expect } from 'vitest';
import { toKstIsoString, fromKstIsoString } from '../src/iso.js';

describe('toKstIsoString (FR-TZ.1)', () => {
  it('UTC 2026-04-11T00:00:00Z → KST 2026-04-11T09:00:00+09:00', () => {
    const d = new Date('2026-04-11T00:00:00.000Z');
    expect(toKstIsoString(d)).toBe('2026-04-11T09:00:00+09:00');
  });

  it('UTC 2026-01-01T15:00:00Z → KST 2026-01-02T00:00:00+09:00', () => {
    const d = new Date('2026-01-01T15:00:00.000Z');
    expect(toKstIsoString(d)).toBe('2026-01-02T00:00:00+09:00');
  });

  it('UTC 2025-12-31T23:59:59Z → KST 2026-01-01T08:59:59+09:00 (날짜/연도 경계)', () => {
    const d = new Date('2025-12-31T23:59:59.000Z');
    expect(toKstIsoString(d)).toBe('2026-01-01T08:59:59+09:00');
  });

  it('결과는 항상 +09:00 오프셋으로 종결된다', () => {
    const d = new Date(2026, 5, 15, 12, 30, 45);
    expect(toKstIsoString(d).endsWith('+09:00')).toBe(true);
  });

  it('invalid Date는 TypeError를 throw한다', () => {
    expect(() => toKstIsoString(new Date('invalid'))).toThrow(TypeError);
  });
});

describe('fromKstIsoString (FR-TZ.2)', () => {
  it('KST ISO 문자열을 Date로 파싱한다', () => {
    const d = fromKstIsoString('2026-04-11T09:00:00+09:00');
    expect(d.getTime()).toBe(new Date('2026-04-11T00:00:00.000Z').getTime());
  });

  it('UTC Z 오프셋도 허용한다', () => {
    const d = fromKstIsoString('2026-04-11T00:00:00Z');
    expect(d.toISOString()).toBe('2026-04-11T00:00:00.000Z');
  });

  it('잘못된 문자열은 RangeError를 throw한다', () => {
    expect(() => fromKstIsoString('not-a-date')).toThrow(RangeError);
  });

  it('문자열이 아니면 TypeError를 throw한다', () => {
    expect(() => fromKstIsoString(123 as unknown as string)).toThrow(TypeError);
  });
});

describe('to↔from 왕복', () => {
  it('toKst → fromKst 결과는 원본과 동일하다', () => {
    const original = new Date('2026-07-04T12:34:56.000Z');
    const iso = toKstIsoString(original);
    const parsed = fromKstIsoString(iso);
    expect(parsed.getTime()).toBe(original.getTime());
  });
});
