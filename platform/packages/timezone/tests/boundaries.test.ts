// KST 경계 계산 테스트
// Plan SC: FR-TZ.3, FR-TZ.4, FR-TZ.5, FR-TZ.6

import { describe, it, expect } from 'vitest';
import {
  startOfDayKst,
  endOfDayKst,
  startOfMonthKst,
  endOfMonthKst,
} from '../src/boundaries.js';
import { toKstIsoString } from '../src/iso.js';

describe('startOfDayKst (FR-TZ.3)', () => {
  it('KST 정오를 KST 00:00:00으로 변환한다', () => {
    const d = new Date('2026-04-11T03:00:00.000Z'); // KST 12:00
    const result = startOfDayKst(d);
    expect(toKstIsoString(result)).toBe('2026-04-11T00:00:00+09:00');
  });

  it('KST 자정 경계(UTC 15:00)를 다음 날로 처리한다', () => {
    const d = new Date('2026-04-11T15:00:00.000Z'); // KST 2026-04-12 00:00
    const result = startOfDayKst(d);
    expect(toKstIsoString(result)).toBe('2026-04-12T00:00:00+09:00');
  });

  it('이미 KST 00:00인 Date는 동일하게 반환된다', () => {
    const d = new Date('2026-04-10T15:00:00.000Z'); // KST 2026-04-11 00:00
    const result = startOfDayKst(d);
    expect(result.getTime()).toBe(d.getTime());
  });
});

describe('endOfDayKst (FR-TZ.4)', () => {
  it('KST 기준 23:59:59.999를 반환한다', () => {
    const d = new Date('2026-04-11T03:00:00.000Z');
    const result = endOfDayKst(d);
    expect(toKstIsoString(result)).toBe('2026-04-11T23:59:59+09:00');
    expect(result.getUTCMilliseconds()).toBe(999);
  });

  it('startOfDay + 1일 - 1ms = endOfDay', () => {
    const d = new Date('2026-04-11T03:00:00.000Z');
    const start = startOfDayKst(d);
    const end = endOfDayKst(d);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
  });
});

describe('startOfMonthKst (FR-TZ.5)', () => {
  it('KST 기준 월초 00:00:00을 반환한다', () => {
    const d = new Date('2026-04-15T03:00:00.000Z');
    const result = startOfMonthKst(d);
    expect(toKstIsoString(result)).toBe('2026-04-01T00:00:00+09:00');
  });

  it('UTC 월말이지만 KST 다음 달 1일이면 KST 월초를 반환한다', () => {
    // UTC 2026-03-31T15:00:00Z = KST 2026-04-01 00:00
    const d = new Date('2026-03-31T15:00:00.000Z');
    const result = startOfMonthKst(d);
    expect(toKstIsoString(result)).toBe('2026-04-01T00:00:00+09:00');
  });

  it('1월 1일은 동일 연도 1월 1일을 반환한다', () => {
    const d = new Date('2026-01-15T03:00:00.000Z');
    const result = startOfMonthKst(d);
    expect(toKstIsoString(result)).toBe('2026-01-01T00:00:00+09:00');
  });
});

describe('endOfMonthKst (FR-TZ.6)', () => {
  it('4월 말일(30일)을 반환한다', () => {
    const d = new Date('2026-04-11T03:00:00.000Z');
    const result = endOfMonthKst(d);
    expect(toKstIsoString(result)).toBe('2026-04-30T23:59:59+09:00');
  });

  it('2월 평년 28일을 반환한다', () => {
    const d = new Date('2026-02-15T03:00:00.000Z');
    const result = endOfMonthKst(d);
    expect(toKstIsoString(result)).toBe('2026-02-28T23:59:59+09:00');
  });

  it('2024년 2월(윤년) 29일을 반환한다', () => {
    const d = new Date('2024-02-10T03:00:00.000Z');
    const result = endOfMonthKst(d);
    expect(toKstIsoString(result)).toBe('2024-02-29T23:59:59+09:00');
  });

  it('12월 31일을 반환한다', () => {
    const d = new Date('2026-12-15T03:00:00.000Z');
    const result = endOfMonthKst(d);
    expect(toKstIsoString(result)).toBe('2026-12-31T23:59:59+09:00');
  });
});
