// Design Ref: §SVC-AI-ADV-R477 — AI기반 공공기관 문서 자동 요약 v2
// Plan SC: FR-R477.1~5

export type DocGrade = 'O' | 'C' | 'S';

export interface Document {
  readonly docId: string;
  readonly content: string;
  readonly grade: DocGrade;
  readonly category: string;
}

export interface Summary {
  readonly docId: string;
  readonly summary: string;
  readonly keywords: readonly string[];
  readonly wordCount: number;
}

const STOPWORDS = new Set([
  '은', '는', '이', '가', '을', '를', '의', '에', '와', '과', '도',
  '로', '으로', '한', '하다', '있다', '없다', '그', '이것', '저것',
]);

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class PublicDocumentSummarizerV2 {
  private readonly auditLog: AuditEvent[] = [];

  private extractSummary(content: string): string {
    const sentences = content.split(/\.\s+/);
    return (sentences[0] ?? content).trim();
  }

  private extractKeywords(content: string): readonly string[] {
    const words = content
      .split(/[\s,\.!?;:()]+/)
      .map(w => w.trim())
      .filter(w => w.length >= 2 && !STOPWORDS.has(w));

    const freq = new Map<string, number>();
    for (const word of words) {
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }

    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  summarize(documents: readonly Document[]): readonly Summary[] {
    const summaries: Summary[] = [];

    for (const doc of documents) {
      if (doc.grade === 'C' || doc.grade === 'S') {
        this.auditLog.push({
          timestamp: new Date().toISOString(),
          action: 'document.summarize.blocked',
          details: { docId: doc.docId, grade: doc.grade },
        });
        throw new Error(`BLOCKED: ${doc.grade}등급 문서 처리 금지 (N2SF N-05)`);
      }

      const summary = this.extractSummary(doc.content);
      const keywords = this.extractKeywords(doc.content);
      const wordCount = doc.content.split(/\s+/).filter(w => w.length > 0).length;
      summaries.push({ docId: doc.docId, summary, keywords, wordCount });
    }

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'document.summarize',
      details: { documentCount: documents.length },
    });

    return summaries;
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
