// Temporal Reasoning Engine — FR-R85.1~R85.5
// Design Ref: SVC-AI-ADV-R85 DESIGN §Allen관계
// Plan SC: 한국어 시드 정답률 ≥ 90%, Allen 13종 지원
// CSAP: D-06 감사 / 행정절차법 제19조 기한 계산

export interface Interval {
  startMs: number;
  endMs: number;
}

export type AllenRelation =
  | 'before'
  | 'after'
  | 'meets'
  | 'met-by'
  | 'overlaps'
  | 'overlapped-by'
  | 'starts'
  | 'started-by'
  | 'finishes'
  | 'finished-by'
  | 'during'
  | 'contains'
  | 'equals';

export interface ParseResult {
  ok: boolean;
  epochMs?: number;
  reason?: string;
}

export interface EngineOptions {
  now: number;
  timezoneOffsetMin: number;
  holidays: string[]; // 'YYYY-MM-DD' (KST)
}

export interface DeadlineResult {
  startMs: number;
  deadlineMs: number;
  businessDaysUsed: number;
  holidaysSkipped: number;
}

export type AuditAction =
  | 'PARSE_OK'
  | 'PARSE_FAIL'
  | 'RELATE'
  | 'DEADLINE'
  | 'BLOCKED';

export interface AuditEvent {
  action: AuditAction;
  detail?: string;
  at: number;
}

const DAY_MS = 86400000;
const KST_OFFSET_MIN = 540;

const DEFAULT_OPTS: EngineOptions = {
  now: Date.now(),
  timezoneOffsetMin: KST_OFFSET_MIN,
  holidays: [],
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export class TemporalReasoningEngine {
  private readonly opts: EngineOptions;
  private readonly auditLog: AuditEvent[] = [];

  constructor(opts: Partial<EngineOptions> = {}) {
    this.opts = { ...DEFAULT_OPTS, ...opts };
  }

  // -- 한국어 파서 (FR-R85.1) -------------------------------------------------

  parseKoreanDate(text: string): ParseResult {
    const trimmed = text.trim();
    const now = this.opts.now;

    // 절대 날짜 'YYYY-MM-DD'
    const absMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (absMatch && absMatch[1] && absMatch[2] && absMatch[3]) {
      const y = Number(absMatch[1]);
      const m = Number(absMatch[2]);
      const d = Number(absMatch[3]);
      const epoch = this.kstDateToEpoch(y, m, d);
      this.audit('PARSE_OK', trimmed);
      return { ok: true, epochMs: epoch };
    }

    // 키워드
    const keywordMap: Record<string, number> = {
      오늘: 0,
      어제: -1,
      그제: -2,
      내일: 1,
      모레: 2,
      글피: 3,
    };
    if (trimmed in keywordMap) {
      const delta = keywordMap[trimmed] ?? 0;
      this.audit('PARSE_OK', trimmed);
      return { ok: true, epochMs: now + delta * DAY_MS };
    }

    // N일 전/후, N주 전/후, N개월 전/후
    const relMatch = trimmed.match(/^(\d+)\s*(일|주|개월)\s*(전|후)$/);
    if (relMatch && relMatch[1] && relMatch[2] && relMatch[3]) {
      const n = Number(relMatch[1]);
      const unit = relMatch[2];
      const dir = relMatch[3] === '후' ? 1 : -1;
      let ms = 0;
      if (unit === '일') {
        ms = n * DAY_MS;
      } else if (unit === '주') {
        ms = n * 7 * DAY_MS;
      } else {
        ms = n * 30 * DAY_MS;
      }
      this.audit('PARSE_OK', trimmed);
      return { ok: true, epochMs: now + dir * ms };
    }

    this.audit('PARSE_FAIL', trimmed);
    return { ok: false, reason: 'UNSUPPORTED_FORMAT' };
  }

  // -- Allen 관계 (FR-R85.2) --------------------------------------------------

  allenRelation(a: Interval, b: Interval): AllenRelation {
    if (a.startMs >= a.endMs || b.startMs >= b.endMs) {
      throw new Error('INVALID_INTERVAL');
    }
    const a1 = a.startMs;
    const a2 = a.endMs;
    const b1 = b.startMs;
    const b2 = b.endMs;

    let rel: AllenRelation;
    if (a1 === b1 && a2 === b2) {
      rel = 'equals';
    } else if (a2 < b1) {
      rel = 'before';
    } else if (b2 < a1) {
      rel = 'after';
    } else if (a2 === b1) {
      rel = 'meets';
    } else if (b2 === a1) {
      rel = 'met-by';
    } else if (a1 === b1 && a2 < b2) {
      rel = 'starts';
    } else if (a1 === b1 && a2 > b2) {
      rel = 'started-by';
    } else if (a2 === b2 && a1 > b1) {
      rel = 'finishes';
    } else if (a2 === b2 && a1 < b1) {
      rel = 'finished-by';
    } else if (a1 > b1 && a2 < b2) {
      rel = 'during';
    } else if (a1 < b1 && a2 > b2) {
      rel = 'contains';
    } else if (a1 < b1 && a2 > b1 && a2 < b2) {
      rel = 'overlaps';
    } else {
      rel = 'overlapped-by';
    }

    this.audit('RELATE', rel);
    return rel;
  }

  // -- 기간 계산 (FR-R85.3) ---------------------------------------------------

  diffDays(a: number, b: number): number {
    return Math.abs(Math.round((b - a) / DAY_MS));
  }

  diffWeeks(a: number, b: number): number {
    return Math.floor(this.diffDays(a, b) / 7);
  }

  // -- 영업일/기한 (FR-R85.3, R85.4) ------------------------------------------

  addBusinessDays(startMs: number, days: number): DeadlineResult {
    if (days < 0) {
      throw new Error('NEGATIVE_DAYS');
    }
    const holidaySet = new Set(this.opts.holidays);
    let current = startMs;
    let businessDaysUsed = 0;
    let holidaysSkipped = 0;

    while (businessDaysUsed < days) {
      current += DAY_MS;
      const { year, month, day, dow } = this.kstBreakdown(current);
      const key = `${year}-${pad2(month)}-${pad2(day)}`;
      if (dow === 0 || dow === 6) {
        holidaysSkipped += 1;
        continue;
      }
      if (holidaySet.has(key)) {
        holidaysSkipped += 1;
        continue;
      }
      businessDaysUsed += 1;
    }

    this.audit('DEADLINE', `start=${startMs},days=${days}`);
    return {
      startMs,
      deadlineMs: current,
      businessDaysUsed,
      holidaysSkipped,
    };
  }

  computeDeadline(startMs: number, businessDays: number): DeadlineResult {
    return this.addBusinessDays(startMs, businessDays);
  }

  // -- 유틸 -------------------------------------------------------------------

  getAuditLog(): AuditEvent[] {
    return [...this.auditLog];
  }

  private kstDateToEpoch(y: number, m: number, d: number): number {
    // KST 00:00 → UTC epoch
    const utcMidnight = Date.UTC(y, m - 1, d);
    return utcMidnight - this.opts.timezoneOffsetMin * 60 * 1000;
  }

  private kstBreakdown(epochMs: number): {
    year: number;
    month: number;
    day: number;
    dow: number;
  } {
    const shifted = new Date(epochMs + this.opts.timezoneOffsetMin * 60 * 1000);
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      dow: shifted.getUTCDay(),
    };
  }

  private audit(action: AuditAction, detail?: string): void {
    this.auditLog.push({ action, detail, at: Date.now() });
  }
}
