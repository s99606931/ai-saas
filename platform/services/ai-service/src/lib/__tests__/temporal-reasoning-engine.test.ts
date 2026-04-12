import { describe, it, expect } from 'vitest';
import {
  TemporalReasoningEngine,
  type Interval,
} from '../temporal-reasoning-engine.js';

const DAY = 86400000;
// 2026-04-12 00:00 KST → UTC = 2026-04-11T15:00:00Z
const FIXED_NOW = Date.UTC(2026, 3, 11, 15, 0, 0);

function mk(holidays: string[] = []): TemporalReasoningEngine {
  return new TemporalReasoningEngine({
    now: FIXED_NOW,
    timezoneOffsetMin: 540,
    holidays,
  });
}

describe('한국어 파서 (FR-R85.1)', () => {
  it('오늘', () => {
    const e = mk();
    const r = e.parseKoreanDate('오늘');
    expect(r.ok).toBe(true);
    expect(r.epochMs).toBe(FIXED_NOW);
  });

  it('어제', () => {
    const e = mk();
    const r = e.parseKoreanDate('어제');
    expect(r.ok).toBe(true);
    expect(r.epochMs).toBe(FIXED_NOW - DAY);
  });

  it('내일', () => {
    const e = mk();
    const r = e.parseKoreanDate('내일');
    expect(r.ok).toBe(true);
    expect(r.epochMs).toBe(FIXED_NOW + DAY);
  });

  it('모레', () => {
    const e = mk();
    const r = e.parseKoreanDate('모레');
    expect(r.epochMs).toBe(FIXED_NOW + 2 * DAY);
  });

  it('3일 전', () => {
    const e = mk();
    const r = e.parseKoreanDate('3일 전');
    expect(r.epochMs).toBe(FIXED_NOW - 3 * DAY);
  });

  it('5일 후', () => {
    const e = mk();
    const r = e.parseKoreanDate('5일 후');
    expect(r.epochMs).toBe(FIXED_NOW + 5 * DAY);
  });

  it('2주 전', () => {
    const e = mk();
    const r = e.parseKoreanDate('2주 전');
    expect(r.epochMs).toBe(FIXED_NOW - 14 * DAY);
  });

  it('1개월 후', () => {
    const e = mk();
    const r = e.parseKoreanDate('1개월 후');
    expect(r.epochMs).toBe(FIXED_NOW + 30 * DAY);
  });

  it('YYYY-MM-DD 절대', () => {
    const e = mk();
    const r = e.parseKoreanDate('2026-04-15');
    expect(r.ok).toBe(true);
    // 2026-04-15 00:00 KST → UTC
    const expected = Date.UTC(2026, 3, 15) - 540 * 60 * 1000;
    expect(r.epochMs).toBe(expected);
  });

  it('파싱 실패 시 ok=false', () => {
    const e = mk();
    const r = e.parseKoreanDate('지난달 셋째 주');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('UNSUPPORTED_FORMAT');
  });
});

describe('Allen 관계 (FR-R85.2)', () => {
  const e = mk();
  const A: Interval = { startMs: 100, endMs: 200 };

  it('before', () => {
    expect(e.allenRelation(A, { startMs: 300, endMs: 400 })).toBe('before');
  });
  it('after', () => {
    expect(e.allenRelation(A, { startMs: 0, endMs: 50 })).toBe('after');
  });
  it('meets', () => {
    expect(e.allenRelation(A, { startMs: 200, endMs: 300 })).toBe('meets');
  });
  it('met-by', () => {
    expect(e.allenRelation(A, { startMs: 0, endMs: 100 })).toBe('met-by');
  });
  it('overlaps', () => {
    expect(e.allenRelation(A, { startMs: 150, endMs: 250 })).toBe('overlaps');
  });
  it('overlapped-by', () => {
    expect(e.allenRelation(A, { startMs: 50, endMs: 150 })).toBe('overlapped-by');
  });
  it('starts', () => {
    expect(e.allenRelation(A, { startMs: 100, endMs: 300 })).toBe('starts');
  });
  it('started-by', () => {
    expect(e.allenRelation(A, { startMs: 100, endMs: 150 })).toBe('started-by');
  });
  it('finishes', () => {
    expect(e.allenRelation(A, { startMs: 50, endMs: 200 })).toBe('finishes');
  });
  it('finished-by', () => {
    expect(e.allenRelation(A, { startMs: 150, endMs: 200 })).toBe('finished-by');
  });
  it('during', () => {
    expect(e.allenRelation(A, { startMs: 50, endMs: 250 })).toBe('during');
  });
  it('contains', () => {
    expect(e.allenRelation(A, { startMs: 120, endMs: 180 })).toBe('contains');
  });
  it('equals', () => {
    expect(e.allenRelation(A, { startMs: 100, endMs: 200 })).toBe('equals');
  });

  it('잘못된 interval throw', () => {
    expect(() =>
      e.allenRelation({ startMs: 200, endMs: 100 }, A),
    ).toThrow('INVALID_INTERVAL');
  });
});

