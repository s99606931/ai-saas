// KST 포맷 테스트
// Plan SC: FR-TZ.7, FR-TZ.8

import { describe, it, expect } from 'vitest';
import { formatKst, getKstDateParts } from '../src/format.js';

describe('formatKst (FR-TZ.7)', () => {
  const d = new Date('2026-04-11T03:05:07.000Z'); // KST 12:05:07

  it('YYYY-MM-DD 패턴', () => {
    expect(formatKst(d, 'YYYY-MM-DD')).toBe('2026-04-11');
  });

  it('HH:mm:ss 패턴', () => {
    expect(formatKst(d, 'HH:mm:ss')).toBe('12:05:07');
  });

  it('YYYY-MM-DD HH:mm:ss (월 MM과 분 mm 혼용)', () => {
    expect(formatKst(d, 'YYYY-MM-DD HH:mm:ss')).toBe('2026-04-11 12:05:07');
  });

  it('빈 패턴은 빈 문자열을 반환한다', () => {
    expect(formatKst(d, '')).toBe('');
  });

  it('고정 문자를 보존한다', () => {
    expect(formatKst(d, '발송 시각: YYYY-MM-DD')).toBe('발송 시각: 2026-04-11');
  });

  it('pattern이 string이 아니면 TypeError를 throw한다', () => {
    expect(() => formatKst(d, 123 as unknown as string)).toThrow(TypeError);
  });
});

describe('getKstDateParts (FR-TZ.8)', () => {
  it('UTC 2026-04-11T03:05:07Z → KST 12:05:07 parts', () => {
    const d = new Date('2026-04-11T03:05:07.000Z');
    const parts = getKstDateParts(d);
    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(4);
    expect(parts.day).toBe(11);
    expect(parts.hour).toBe(12);
    expect(parts.minute).toBe(5);
    expect(parts.second).toBe(7);
  });

  it('dayOfWeek를 올바르게 반환한다 (2026-04-11은 토요일)', () => {
    const d = new Date('2026-04-11T03:00:00.000Z');
    const parts = getKstDateParts(d);
    // 2026-04-11 KST = 토요일 = 6
    expect(parts.dayOfWeek).toBe(6);
  });

  it('invalid Date는 TypeError', () => {
    expect(() => getKstDateParts(new Date('x'))).toThrow(TypeError);
  });
});
