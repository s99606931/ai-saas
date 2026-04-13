// SVC-AI-ADV-R491 AI Records Management
// Design Ref: SVC-AI-ADV-R491.design.md §기록물관리
// Plan SC: FR-491.1~6
// CSAP D-06 / N2SF N-05 / 공공기록물법 시행령

export type DataGrade = 'O' | 'C' | 'S';

const DATA_GRADE_BLOCK = ['C', 'S'] as const;

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type RetentionClass = '1년' | '3년' | '5년' | '10년' | '30년' | '준영구' | '영구';

export interface RecordItem {
  readonly recordId: string;
  readonly title: string;
  readonly category: string;
  readonly producedAt: string;
  readonly pages: number;
  readonly hasPersonalInfo: boolean;
  readonly hasLegalEvidence: boolean;
  readonly referencesHistoricalEvent: boolean;
}

export interface ClassifiedRecord {
  readonly recordId: string;
  readonly retentionClass: RetentionClass;
  readonly disposalDueAt: string;
  readonly requiresEncryption: boolean;
  readonly requiresPermanentPreservation: boolean;
  readonly reasoning: readonly string[];
}

export interface DisposalPlan {
  readonly totalCount: number;
  readonly eligibleIds: readonly string[];
  readonly blockedIds: readonly string[];
  readonly scheduledYear: number;
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly detail: Record<string, unknown>;
}

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function addYears(iso: string, years: number): string {
  const base = Date.parse(iso);
  if (Number.isNaN(base)) return iso;
  return new Date(base + years * YEAR_MS).toISOString();
}

export class AiRecordsManagement {
  private readonly auditLog: AuditEntry[] = [];
  private readonly records: Map<string, ClassifiedRecord> = new Map();

  classify(item: RecordItem, grade: DataGrade = 'O'): ClassifiedRecord {
    blockClassifiedData(grade);

    const reasoning: string[] = [];
    let retentionYears = 1;
    let retentionClass: RetentionClass = '1년';
    let permanent = false;

    if (item.referencesHistoricalEvent) {
      retentionClass = '영구';
      retentionYears = 100;
      permanent = true;
      reasoning.push('historical_event_reference');
    } else if (item.hasLegalEvidence) {
      retentionClass = '30년';
      retentionYears = 30;
      reasoning.push('legal_evidence');
    } else if (item.category === '정책' || item.category === '감사') {
      retentionClass = '10년';
      retentionYears = 10;
      reasoning.push('policy_or_audit');
    } else if (item.category === '회계' || item.category === '계약') {
      retentionClass = '5년';
      retentionYears = 5;
      reasoning.push('fiscal');
    } else if (item.hasPersonalInfo) {
      retentionClass = '3년';
      retentionYears = 3;
      reasoning.push('personal_info');
    } else {
      reasoning.push('default_short_term');
    }

    const classified: ClassifiedRecord = {
      recordId: item.recordId,
      retentionClass,
      disposalDueAt: addYears(item.producedAt, retentionYears),
      requiresEncryption: item.hasPersonalInfo || item.hasLegalEvidence,
      requiresPermanentPreservation: permanent,
      reasoning,
    };

    this.records.set(item.recordId, classified);
    this.appendAudit('CLASSIFY', {
      recordId: item.recordId,
      retentionClass,
    });
    return classified;
  }

  planDisposal(currentYear: number): DisposalPlan {
    const eligibleIds: string[] = [];
    const blockedIds: string[] = [];
    for (const rec of this.records.values()) {
      if (rec.requiresPermanentPreservation) {
        blockedIds.push(rec.recordId);
        continue;
      }
      const due = Date.parse(rec.disposalDueAt);
      if (Number.isNaN(due)) continue;
      const dueYear = new Date(due).getUTCFullYear();
      if (dueYear <= currentYear) {
        eligibleIds.push(rec.recordId);
      } else {
        blockedIds.push(rec.recordId);
      }
    }
    const plan: DisposalPlan = {
      totalCount: this.records.size,
      eligibleIds,
      blockedIds,
      scheduledYear: currentYear,
    };
    this.appendAudit('PLAN_DISPOSAL', {
      total: plan.totalCount,
      eligible: eligibleIds.length,
    });
    return plan;
  }

  getRecord(recordId: string): ClassifiedRecord | undefined {
    return this.records.get(recordId);
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      detail,
    });
  }
}
