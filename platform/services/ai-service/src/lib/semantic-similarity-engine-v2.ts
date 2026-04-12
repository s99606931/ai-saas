// SVC-AI-ADV-R362 Semantic Similarity Engine v2
// Design Ref: SVC-AI-ADV-R362.design.md
// Plan SC: SC-R362-1~4
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface Document {
  readonly id: string;
  readonly text: string;
  readonly vector: readonly number[];
}

export interface SimilarityHit {
  readonly id: string;
  readonly score: number;
  readonly cosine: number;
  readonly bm25: number;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class SemanticSimilarityEngineV2 {
  private readonly auditLog: AuditEntry[] = [];

  search(
    query: { text: string; vector: readonly number[] },
    corpus: readonly Document[],
    topK = 5,
    cosineWeight = 0.6,
    grade: DataGrade = 'O',
  ): readonly SimilarityHit[] {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 문서 검색 차단 (N2SF N-05)`);
    }
    if (cosineWeight < 0 || cosineWeight > 1) {
      throw new Error('INVALID_PARAMS: cosineWeight out of range');
    }
    if (topK <= 0) {
      throw new Error('INVALID_PARAMS: topK must be positive');
    }
    const bm25Weight = 1 - cosineWeight;
    const qTokens = this.tokenize(query.text);

    const hits: SimilarityHit[] = corpus.map((doc) => {
      const cos = this.cosine(query.vector, doc.vector);
      const bm25 = this.bm25Score(qTokens, this.tokenize(doc.text));
      const score = Number((cosineWeight * cos + bm25Weight * bm25).toFixed(4));
      return { id: doc.id, score, cosine: Number(cos.toFixed(4)), bm25: Number(bm25.toFixed(4)) };
    });

    hits.sort((a, b) => b.score - a.score);
    const top = hits.slice(0, topK);

    this.record('SEARCH', 'corpus', { corpusSize: corpus.length, returned: top.length });

    return top;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private cosine(a: readonly number[], b: readonly number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i += 1) {
      const av = a[i] ?? 0;
      const bv = b[i] ?? 0;
      dot += av * bv;
      na += av * av;
      nb += bv * bv;
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom === 0 ? 0 : dot / denom;
  }

  private bm25Score(qTokens: readonly string[], dTokens: readonly string[]): number {
    if (qTokens.length === 0 || dTokens.length === 0) return 0;
    const set = new Set(dTokens);
    let matches = 0;
    for (const q of qTokens) if (set.has(q)) matches += 1;
    return matches / qTokens.length;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);
  }

  private record(action: string, target: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      target,
      details,
    });
  }
}
