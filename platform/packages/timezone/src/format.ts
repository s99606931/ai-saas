// KST 포맷팅 유틸리티
// Design Ref: SVC-TIMEZONE-R53.design.md §2.3, §2.4
// Plan SC: FR-TZ.7, FR-TZ.8

import { KST_OFFSET_MS } from './constants.js';

export interface KstDateParts {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0=Sunday, 6=Saturday */
  dayOfWeek: number;
}

/**
 * KST 기준 연/월/일/시/분/초/요일을 객체로 반환한다.
 * Plan SC: FR-TZ.8
 */
export function getKstDateParts(date: Date): KstDateParts {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new TypeError('getKstDateParts: invalid Date');
  }
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth() + 1,
    day: kst.getUTCDate(),
    hour: kst.getUTCHours(),
    minute: kst.getUTCMinutes(),
    second: kst.getUTCSeconds(),
    dayOfWeek: kst.getUTCDay(),
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * KST 기준 패턴 포맷팅
 * 지원 토큰: YYYY, MM, DD, HH, mm, ss
 * Plan SC: FR-TZ.7
 *
 * 토큰은 단일 패스로 치환되므로 MM(월)과 mm(분) 충돌 없음.
 */
export function formatKst(date: Date, pattern: string): string {
  if (typeof pattern !== 'string') {
    throw new TypeError('formatKst: pattern must be a string');
  }
  const parts = getKstDateParts(date);
  const map: Record<string, string> = {
    YYYY: String(parts.year),
    MM: pad2(parts.month),
    DD: pad2(parts.day),
    HH: pad2(parts.hour),
    mm: pad2(parts.minute),
    ss: pad2(parts.second),
  };
  return pattern.replace(/YYYY|MM|DD|HH|mm|ss/g, (match) => map[match] ?? match);
}
