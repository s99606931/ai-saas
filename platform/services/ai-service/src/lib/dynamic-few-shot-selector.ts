// Dynamic Few-Shot Selector — FR-R75.1~R75.5
// Design Ref: SVC-AI-ADV-R75 DESIGN §모듈
// Plan SC: 정확도 +10%, 선택 p95 < 10ms
// CSAP: D-06 감사
// N2SF: N-05 등급

export type DataGrade = 'C' | 'S' | 'O';

export interface FewShotExample {
  id: string;
  category: string;
  input: string;
  output: string;
  tags: string[];
  grade: DataGrade;
  createdAt: number;
}

export interface SelectionOptions {
  topK: number;
  lambda: number;
  categoryFilter?: string;
}

export interface ScoredExample {
  example: FewShotExample;
  similarity: number;
  selected: boolean;
}

export interface DistributionReport {
  total: number;
  perCategory: Record<string, number>;
  biasWarning: boolean;
}

export interface AuditEvent {
  event: 'REGISTER' | 'SELECT' | 'BIAS_WARN' | 'GRADE_BLOCK';
  detail?: string;
  at: number;
}

export class DynamicFewShotSelector {
  private readonly pool = new Map<string, FewShotExample>();
  private readonly audit: AuditEvent[] = [];

  // ── 등록 ──────────────────────────────────────────────────────────────────
  register(example: FewShotExample): void {
    if (example.grade === 'C' || example.grade === 'S') {
      this.audit.push({
        event: 'GRADE_BLOCK',
        detail: `${example.id}/${example.grade}`,
        at: Date.now(),
      });
      throw new Error('FEW_SHOT_GRADE_BLOCKED');
    }
    if (!example.id || !example.input || !example.output) {
      throw new Error('FEW_SHOT_INVALID_EXAMPLE');
    }
    this.pool.set(example.id, { ...example, tags: [...example.tags] });
    this.audit.push({
      event: 'REGISTER',
      detail: `${example.id}/${example.category}`,
      at: Date.now(),
    });
  }

  registerMany(examples: FewShotExample[]): void {
    for (const e of examples) this.register(e);
  }

  size(): number {
    return this.pool.size;
  }

  // ── 선택 ──────────────────────────────────────────────────────────────────
  select(query: string, options: SelectionOptions): ScoredExample[] {
    if (options.topK <= 0) {
      throw new Error('FEW_SHOT_TOPK_INVALID');
    }
    if (options.lambda < 0 || options.lambda > 1) {
      throw new Error('FEW_SHOT_LAMBDA_INVALID');
    }

    const candidates = Array.from(this.pool.values()).filter((e) => {
      if (options.categoryFilter && e.category !== options.categoryFilter) return false;
      return true;
    });

    const queryTokens = this.tokenize(query);
    const queryVec = this.buildVector(queryTokens);

    const scored: ScoredExample[] = candidates.map((example) => {
      const exTokens = this.tokenize(example.input);
      const exVec = this.buildVector(exTokens);
      const jac = this.jaccard(new Set(queryTokens), new Set(exTokens));
      const cos = this.cosine(queryVec, exVec);
      return {
        example,
        similarity: 0.5 * jac + 0.5 * cos,
        selected: false,
      };
    });

    scored.sort((a, b) => b.similarity - a.similarity);

    // MMR 다양성
    const selected: ScoredExample[] = [];
    const available = [...scored];
    while (selected.length < options.topK && available.length > 0) {
      let bestIdx = 0;
      let bestScore = -Infinity;
      for (let i = 0; i < available.length; i += 1) {
        const cand = available[i];
        if (!cand) continue;
        const simQ = cand.similarity;
        let maxSimToSelected = 0;
        for (const s of selected) {
          const simS = this.pairSimilarity(cand.example, s.example);
          if (simS > maxSimToSelected) maxSimToSelected = simS;
        }
        const mmr =
          options.lambda * simQ - (1 - options.lambda) * maxSimToSelected;
        if (mmr > bestScore) {
          bestScore = mmr;
          bestIdx = i;
        }
      }
      const picked = available.splice(bestIdx, 1)[0];
      if (picked) {
        picked.selected = true;
        selected.push(picked);
      }
    }

    this.audit.push({
      event: 'SELECT',
      detail: `topK=${options.topK}/picked=${selected.length}`,
      at: Date.now(),
    });

    // 편향 감지
    const dist = this.distribution(selected.map((s) => s.example));
    if (dist.biasWarning) {
      this.audit.push({
        event: 'BIAS_WARN',
        detail: JSON.stringify(dist.perCategory),
        at: Date.now(),
      });
    }
    return selected;
  }

  // ── 분포 ──────────────────────────────────────────────────────────────────
  distribution(examples: FewShotExample[]): DistributionReport {
    const perCategory: Record<string, number> = {};
    for (const e of examples) {
      perCategory[e.category] = (perCategory[e.category] ?? 0) + 1;
    }
    const total = examples.length;
    let max = 0;
    for (const v of Object.values(perCategory)) {
      if (v > max) max = v;
    }
    const biasWarning = total > 0 && max / total > 0.6;
    return { total, perCategory, biasWarning };
  }

  getAuditLog(): AuditEvent[] {
    return this.audit.map((e) => ({ ...e }));
  }

  // ── 내부 ─────────────────────────────────────────────────────────────────
  private pairSimilarity(a: FewShotExample, b: FewShotExample): number {
    const ta = new Set(this.tokenize(a.input));
    const tb = new Set(this.tokenize(b.input));
    return this.jaccard(ta, tb);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-z0-9가-힣]+/)
      .filter((t) => t.length >= 2);
  }

  private buildVector(tokens: string[]): Map<string, number> {
    const m = new Map<string, number>();
    for (const t of tokens) {
      m.set(t, (m.get(t) ?? 0) + 1);
    }
    return m;
  }

  private jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 0;
    let inter = 0;
    for (const v of a) if (b.has(v)) inter += 1;
    const union = a.size + b.size - inter;
    if (union === 0) return 0;
    return inter / union;
  }

  private cosine(a: Map<string, number>, b: Map<string, number>): number {
    let dot = 0;
    for (const [k, va] of a) {
      const vb = b.get(k);
      if (vb !== undefined) dot += va * vb;
    }
    let na = 0;
    for (const v of a.values()) na += v * v;
    let nb = 0;
    for (const v of b.values()) nb += v * v;
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }
}
