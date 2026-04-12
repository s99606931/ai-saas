// AI Telemetry Replayer — FR-R80.1~R80.5
// Design Ref: SVC-AI-ADV-R80 DESIGN §모듈
// Plan SC: 재현율 ≥ 95%, 마스킹 누락 0건
// CSAP: D-06 감사 / N2SF: N-05 등급

export type DataGrade = 'C' | 'S' | 'O';

export interface RecordInput {
  id: string;
  at?: number;
  tenantId: string;
  model: string;
  prompt: string;
  response: string;
  tags: string[];
  grade: DataGrade;
  latencyMs: number;
}

export interface AICallRecord {
  id: string;
  at: number;
  tenantId: string;
  model: string;
  prompt: string;
  response: string;
  tags: string[];
  grade: DataGrade;
  latencyMs: number;
}

export interface ReplayResult {
  recordId: string;
  originalHash: string;
  replayHash: string;
  match: boolean;
  latencyDiffMs: number;
  regression: boolean;
}

export interface QueryFilter {
  tag?: string;
  tenantId?: string;
  from?: number;
  to?: number;
}

export interface ReplayerOptions {
  ttlMs: number; // 0 = no expiry
  latencyRegressionMs: number;
}

export type AuditAction =
  | 'RECORD'
  | 'BLOCKED'
  | 'REPLAY'
  | 'REGRESSION'
  | 'EVICT'
  | 'QUERY'
  | 'MASK_LEAK';

export interface AuditEvent {
  action: AuditAction;
  detail?: string;
  at: number;
}

export type Executor = (
  record: AICallRecord,
) => Promise<{ response: string; latencyMs: number }>;

const DEFAULT_OPTS: ReplayerOptions = {
  ttlMs: 24 * 60 * 60 * 1000,
  latencyRegressionMs: 200,
};

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /\b0\d{1,2}-?\d{3,4}-?\d{4}\b/g;
const RRN_RE = /\b\d{6}-\d{7}\b/g;

export class AITelemetryReplayer {
  private readonly records = new Map<string, AICallRecord>();
  private readonly audit: AuditEvent[] = [];
  private readonly opts: ReplayerOptions;
  private nowFn: () => number = Date.now;

  constructor(opts: Partial<ReplayerOptions> = {}) {
    this.opts = { ...DEFAULT_OPTS, ...opts };
  }

  setClock(now: () => number): void {
    this.nowFn = now;
  }

  record(input: RecordInput): AICallRecord {
    if (input.grade === 'C' || input.grade === 'S') {
      this.logEvent({
        action: 'BLOCKED',
        detail: `${input.id}/${input.grade}`,
        at: this.nowFn(),
      });
      throw new Error('RECORD_GRADE_BLOCKED');
    }
    if (!input.id || !input.tenantId || !input.model) {
      throw new Error('RECORD_INVALID');
    }

    const maskedPrompt = this.mask(input.prompt, input.id);
    const maskedResponse = this.mask(input.response, input.id);

    const record: AICallRecord = {
      id: input.id,
      at: input.at ?? this.nowFn(),
      tenantId: input.tenantId,
      model: input.model,
      prompt: maskedPrompt,
      response: maskedResponse,
      tags: [...input.tags],
      grade: input.grade,
      latencyMs: input.latencyMs,
    };
    this.records.set(input.id, record);
    this.logEvent({
      action: 'RECORD',
      detail: `${input.id}/${input.model}/${input.tenantId}`,
      at: this.nowFn(),
    });
    return record;
  }

  get(id: string): AICallRecord | undefined {
    const r = this.records.get(id);
    if (!r) return undefined;
    return { ...r, tags: [...r.tags] };
  }

  query(filter: QueryFilter = {}): AICallRecord[] {
    const out: AICallRecord[] = [];
    this.records.forEach((r) => {
      if (filter.tenantId && r.tenantId !== filter.tenantId) return;
      if (filter.tag && !r.tags.includes(filter.tag)) return;
      if (filter.from !== undefined && r.at < filter.from) return;
      if (filter.to !== undefined && r.at > filter.to) return;
      out.push({ ...r, tags: [...r.tags] });
    });
    this.logEvent({
      action: 'QUERY',
      detail: `count=${out.length}`,
      at: this.nowFn(),
    });
    return out;
  }

  async replay(id: string, executor: Executor): Promise<ReplayResult> {
    const record = this.records.get(id);
    if (!record) {
      throw new Error('REPLAY_RECORD_NOT_FOUND');
    }
    const replay = await executor({ ...record, tags: [...record.tags] });
    const originalHash = this.hash(record.response);
    const replayHash = this.hash(this.mask(replay.response, id));
    const latencyDiffMs = replay.latencyMs - record.latencyMs;
    const match = originalHash === replayHash;
    const regression =
      !match || latencyDiffMs > this.opts.latencyRegressionMs;

    this.logEvent({
      action: 'REPLAY',
      detail: `${id}/match=${match}/diff=${latencyDiffMs}`,
      at: this.nowFn(),
    });
    if (regression) {
      this.logEvent({
        action: 'REGRESSION',
        detail: `${id}/match=${match}/diff=${latencyDiffMs}`,
        at: this.nowFn(),
      });
    }

    return {
      recordId: id,
      originalHash,
      replayHash,
      match,
      latencyDiffMs,
      regression,
    };
  }

  evict(): number {
    if (this.opts.ttlMs <= 0) return 0;
    const now = this.nowFn();
    let removed = 0;
    this.records.forEach((r, id) => {
      if (now - r.at > this.opts.ttlMs) {
        this.records.delete(id);
        removed += 1;
      }
    });
    if (removed > 0) {
      this.logEvent({
        action: 'EVICT',
        detail: `count=${removed}`,
        at: now,
      });
    }
    return removed;
  }

  size(): number {
    return this.records.size;
  }

  getAuditLog(): AuditEvent[] {
    return this.audit.map((e) => ({ ...e }));
  }

  // ── 내부 ─────────────────────────────────────────────────────────────────
  private mask(text: string, recordId: string): string {
    let out = text;
    let changed = false;

    if (EMAIL_RE.test(out)) {
      changed = true;
      out = out.replace(EMAIL_RE, '***@***');
    }
    if (PHONE_RE.test(out)) {
      changed = true;
      out = out.replace(PHONE_RE, '***-****-****');
    }
    if (RRN_RE.test(out)) {
      changed = true;
      out = out.replace(RRN_RE, '******-*******');
    }

    // 재확인 — 여전히 패턴이 남아 있으면 MASK_LEAK
    EMAIL_RE.lastIndex = 0;
    PHONE_RE.lastIndex = 0;
    RRN_RE.lastIndex = 0;
    if (
      EMAIL_RE.test(out) ||
      PHONE_RE.test(out) ||
      RRN_RE.test(out)
    ) {
      this.logEvent({
        action: 'MASK_LEAK',
        detail: recordId,
        at: this.nowFn(),
      });
      out = out
        .replace(EMAIL_RE, '***@***')
        .replace(PHONE_RE, '***-****-****')
        .replace(RRN_RE, '******-*******');
    }
    // reset regex state
    EMAIL_RE.lastIndex = 0;
    PHONE_RE.lastIndex = 0;
    RRN_RE.lastIndex = 0;

    if (changed) {
      // masking happened — no-op marker
    }
    return out;
  }

  private hash(text: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  private logEvent(ev: AuditEvent): void {
    this.audit.push(ev);
  }
}
