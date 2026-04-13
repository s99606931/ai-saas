// Design Ref: §핵심 알고리즘 — 토큰화 + 동의어 확장 + 점수 기반 정렬
// Plan SC: FR-R266.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface CatalogItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
}

interface SearchResult {
  id: string;
  title: string;
  score: number;
  matchedTerms: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R266.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[\s,.\-_/]+/).filter(t => t.length >= 2);
}

export class ServiceCatalogSearchAI {
  private items = new Map<string, CatalogItem>();
  private synonyms = new Map<string, string[]>();
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R266.1
  registerItem(id: string, title: string, description: string, tags: string[]): void {
    this.items.set(id, { id, title, description, tags });
    this.log('REGISTER_ITEM', { id, title });
  }

  // Plan SC: FR-R266.2
  registerSynonym(word: string, synonymsList: string[]): void {
    this.synonyms.set(word.toLowerCase(), synonymsList.map(s => s.toLowerCase()));
    this.log('REGISTER_SYNONYM', { word, count: synonymsList.length });
  }

  private expandQuery(tokens: string[]): string[] {
    const expanded = new Set(tokens);
    for (const token of tokens) {
      const syns = this.synonyms.get(token);
      if (syns) syns.forEach(s => expanded.add(s));
    }
    return Array.from(expanded);
  }

  // Plan SC: FR-R266.3 + R266.4
  search(query: string, topN: number = 10, grade: DataGrade = DataGrade.O): SearchResult[] {
    guardDataGrade(grade);

    const queryTokens = tokenize(query);
    const expandedTokens = this.expandQuery(queryTokens);

    const results: SearchResult[] = [];

    for (const item of this.items.values()) {
      let score = 0;
      const matchedTerms: string[] = [];

      const titleTokens = new Set(tokenize(item.title));
      const descTokens = new Set(tokenize(item.description));
      const tagTokens = new Set(item.tags.map(t => t.toLowerCase()));

      for (const token of expandedTokens) {
        if (titleTokens.has(token)) { score += 3; matchedTerms.push(token); }
        else if (tagTokens.has(token)) { score += 2; matchedTerms.push(token); }
        else if (descTokens.has(token)) { score += 1; matchedTerms.push(token); }
      }

      if (score > 0) {
        results.push({ id: item.id, title: item.title, score, matchedTerms: [...new Set(matchedTerms)] });
      }
    }

    results.sort((a, b) => b.score - a.score);
    this.log('SEARCH', { query, resultCount: results.length });
    return results.slice(0, topN);
  }

  // Plan SC: FR-R266.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
