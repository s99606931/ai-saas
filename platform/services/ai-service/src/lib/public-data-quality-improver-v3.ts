// Design Ref: §SVC-AI-ADV-R512 — AI기반 공공기관 데이터 품질 자동 개선 v3
// Plan SC: FR-R512.1~5

export type DataGrade = 'O' | 'C' | 'S';
export type ErrorType = 'MISSING_FIELD' | 'FORMAT_ERROR' | 'DUPLICATE';

export interface DataRecord {
  readonly recordId: string;
  readonly fields: Readonly<Record<string, string>>;
  readonly grade: DataGrade;
}

export interface QualityIssue {
  readonly field: string;
  readonly errorType: ErrorType;
}

export interface QualityResult {
  readonly recordId: string;
  readonly issues: readonly QualityIssue[];
  readonly qualityScore: number;
}

const DATE_DOT_PATTERN = /^\d{4}\.\d{2}\.\d{2}$/;

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class PublicDataQualityImproverV3 {
  private readonly auditLog: AuditEvent[] = [];
  private readonly seenIds = new Set<string>();

  reset(): void {
    this.seenIds.clear();
  }

  improve(records: readonly DataRecord[]): readonly QualityResult[] {
    const results: QualityResult[] = [];

    for (const record of records) {
      if (record.grade === 'C' || record.grade === 'S') {
        this.auditLog.push({
          timestamp: new Date().toISOString(),
          action: 'quality.blocked',
          details: { recordId: record.recordId, grade: record.grade },
        });
        throw new Error(`BLOCKED: ${record.grade}등급 데이터 처리 금지 (N2SF N-05)`);
      }

      const issues: QualityIssue[] = [];
      const fieldEntries = Object.entries(record.fields);

      // Duplicate detection
      if (this.seenIds.has(record.recordId)) {
        issues.push({ field: 'recordId', errorType: 'DUPLICATE' });
      } else {
        this.seenIds.add(record.recordId);
      }

      for (const [fieldName, value] of fieldEntries) {
        if (value === '' || value == null) {
          issues.push({ field: fieldName, errorType: 'MISSING_FIELD' });
        } else if (DATE_DOT_PATTERN.test(value)) {
          issues.push({ field: fieldName, errorType: 'FORMAT_ERROR' });
        }
      }

      const errorFields = new Set(issues.filter(i => i.errorType !== 'DUPLICATE').map(i => i.field));
      const validCount = fieldEntries.filter(([name]) => !errorFields.has(name)).length;
      const qualityScore =
        fieldEntries.length === 0
          ? 100
          : Math.round((validCount / fieldEntries.length) * 1000) / 10;

      results.push({ recordId: record.recordId, issues, qualityScore });
    }

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'quality.improve',
      details: {
        recordCount: records.length,
        withIssues: results.filter(r => r.issues.length > 0).length,
      },
    });

    return results;
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
