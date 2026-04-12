// Design Ref: §핵심 알고리즘 — 토큰화 키워드 검색 + 요약
// Plan SC: FR-R280.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type SectionType = 'text' | 'table' | 'image';
type DocType = 'text' | 'table' | 'mixed';

interface DocumentSection {
  title: string;
  content: string;
  sectionType: SectionType;
  keywords: string[];
}

interface DocumentRecord {
  id: string;
  title: string;
  docType: DocType;
  sections: DocumentSection[];
}

interface SectionSearchResult {
  sectionTitle: string;
  sectionType: SectionType;
  score: number;
  snippet: string;
}

interface DocumentSummary {
  docId: string;
  docTitle: string;
  sections: Array<{ title: string; snippet: string }>;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R280.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[\s,.\-_/\[\]()]+/).filter(t => t.length >= 2);
}

export class MultimodalDocumentUnderstandingV2 {
  private documents = new Map<string, DocumentRecord>();
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R280.1
  registerDocument(id: string, title: string, docType: DocType): void {
    this.documents.set(id, { id, title, docType, sections: [] });
    this.log('REGISTER_DOCUMENT', { id, title, docType });
  }

  // Plan SC: FR-R280.2
  addSection(docId: string, title: string, content: string, sectionType: SectionType = 'text'): void {
    const doc = this.documents.get(docId);
    if (!doc) throw new Error(`문서 미등록: ${docId}`);
    const keywords = tokenize(content);
    doc.sections.push({ title, content, sectionType, keywords });
    this.log('ADD_SECTION', { docId, title, sectionType, keywordCount: keywords.length });
  }

  // Plan SC: FR-R280.3
  searchSections(docId: string, query: string, grade: DataGrade = DataGrade.O): SectionSearchResult[] {
    guardDataGrade(grade);
    const doc = this.documents.get(docId);
    if (!doc) throw new Error(`문서 미등록: ${docId}`);

    const queryTokens = tokenize(query);
    const results: SectionSearchResult[] = [];

    for (const section of doc.sections) {
      let score = 0;
      const titleTokens = tokenize(section.title);
      for (const token of queryTokens) {
        if (titleTokens.includes(token)) score += 2;
        else if (section.keywords.includes(token)) score += 1;
      }
      if (score > 0) {
        results.push({
          sectionTitle: section.title,
          sectionType: section.sectionType,
          score,
          snippet: section.content.slice(0, 80),
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    this.log('SEARCH_SECTIONS', { docId, query, resultCount: results.length });
    return results;
  }

  // Plan SC: FR-R280.4
  summarize(docId: string, topN: number = 3): DocumentSummary {
    const doc = this.documents.get(docId);
    if (!doc) throw new Error(`문서 미등록: ${docId}`);

    const sections = doc.sections.slice(0, topN).map(s => ({
      title: s.title,
      snippet: s.content.slice(0, 50),
    }));

    this.log('SUMMARIZE', { docId, topN, sectionCount: sections.length });
    return { docId, docTitle: doc.title, sections };
  }

  // Plan SC: FR-R280.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
