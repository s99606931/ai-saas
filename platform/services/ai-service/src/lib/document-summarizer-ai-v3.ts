// Design Ref: SVC-AI-ADV-R640.design.md §설계결정
// Plan SC: FR-R640.1~5
// 트랙 B 23차

interface DocumentRecord { docId: string; title: string; body: string; summary: string }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class DocumentSummarizerAiV3 {
  private documents = new Map<string, DocumentRecord>();
  private auditLog: AuditEntry[] = [];

  registerDocument(docId: string, title: string): void {
    this.documents.set(docId, { docId, title, body: '', summary: '' });
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_DOC',
      details: { docId, title },
    });
  }

  summarize(docId: string, body: string, maxSentences = 2, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
    }
    const doc = this.documents.get(docId);
    if (!doc) return;
    const sentences = body
      .split(/[.!?]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const summary = sentences.slice(0, maxSentences).join('. ');
    doc.body = body;
    doc.summary = summary;
    this.documents.set(docId, doc);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'SUMMARIZE',
      details: { docId, bodyLen: body.length, summaryLen: summary.length },
    });
  }

  getCompressionRatio(docId: string): number {
    const doc = this.documents.get(docId);
    if (!doc || doc.body.length === 0) return 0;
    return doc.summary.length / doc.body.length;
  }

  getLongDocuments(lengthThreshold: number): DocumentRecord[] {
    return Array.from(this.documents.values()).filter(
      (d) => d.body.length > lengthThreshold,
    );
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