describe('기간 계산 (FR-R85.3)', () => {
  const e = mk();

  it('diffDays', () => {
    expect(e.diffDays(0, 5 * DAY)).toBe(5);
    expect(e.diffDays(5 * DAY, 0)).toBe(5); // 절대값
  });

  it('diffWeeks', () => {
    expect(e.diffWeeks(0, 21 * DAY)).toBe(3);
  });
});

describe('영업일/기한 (FR-R85.4)', () => {
  it('주말 건너뛰기', () => {
    const e = mk();
    // 2026-04-13 월요일 KST 기준 5영업일 후 → 2026-04-20 월요일
    const start = e.parseKoreanDate('2026-04-13').epochMs;
    expect(start).toBeDefined();
    if (!start) {
      return;
    }
    const r = e.addBusinessDays(start, 5);
    expect(r.businessDaysUsed).toBe(5);
    expect(r.holidaysSkipped).toBeGreaterThanOrEqual(2); // 최소 토/일 1세트
    // 결과는 2026-04-20
    const expected = e.parseKoreanDate('2026-04-20').epochMs;
    expect(r.deadlineMs).toBe(expected);
  });

  it('공휴일 건너뛰기', () => {
    const e = mk(['2026-04-15']);
    const start = e.parseKoreanDate('2026-04-13').epochMs;
    if (!start) {
      return;
    }
    const r = e.addBusinessDays(start, 3);
    // 13(월)+1=14(화), +2=15(공휴일→건너뜀)→16(수), +3=17(목)
    const expected = e.parseKoreanDate('2026-04-17').epochMs;
    expect(r.deadlineMs).toBe(expected);
    expect(r.holidaysSkipped).toBeGreaterThanOrEqual(1);
  });

  it('computeDeadline 위임', () => {
    const e = mk();
    const start = e.parseKoreanDate('2026-04-13').epochMs;
    if (!start) {
      return;
    }
    const r1 = e.computeDeadline(start, 5);
    const r2 = e.addBusinessDays(start, 5);
    expect(r1.deadlineMs).toBe(r2.deadlineMs);
  });

  it('음수 일수 throw', () => {
    const e = mk();
    expect(() => e.addBusinessDays(0, -1)).toThrow('NEGATIVE_DAYS');
  });

  it('0일 = 당일', () => {
    const e = mk();
    const start = 1000000;
    const r = e.addBusinessDays(start, 0);
    expect(r.deadlineMs).toBe(start);
    expect(r.businessDaysUsed).toBe(0);
  });
});

describe('감사 로그 (FR-R85.5)', () => {
  it('PARSE_OK 기록', () => {
    const e = mk();
    e.parseKoreanDate('오늘');
    expect(e.getAuditLog().some((x) => x.action === 'PARSE_OK')).toBe(true);
  });

  it('PARSE_FAIL 기록', () => {
    const e = mk();
    e.parseKoreanDate('알 수 없음');
    expect(e.getAuditLog().some((x) => x.action === 'PARSE_FAIL')).toBe(true);
  });

  it('RELATE 기록', () => {
    const e = mk();
    e.allenRelation({ startMs: 0, endMs: 10 }, { startMs: 20, endMs: 30 });
    expect(e.getAuditLog().some((x) => x.action === 'RELATE')).toBe(true);
  });

  it('DEADLINE 기록', () => {
    const e = mk();
    e.addBusinessDays(0, 1);
    expect(e.getAuditLog().some((x) => x.action === 'DEADLINE')).toBe(true);
  });
});
