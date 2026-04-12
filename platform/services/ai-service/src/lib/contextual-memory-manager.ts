// Contextual Memory Manager — FR-R74.1~R74.5
// Design Ref: SVC-AI-ADV-R74 DESIGN §모듈
// Plan SC: 조회 p95 < 5ms, 등급 분리 100%
// CSAP: D-08 접근 분리, D-06 감사
// N2SF: N-05 등급

export type DataGrade = 'C' | 'S' | 'O';

export interface MemoryKey {
  agentId: string;
  userId: string;
  tenantId: string;
}

export interface MemoryEntry {
  id: string;
  key: MemoryKey;
  slot: string;
  content: string;
  priority: number;
  ttlMs: number;
  createdAt: number;
  expiresAt: number;
  grade: DataGrade;
  accessCount: number;
  lastAccessedAt: number;
}

export interface PutOptions {
  slot?: string;
  priority?: number;
  ttlMs?: number;
  grade?: DataGrade;
}

export interface QueryOptions {
  slot?: string;
  limit?: number;
  includeExpired?: boolean;
}

export interface MemorySummary {
  key: MemoryKey;
  summaryText: string;
  sourceIds: string[];
  createdAt: number;
}

export interface MemoryStats {
  total: number;
  perSlot: Record<string, number>;
  perGrade: Record<DataGrade, number>;
}

export interface AuditEvent {
  event: 'PUT' | 'GET' | 'EVICT' | 'SUMMARIZE' | 'SWEEP' | 'GRADE_BLOCK';
  detail?: string;
  at: number;
}

export interface ManagerOptions {
  perSlotMax?: number;
  perKeyMax?: number;
  maxTotal?: number;
  defaultTtlMs?: number;
  defaultSlot?: string;
  defaultPriority?: number;
}

const DEFAULTS: Required<ManagerOptions> = {
  perSlotMax: 50,
  perKeyMax: 200,
  maxTotal: 10_000,
  defaultTtlMs: 7 * 24 * 3600 * 1000,
  defaultSlot: 'short-term',
  defaultPriority: 5,
};

export class ContextualMemoryManager {
  private readonly entries = new Map<string, MemoryEntry>();
  private readonly audit: AuditEvent[] = [];
  private readonly opts: Required<ManagerOptions>;
  private seq = 0;

  constructor(options: ManagerOptions = {}) {
    this.opts = { ...DEFAULTS, ...options };
  }

  // ── put ──────────────────────────────────────────────────────────────────
  put(key: MemoryKey, content: string, options: PutOptions = {}): MemoryEntry {
    this.validateKey(key);
    const grade = options.grade ?? 'O';
    if (grade === 'C' || grade === 'S') {
      this.audit.push({
        event: 'GRADE_BLOCK',
        detail: `grade=${grade}`,
        at: Date.now(),
      });
      throw new Error('MEMORY_GRADE_BLOCKED');
    }

    const now = Date.now();
    const ttlMs = options.ttlMs ?? this.opts.defaultTtlMs;
    const slot = options.slot ?? this.opts.defaultSlot;
    const priority = options.priority ?? this.opts.defaultPriority;
    if (priority < 1 || priority > 10) {
      throw new Error('MEMORY_PRIORITY_OUT_OF_RANGE');
    }

    const entry: MemoryEntry = {
      id: this.nextId(),
      key: { ...key },
      slot,
      content,
      priority,
      ttlMs,
      createdAt: now,
      expiresAt: now + ttlMs,
      grade,
      accessCount: 0,
      lastAccessedAt: now,
    };
    this.entries.set(entry.id, entry);
    this.audit.push({
      event: 'PUT',
      detail: `${slot}/${this.keyString(key)}`,
      at: now,
    });

    this.enforcePerSlot(key, slot);
    this.enforcePerKey(key);
    this.enforceTotal();
    return entry;
  }

