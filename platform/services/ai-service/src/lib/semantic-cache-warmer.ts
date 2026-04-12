// Semantic Cache Warmer — FR-R82.1~R82.5
// Design Ref: SVC-AI-ADV-R82 DESIGN §점수산정
// Plan SC: 히트율 ≥ 70%, 예산 초과 0건
// CSAP: D-06 감사 / N2SF: N-05 마스킹

export type DataGrade = 'C' | 'S' | 'O';

export interface HitInput {
  query: string;
  tenantId: string;
  at?: number;
  grade: DataGrade;
}

export interface InternalHit {
  key: string; // tenantId::maskedQuery
  query: string;
  tenantId: string;
  hits: number;
  lastSeen: number;
}

export interface WarmCandidate {
  query: string;
  tenantId: string;
  score: number;
  hits: number;
  lastSeen: number;
}

export type WarmExecutor = (
  query: string,
  tenantId: string,
) => Promise<{ costUnits: number; ok: boolean }>;

export interface WarmerOptions {
  maxCandidates: number;
  decayHalfLifeMs: number;
  budgetPerRun: number;
  minHitsToWarm: number;
}

export interface WarmRunResult {
  warmed: number;
  skipped: number;
  budgetUsed: number;
  budgetExceeded: boolean;
  candidates: WarmCandidate[];
}

export type AuditAction =
  | 'HIT'
  | 'GRADE_BLOCKED'
  | 'RANK'
  | 'WARM_OK'
  | 'WARM_FAIL'
  | 'BUDGET_EXCEEDED'
  | 'MASK_APPLIED';

export interface AuditEvent {
  action: AuditAction;
  detail?: string;
  at: number;
}

const DEFAULT_OPTS: WarmerOptions = {
  maxCandidates: 100,
  decayHalfLifeMs: 6 * 60 * 60 * 1000,
  budgetPerRun: 50,
  minHitsToWarm: 2,
};

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /\b0\d{1,2}-?\d{3,4}-?\d{4}\b/g;
const RRN_RE = /\b\d{6}-\d{7}\b/g;

function maskQuery(q: string): string {
  return q
    .replace(EMAIL_RE, '***@***')
    .replace(PHONE_RE, '***-****-****')
    .replace(RRN_RE, '******-*******');
}

export class SemanticCacheWarmer {
  private readonly opts: WarmerOptions;
  private readonly hits = new Map<string, InternalHit>();
  private readonly auditLog: AuditEvent[] = [];

  constructor(opts: Partial<WarmerOptions> = {}) {
    this.opts = { ...DEFAULT_OPTS, ...opts };
  }

  recordHit(input: HitInput): void {
    if (input.grade !== 'O') {
      this.audit('GRADE_BLOCKED', `grade=${input.grade}`);
      throw new Error('WARM_GRADE_BLOCKED');
    }

    const masked = maskQuery(input.query);
    if (masked !== input.query) {
      this.audit('MASK_APPLIED');
    }

    const key = `${input.tenantId}::${masked}`;
    const at = input.at ?? Date.now();
    const existing = this.hits.get(key);

    if (existing) {
      existing.hits += 1;
      existing.lastSeen = at;
    } else {
      if (this.hits.size >= this.opts.maxCandidates) {
        // LRU: 가장 오래된 항목 제거
        let oldestKey: string | undefined;
        let oldestTime = Infinity;
        for (const [k, v] of this.hits) {
          if (v.lastSeen < oldestTime) {
            oldestTime = v.lastSeen;
            oldestKey = k;
          }
        }
        if (oldestKey !== undefined) {
          this.hits.delete(oldestKey);
        }
      }
      this.hits.set(key, {
        key,
        query: masked,
        tenantId: input.tenantId,
        hits: 1,
        lastSeen: at,
      });
    }

    this.audit('HIT', key);
  }

  rank(now?: number): WarmCandidate[] {
    const ts = now ?? Date.now();
    const candidates: WarmCandidate[] = [];

    for (const hit of this.hits.values()) {
      if (hit.hits < this.opts.minHitsToWarm) {
        continue;
      }
      const dt = Math.max(0, ts - hit.lastSeen);
      const decay = Math.pow(0.5, dt / this.opts.decayHalfLifeMs);
      const score = hit.hits * decay;
      candidates.push({
        query: hit.query,
        tenantId: hit.tenantId,
        score,
        hits: hit.hits,
        lastSeen: hit.lastSeen,
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    this.audit('RANK', `count=${candidates.length}`);
    return candidates;
  }

  async warmup(executor: WarmExecutor): Promise<WarmRunResult> {
    const candidates = this.rank();
    let warmed = 0;
    let skipped = 0;
    let budgetUsed = 0;
    let budgetExceeded = false;

    for (const cand of candidates) {
      if (budgetUsed >= this.opts.budgetPerRun) {
        this.audit('BUDGET_EXCEEDED', `used=${budgetUsed}`);
        budgetExceeded = true;
        skipped = candidates.length - warmed;
        break;
      }

      try {
        const result = await executor(cand.query, cand.tenantId);
        budgetUsed += result.costUnits;
        if (result.ok) {
          warmed += 1;
          this.audit('WARM_OK', cand.query);
        } else {
          skipped += 1;
          this.audit('WARM_FAIL', cand.query);
        }
      } catch (err) {
        skipped += 1;
        this.audit('WARM_FAIL', `${cand.query}:${String(err)}`);
      }
    }

    return { warmed, skipped, budgetUsed, budgetExceeded, candidates };
  }

  size(): number {
    return this.hits.size;
  }

  reset(): void {
    this.hits.clear();
  }

  getAuditLog(): AuditEvent[] {
    return [...this.auditLog];
  }

  private audit(action: AuditAction, detail?: string): void {
    this.auditLog.push({ action, detail, at: Date.now() });
  }
}
