// SVC-AI-ADV-R354 Official Document Classifier
// Design Ref: SVC-AI-ADV-R354.design.md
// Plan SC: SC-R354-1~4
// CSAP: D-06 감사, N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface ClassifyResult {
  readonly category: string;
  readonly confidence: number;
  readonly matchedKeywords: readonly string[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class OfficialDocumentClassifier {
  private readonly dictionary = new Map<string, string[]>();
  private readonly auditLog: AuditEntry[] = [];

  registerCategory(category: string, keywords: readonly string[]): void {
    this.dictionary.set(category, [...keywords]);
    this.record('REGISTER_CATEGORY', category, { count: keywords.length });
  }

  classify(docId: string, title: string, body: string, grade: DataGrade = 'O'): ClassifyResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 문서 본문 분류기 사용 금지 (N2SF N-05)`);
    }
    const text = `${title}\n${body}`.toLowerCase();
    let bestCategory = 'unclassified';
    let bestScore = 0;
    let sum = 0;
    let bestMatched: string[] = [];

    for (const [category, keywords] of this.dictionary.entries()) {
      let score = 0;
      const matched: string[] = [];
      for (const keyword of keywords) {
        const needle = keyword.toLowerCase();
        let index = text.indexOf(needle);
        while (index !== -1) {
          score += 1;
          index = text.indexOf(needle, index + needle.length);
        }
        if (score > 0 && text.includes(needle)) {
          if (!matched.includes(keyword)) matched.push(keyword);
        }
      }
      sum += score;
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
        bestMatched = matched;
      }
    }

    const confidence = sum === 0 ? 0 : bestScore / sum;
    const result: ClassifyResult = {
      category: bestCategory,
      confidence: Number(confidence.toFixed(4)),
      matchedKeywords: bestMatched,
    };
    this.record('CLASSIFY', docId, { category: result.category, confidence: result.confidence });
    return result;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
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
