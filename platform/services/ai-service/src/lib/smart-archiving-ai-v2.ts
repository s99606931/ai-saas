// Design Ref: SVC-AI-ADV-R652.design.md — AI기반 스마트 아카이빙 v2
// Plan SC: FR-R652.1~5

export type ArchiveStatus = 'ACTIVE' | 'REVIEW' | 'ARCHIVE' | 'DISPOSAL';

interface ArchiveRecord {
  recordId: string;
  createdAtMs: number;
  retentionYears: number;
  permanent?: boolean;
}
interface ArchiveEvaluation {
  recordId: string;
  ageYears: number;
  status: ArchiveStatus;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

const YEAR_MS = 365 * 86400 * 1000;

export class SmartArchivingAIV2 {
  private records = new Map<string, ArchiveRecord>();
  private evaluations = new Map<string, ArchiveEvaluation>();
  private auditLog: AuditEntry[] = [];

  register(record: ArchiveRecord, dataGrade?: string): ArchiveEvaluation {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    if (record.retentionYears < 0) throw new Error('INVALID_RETENTION');
    this.records.set(record.recordId, record);
    const nowMs = Date.now();
    const ageYears = Math.max(0, (nowMs - record.createdAtMs) / YEAR_MS);

    let status: ArchiveStatus;
    if (record.permanent) status = 'ARCHIVE';
    else if (ageYears >= record.retentionYears) status = 'DISPOSAL';
    else if (ageYears >= record.retentionYears * 0.8) status = 'REVIEW';
    else status = 'ACTIVE';

    const evalResult: ArchiveEvaluation = { recordId: record.recordId, ageYears, status };
    this.evaluations.set(record.recordId, evalResult);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_RECORD',
      details: { recordId: record.recordId, status, ageYears: Number(ageYears.toFixed(2)) },
    });
    return evalResult;
  }

  getDisposalCandidates(): ArchiveEvaluation[] {
    return Array.from(this.evaluations.values()).filter((e) => e.status === 'DISPOSAL');
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
