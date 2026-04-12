// Design Ref: §핵심 알고리즘 — 버전 이력 관리 + diff + 롤백
// Plan SC: FR-R241.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface DocumentRecord {
  id: string;
  title: string;
  currentVersion: number;
}

interface VersionRecord {
  docId: string;
  version: number;
  content: string;
  author: string;
  changeSummary: string;
  createdAt: string;
}

interface DiffResult {
  docId: string;
  fromVersion: number;
  toVersion: number;
  added: string[];
  removed: string[];
}

interface RollbackResult {
  docId: string;
  rolledBackTo: number;
  newVersion: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R241.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class DocumentVersionManagerAI {
  private documents = new Map<string, DocumentRecord>();
  private versions: VersionRecord[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R241.1
  createDocument(id: string, title: string, content: string, author: string, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);
    if (this.documents.has(id)) {
      throw new Error(`문서 이미 존재: ${id}`);
    }
    this.documents.set(id, { id, title, currentVersion: 1 });
    this.versions.push({
      docId: id,
      version: 1,
      content,
      author,
      changeSummary: '최초 생성',
      createdAt: new Date().toISOString(),
    });
    this.log('CREATE_DOCUMENT', { id, title, author, version: 1 });
  }

  createVersion(docId: string, content: string, author: string, changeSummary: string, grade: DataGrade = DataGrade.O): number {
    guardDataGrade(grade);
    const doc = this.documents.get(docId);
    if (!doc) throw new Error(`문서 미등록: ${docId}`);

    doc.currentVersion += 1;
    const newVersion = doc.currentVersion;
    this.versions.push({
      docId,
      version: newVersion,
      content,
      author,
      changeSummary,
      createdAt: new Date().toISOString(),
    });
    this.log('CREATE_VERSION', { docId, version: newVersion, author });
    return newVersion;
  }

  // Plan SC: FR-R241.2
  getDiff(docId: string, fromVersion: number, toVersion: number): DiffResult {
    const from = this.versions.find(v => v.docId === docId && v.version === fromVersion);
    const to = this.versions.find(v => v.docId === docId && v.version === toVersion);

    if (!from || !to) {
      throw new Error(`버전 미존재: ${docId} v${fromVersion} or v${toVersion}`);
    }

    const fromLines = new Set(from.content.split('\n'));
    const toLines = new Set(to.content.split('\n'));

    const added = [...toLines].filter(l => !fromLines.has(l) && l.trim() !== '');
    const removed = [...fromLines].filter(l => !toLines.has(l) && l.trim() !== '');

    this.log('GET_DIFF', { docId, fromVersion, toVersion });
    return { docId, fromVersion, toVersion, added, removed };
  }

  // Plan SC: FR-R241.3
  rollback(docId: string, targetVersion: number, grade: DataGrade = DataGrade.O): RollbackResult {
    guardDataGrade(grade);
    const doc = this.documents.get(docId);
    if (!doc) throw new Error(`문서 미등록: ${docId}`);

    const target = this.versions.find(v => v.docId === docId && v.version === targetVersion);
    if (!target) throw new Error(`버전 미존재: ${docId} v${targetVersion}`);

    const newVersion = this.createVersion(docId, target.content, 'system', `v${targetVersion} 롤백`, grade);
    this.log('ROLLBACK', { docId, targetVersion, newVersion });
    return { docId, rolledBackTo: targetVersion, newVersion };
  }

  // Plan SC: FR-R241.4
  getHistory(docId: string): VersionRecord[] {
    return this.versions
      .filter(v => v.docId === docId)
      .sort((a, b) => b.version - a.version);
  }

  // Plan SC: FR-R241.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
