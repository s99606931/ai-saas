// KST 기준 일/월 경계 계산
// Design Ref: SVC-TIMEZONE-R53.design.md §2.2
// Plan SC: FR-TZ.3, FR-TZ.4, FR-TZ.5, FR-TZ.6

import { KST_OFFSET_MS } from './constants.js';

interface KstBoundaryParts {
  year: number;
  month: number;  // 0-11 (Date.UTC 호환)
  day: number;
  hour: number;
  minute: number;
  second: number;
  ms: number;
}

/**
 * KST로 환산한 후 parts 변환 함수를 적용하여 새 Date 생성
 */
function withKstParts(
  date: Date,
  transform: (y: number, mo: number, d: number) => KstBoundaryParts,
): Date {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new TypeError('invalid Date');
  }
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const parts = transform(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
  const kstTargetMs = Date.UTC(
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.ms,
  );
  return new Date(kstTargetMs - KST_OFFSET_MS);
}

/**
 * KST 기준 해당 일의 시작(00:00:00.000)을 Date로 반환한다.
 * Plan SC: FR-TZ.3
 */
export function startOfDayKst(date: Date): Date {
  return withKstParts(date, (y, mo, d) => ({
    year: y,
    month: mo,
    day: d,
    hour: 0,
    minute: 0,
    second: 0,
    ms: 0,
  }));
}

/**
 * KST 기준 해당 일의 끝(23:59:59.999)을 Date로 반환한다.
 * Plan SC: FR-TZ.4
 */
export function endOfDayKst(date: Date): Date {
  return withKstParts(date, (y, mo, d) => ({
    year: y,
    month: mo,
    day: d,
    hour: 23,
    minute: 59,
    second: 59,
    ms: 999,
  }));
}

/**
 * KST 기준 해당 월의 1일 00:00:00.000을 Date로 반환한다.
 * Plan SC: FR-TZ.5
 */
export function startOfMonthKst(date: Date): Date {
  return withKstParts(date, (y, mo) => ({
    year: y,
    month: mo,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
    ms: 0,
  }));
}

/**
 * KST 기준 해당 월의 마지막 날 23:59:59.999를 Date로 반환한다.
 * Date.UTC(year, month+1, 0)는 month의 마지막 날을 반환한다.
 * Plan SC: FR-TZ.6
 */
export function endOfMonthKst(date: Date): Date {
  return withKstParts(date, (y, mo) => {
    // 다음 달 0일 = 이번 달 마지막 날
    const lastDay = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    return {
      year: y,
      month: mo,
      day: lastDay,
      hour: 23,
      minute: 59,
      second: 59,
      ms: 999,
    };
  });
}
