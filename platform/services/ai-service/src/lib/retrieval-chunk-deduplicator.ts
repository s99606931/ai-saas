// Retrieval Chunk Deduplicator — FR-R77.1~R77.5
// Design Ref: SVC-AI-ADV-R77 DESIGN §모듈
// Plan SC: 토큰 -20%, dedup p95 < 20ms
// CSAP: D-06 감사 / N2SF: N-05 등급

export type DataGrade = 'C' | 'S' | 'O';

export interface RetrievalChunk {
  id: string;
  text: string;
  source: string;
  score: number;
  grade: DataGrade;
}

export interface DedupOptions {
  semanticThreshold: number; // 0~1
  normalize: boolean;
}

export interface DedupRemoved {
  id: string;
  reason: 'exact' | 'semantic' | 'grade_blocked';
  duplicateOf?: string;
}

export interface DedupStats {
  input: number;
  exactDup: number;
  semanticDup: number;
  gradeBlocked: number;
  kept: number;
}

export interface DedupResult {
  kept: RetrievalChunk[];
  removed: DedupRemoved[];
  stats: DedupStats;
}

export type AuditAction =
  | 'DEDUP_EXACT'
  | 'DEDUP_SEMANTIC'
  | 'BLOCKED'
  | 'STATS';

export interface AuditEvent {
  action: AuditAction;
  detail?: string;
  at: number;
}

const DEFAULT_OPTS: DedupOptions = {
  semanticThreshold: 0.85,
  normalize: true,
};

export class RetrievalChunkDeduplicator {
  private readonly audit: AuditEvent[] = [];

  dedup(
    chunks: RetrievalChunk[],
    options: Partial<DedupOptions> = {},
  ): DedupResult {
    const opts: DedupOptions = { ...DEFAULT_OPTS, ...options };
    if (opts.semanticThreshold < 0 || opts.semanticThreshold > 1) {
      throw new Error('DEDUP_THRESHOLD_INVALID');
    }

    const removed: DedupRemoved[] = [];
    const stats: DedupStats = {
      input: chunks.length,
      exactDup: 0,
      semanticDup: 0,
      gradeBlocked: 0,
      kept: 0,
    };

    // 1) 등급 차단
    const allowed: RetrievalChunk[] = [];
    for (const c of chunks) {
      if (c.grade === 'C' || c.grade === 'S') {
        stats.gradeBlocked += 1;
        removed.push({ id: c.id, reason: 'grade_blocked' });
        this.record({
          action: 'BLOCKED',
          detail: `${c.id}/${c.grade}`,
          at: Date.now(),
        });
        continue;
      }
      allowed.push(c);
    }

    // 2) score 내림차순으로 정렬 (대표 청크는 score 높은 것 우선)
    const sorted = [...allowed].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.text.length - b.text.length;
    });

    // 3) 해시 기반 exact dedup
    const hashMap = new Map<number, RetrievalChunk>();
    const afterExact: RetrievalChunk[] = [];
    for (const c of sorted) {
      const norm = this.normalize(c.text, opts.normalize);
      const h = this.fnv1a(norm);
      const prev = hashMap.get(h);
      if (prev) {
        stats.exactDup += 1;
        removed.push({ id: c.id, reason: 'exact', duplicateOf: prev.id });
        this.record({
          action: 'DEDUP_EXACT',
          detail: `${c.id}->${prev.id}`,
          at: Date.now(),
        });
        continue;
      }
      hashMap.set(h, c);
      afterExact.push(c);
    }

    // 4) 의미 유사도 dedup (O(n^2) — 작은 set 가정)
    const kept: RetrievalChunk[] = [];
    const keptTokens: Array<Set<string>> = [];
    for (const c of afterExact) {
      const tokens = new Set(
        this.tokenize(this.normalize(c.text, opts.normalize)),
      );
      let dupOf: string | undefined;
      for (let i = 0; i < kept.length; i += 1) {
        const existing = kept[i];
        const existingTokens = keptTokens[i];
        if (!existing || !existingTokens) continue;
        const sim = this.jaccard(tokens, existingTokens);
        if (sim >= opts.semanticThreshold) {
          dupOf = existing.id;
          break;
        }
      }
      if (dupOf !== undefined) {
        stats.semanticDup += 1;
        removed.push({ id: c.id, reason: 'semantic', duplicateOf: dupOf });
        this.record({
          action: 'DEDUP_SEMANTIC',
          detail: `${c.id}->${dupOf}`,
          at: Date.now(),
        });
        continue;
      }
      kept.push(c);
      keptTokens.push(tokens);
    }

    stats.kept = kept.length;
    this.record({
      action: 'STATS',
      detail: `in=${stats.input}/ex=${stats.exactDup}/sem=${stats.semanticDup}/blk=${stats.gradeBlocked}/keep=${stats.kept}`,
      at: Date.now(),
    });

    return { kept, removed, stats };
  }

  getAuditLog(): AuditEvent[] {
    return this.audit.map((e) => ({ ...e }));
  }

  // ── 내부 ─────────────────────────────────────────────────────────────────
  private normalize(text: string, enabled: boolean): string {
    if (!enabled) return text;
    return text
      .toLowerCase()
      .replace(/[.,;:!?"'()\[\]{}]/g, ' ')
      .replace(/[\s\u00a0]+/g, ' ')
      .trim();
  }

  private tokenize(text: string): string[] {
    return text
      .split(/[^a-z0-9가-힣]+/)
      .filter((t) => t.length >= 2);
  }

  private jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 0;
    let inter = 0;
    a.forEach((v) => {
      if (b.has(v)) inter += 1;
    });
    const union = a.size + b.size - inter;
    if (union === 0) return 0;
    return inter / union;
  }

  private fnv1a(text: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
    }
    return hash >>> 0;
  }

  private record(ev: AuditEvent): void {
    this.audit.push(ev);
  }
}