  // ── get ──────────────────────────────────────────────────────────────────
  get(key: MemoryKey, options: QueryOptions = {}): MemoryEntry[] {
    const now = Date.now();
    const limit = options.limit ?? 20;
    const keyStr = this.keyString(key);
    const matched: MemoryEntry[] = [];
    for (const e of this.entries.values()) {
      if (this.keyString(e.key) !== keyStr) continue;
      if (options.slot && e.slot !== options.slot) continue;
      if (!options.includeExpired && e.expiresAt < now) continue;
      matched.push(e);
    }
    matched.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.lastAccessedAt - a.lastAccessedAt;
    });
    const sliced = matched.slice(0, limit);
    for (const e of sliced) {
      e.accessCount += 1;
      e.lastAccessedAt = now;
    }
    this.audit.push({
      event: 'GET',
      detail: `${keyStr}/${sliced.length}`,
      at: now,
    });
    return sliced.map((e) => ({ ...e, key: { ...e.key } }));
  }

  // ── summarize ─────────────────────────────────────────────────────────────
  summarize(key: MemoryKey, topK = 5): MemorySummary {
    const entries = this.get(key, { limit: topK });
    const summaryText = entries
      .map((e) => `[${e.slot}] ${e.content}`)
      .join('\n');
    const summary: MemorySummary = {
      key: { ...key },
      summaryText,
      sourceIds: entries.map((e) => e.id),
      createdAt: Date.now(),
    };
    // 요약 자체를 메모리에 저장 (등급 O)
    if (summaryText) {
      this.put(key, summaryText, {
        slot: 'summary',
        priority: 8,
        grade: 'O',
      });
    }
    this.audit.push({
      event: 'SUMMARIZE',
      detail: `${this.keyString(key)}/${entries.length}`,
      at: summary.createdAt,
    });
    return summary;
  }

  // ── sweep ────────────────────────────────────────────────────────────────
  sweep(now: number): number {
    let removed = 0;
    for (const [id, e] of this.entries) {
      if (e.expiresAt < now) {
        this.entries.delete(id);
        removed += 1;
      }
    }
    if (removed > 0) {
      this.audit.push({
        event: 'SWEEP',
        detail: `removed=${removed}`,
        at: now,
      });
    }
    return removed;
  }

  // ── stats ────────────────────────────────────────────────────────────────
  stats(): MemoryStats {
    const perSlot: Record<string, number> = {};
    const perGrade: Record<DataGrade, number> = { C: 0, S: 0, O: 0 };
    for (const e of this.entries.values()) {
      perSlot[e.slot] = (perSlot[e.slot] ?? 0) + 1;
      perGrade[e.grade] += 1;
    }
    return { total: this.entries.size, perSlot, perGrade };
  }

  getAuditLog(): AuditEvent[] {
    return this.audit.map((e) => ({ ...e }));
  }

  // ── 내부 ─────────────────────────────────────────────────────────────────
  private enforcePerSlot(key: MemoryKey, slot: string): void {
    const keyStr = this.keyString(key);
    const list = Array.from(this.entries.values()).filter(
      (e) => this.keyString(e.key) === keyStr && e.slot === slot,
    );
    if (list.length <= this.opts.perSlotMax) return;
    list.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.lastAccessedAt - b.lastAccessedAt;
    });
    const toEvict = list.length - this.opts.perSlotMax;
    for (let i = 0; i < toEvict; i += 1) {
      const victim = list[i];
      if (victim) {
        this.entries.delete(victim.id);
        this.audit.push({
          event: 'EVICT',
          detail: `slot/${victim.id}`,
          at: Date.now(),
        });
      }
    }
  }

  private enforcePerKey(key: MemoryKey): void {
    const keyStr = this.keyString(key);
    const list = Array.from(this.entries.values()).filter(
      (e) => this.keyString(e.key) === keyStr,
    );
    if (list.length <= this.opts.perKeyMax) return;
    list.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.lastAccessedAt - b.lastAccessedAt;
    });
    const toEvict = list.length - this.opts.perKeyMax;
    for (let i = 0; i < toEvict; i += 1) {
      const victim = list[i];
      if (victim) {
        this.entries.delete(victim.id);
        this.audit.push({
          event: 'EVICT',
          detail: `key/${victim.id}`,
          at: Date.now(),
        });
      }
    }
  }

  private enforceTotal(): void {
    if (this.entries.size <= this.opts.maxTotal) return;
    const list = Array.from(this.entries.values()).sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.lastAccessedAt - b.lastAccessedAt;
    });
    const toEvict = this.entries.size - this.opts.maxTotal;
    for (let i = 0; i < toEvict; i += 1) {
      const victim = list[i];
      if (victim) {
        this.entries.delete(victim.id);
        this.audit.push({
          event: 'EVICT',
          detail: `total/${victim.id}`,
          at: Date.now(),
        });
      }
    }
  }

  private validateKey(key: MemoryKey): void {
    if (!key.agentId || !key.userId || !key.tenantId) {
      throw new Error('MEMORY_KEY_INVALID');
    }
  }

  private keyString(key: MemoryKey): string {
    return `${key.tenantId}|${key.userId}|${key.agentId}`;
  }

  private nextId(): string {
    this.seq += 1;
    return `mem-${Date.now().toString(36)}-${this.seq}`;
  }
}
