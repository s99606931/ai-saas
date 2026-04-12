// KST ISO 8601 포맷 변환
// Design Ref: SVC-TIMEZONE-R53.design.md §2.1
// Plan SC: FR-TZ.1, FR-TZ.2

import { KST_OFFSET_LABEL, KST_OFFSET_MS } from './constants.js';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Date를 KST 기준 ISO 8601 문자열로 변환한다.
 * 결과 예: 2026-04-11T15:30:00+09:00
 * Plan SC: FR-TZ.1
 */
export function toKstIsoString(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new TypeError('toKstIsoString: invalid Date');
  }
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return (
    `${kst.getUTCFullYear()}-${pad2(kst.getUTCMonth() + 1)}-${pad2(kst.getUTCDate())}` +
    `T${pad2(kst.getUTCHours())}:${pad2(kst.getUTCMinutes())}:${pad2(kst.getUTCSeconds())}` +
    `${KST_OFFSET_LABEL}`
  );
}

/**
 * KST ISO 8601 문자열을 Date로 파싱한다.
 * 오프셋 인식은 JS Date 내장 파서에 위임.
 * Plan SC: FR-TZ.2
 */
export function fromKstIsoString(s: string): Date {
  if (typeof s !== 'string') {
    throw new TypeError('fromKstIsoString: expected string');
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) {
    throw new RangeError(`fromKstIsoString: invalid ISO string "${s}"`);
  }
  return d;
}
