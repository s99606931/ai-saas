// Design Ref: §정부 지식 관리 AI — 문서 분류·유사도·퇴임 지식 보존 (R600 이정표)
// Plan SC: FR-R600.1~6
// Milestone: 600 라운드 달성 — 지식 관리 자동화 코어

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type DocCategory =
  | 'policy'
  | 'procedure'
  | 'report'
  | 'memo'
  | 'regulation'
  | 'manual'
  | 'minutes';

export interface KnowledgeDoc {
  docId: string;
  title: string;
  body: string;
  author: string;
  department: string;
  createdAt: string; // ISO
  tags: string[];
  category: DocCategory;
  accessCount: number;
}

export interface SearchResult {
  docId: string;
  title: string;
  score: number;
  category: DocCategory;
}

export interface DepartmentReport {
  department: string;
  totalDocs: number;
  byCategory: Record<DocCategory, number>;
  staleDocs: number; // 2년 이상 미접근
  topTags: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class GovKnowledgeManagementAI {
  /** R600 이정표 표식 */
  public readonly milestoneRound = 600;

  private readonly audit: AuditEntry[] = [];
  private readonly docs = new Map<string, KnowledgeDoc>();

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  addDoc(doc: KnowledgeDoc, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (!doc.docId) throw new Error('docId 필수');
    if (doc.accessCount < 0) throw new Error('accessCount 음수 불가');
    this.docs.set(doc.docId, doc);
    this.log('ADD_DOC', { docId: doc.docId, department: doc.department });
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[\s,\.;:!\?\(\)\[\]"'—-]+/)
      .filter((t) => t.length >= 2);
  }

  private similarity(q: string[], d: string[]): number {
    if (q.length === 0 || d.length === 0) return 0;
    const setD = new Set(d);
    let hits = 0;
    for (const t of q) if (setD.has(t)) hits++;
    return hits / q.length;
  }

  search(query: string, limit = 10, grade: DataGrade = 'O'): SearchResult[] {
    blockClassifiedData(grade);
    if (limit <= 0) throw new Error('limit 양수');
    const qTokens = this.tokenize(query);
    const results: SearchResult[] = [];
    for (const doc of this.docs.values()) {
      const dTokens = this.tokenize(`${doc.title} ${doc.body} ${doc.tags.join(' ')}`);
      const baseScore = this.similarity(qTokens, dTokens);
      // 접근 인기도 보정
      const popularity = Math.min(0.2, doc.accessCount / 1000);
      const score = baseScore + popularity;
      if (score > 0) {
        results.push({ docId: doc.docId, title: doc.title, score, category: doc.category });
      }
    }
    results.sort((a, b) => b.score - a.score);
    const top = results.slice(0, limit);
    this.log('SEARCH', { query, hits: top.length });
    return top;
  }

  reportByDepartment(department: string, currentDate: string, grade: DataGrade = 'O'): DepartmentReport {
    blockClassifiedData(grade);
    const departmentDocs = [...this.docs.values()].filter((d) => d.department === department);
    const byCategory: Record<DocCategory, number> = {
      policy: 0, procedure: 0, report: 0, memo: 0, regulation: 0, manual: 0, minutes: 0,
    };
    const tagCount = new Map<string, number>();
    const now = new Date(currentDate).getTime();
    let stale = 0;
    const STALE_MS = 2 * 365 * 24 * 3600 * 1000;
    for (const d of departmentDocs) {
      byCategory[d.category]++;
      for (const t of d.tags) {
        tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
      }
      const created = new Date(d.createdAt).getTime();
      if (now - created > STALE_MS && d.accessCount === 0) stale++;
    }
    const topTags = [...tagCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);

    return {
      department,
      totalDocs: departmentDocs.length,
      byCategory,
      staleDocs: stale,
      topTags,
    };
  }

  preserveKnowledge(author: string, grade: DataGrade = 'O'): KnowledgeDoc[] {
    blockClassifiedData(grade);
    const authored = [...this.docs.values()].filter((d) => d.author === author);
    this.log('PRESERVE', { author, count: authored.length });
    return authored;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.audit];
  }
}
