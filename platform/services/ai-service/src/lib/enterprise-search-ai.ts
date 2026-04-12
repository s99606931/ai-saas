// 엔터프라이즈 검색 AI — FR-N410.1~5
// N2SF: PII 마스킹 후 응답

export interface SearchDocument {
  id: string;
  title: string;
  body: string;
  tags: string[];
  acl: string[]; // 허용 역할/그룹 목록
  updatedAt: string;
}

export interface SearchResult {
  doc: SearchDocument;
  score: number;
  highlights: string[];
}

export interface SearchQuery {
  text: string;
  principalGroups: string[];
  topK: number;
}

const KOREAN_STOPWORDS = new Set(['그리고', '하지만', '그러나', '그런데', '이것', '저것', '그것']);

export class EnterpriseSearchAi {
  private readonly docs = new Map<string, SearchDocument>();
  private readonly termFreq = new Map<string, Map<string, number>>();
  private readonly docLength = new Map<string, number>();
  private avgDocLength = 0;

  index(doc: SearchDocument): void {
    if (doc.body.trim().length === 0) throw new Error('SEARCH_EMPTY_DOC');
    this.docs.set(doc.id, doc);
    const tokens = this.tokenize(`${doc.title} ${doc.body}`);
    const tf = new Map<string, number>();
    for (const tok of tokens) tf.set(tok, (tf.get(tok) ?? 0) + 1);
    this.termFreq.set(doc.id, tf);
    this.docLength.set(doc.id, tokens.length);
    this.recomputeAvg();
  }

  search(query: SearchQuery): SearchResult[] {
    const rewritten = this.rewriteQuery(query.text);
    const queryTokens = this.tokenize(rewritten);
    if (queryTokens.length === 0) return [];
    const scored: SearchResult[] = [];
    for (const [docId, doc] of this.docs) {
      if (!this.aclMatch(doc, query.principalGroups)) continue;
      const score = this.bm25(docId, queryTokens);
      if (score > 0) {
        scored.push({
          doc: this.maskDocPii(doc),
          score: Number(score.toFixed(3)),
          highlights: this.highlight(doc.body, queryTokens),
        });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, query.topK);
  }

  private rewriteQuery(text: string): string {
    const synonyms: Record<string, string> = {
      '민원인': '신청인 민원인',
      '공문': '공문 문서',
      '예산': '예산 회계',
    };
    let out = text;
    for (const [k, v] of Object.entries(synonyms)) {
      if (out.includes(k)) out = out.replace(k, v);
    }
    return out;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1 && !KOREAN_STOPWORDS.has(t));
  }

  private bm25(docId: string, queryTokens: string[]): number {
    const k1 = 1.5;
    const b = 0.75;
    const tf = this.termFreq.get(docId);
    const dl = this.docLength.get(docId) ?? 0;
    if (!tf || dl === 0) return 0;
    const N = this.docs.size;
    let score = 0;
    for (const qt of queryTokens) {
      const termFreq = tf.get(qt) ?? 0;
      if (termFreq === 0) continue;
      let df = 0;
      for (const [, map] of this.termFreq) {
        if (map.has(qt)) df += 1;
      }
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      const norm = termFreq * (k1 + 1);
      const denom = termFreq + k1 * (1 - b + b * (dl / (this.avgDocLength || 1)));
      score += idf * (norm / denom);
    }
    return score;
  }

  private aclMatch(doc: SearchDocument, principals: string[]): boolean {
    if (doc.acl.length === 0) return true;
    return doc.acl.some((r) => principals.includes(r));
  }

  private highlight(body: string, tokens: string[]): string[] {
    const lines = body.split('\n');
    const out: string[] = [];
    for (const line of lines) {
      if (tokens.some((t) => line.toLowerCase().includes(t))) {
        out.push(line.slice(0, 200));
        if (out.length >= 3) break;
      }
    }
    return out;
  }

  private maskDocPii(doc: SearchDocument): SearchDocument {
    const masked = doc.body
      .replace(/\d{6}-\d{7}/g, '******-*******')
      .replace(/\d{3}-\d{3,4}-\d{4}/g, '***-****-****')
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '***@***');
    return { ...doc, body: masked };
  }

  private recomputeAvg(): void {
    let total = 0;
    for (const len of this.docLength.values()) total += len;
    this.avgDocLength = this.docLength.size > 0 ? total / this.docLength.size : 0;
  }
}
