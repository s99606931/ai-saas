// SVC-AI-ADV-R352 Medical Data Anonymizer v2 (k-anonymity + l-diversity)
// Design Ref: SVC-AI-ADV-R352.design.md
// Plan SC: SC-R352-1~4
// CSAP: D-06 감사, D-12 개인정보보호, N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface AnonRecord {
  readonly [field: string]: string | number;
}

export interface KLResult {
  readonly compliant: boolean;
  readonly kViolations: readonly string[];
  readonly lViolations: readonly string[];
  readonly groupCount: number;
  readonly totalRecords: number;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class MedicalDataAnonymizerV2 {
  private readonly auditLog: AuditEntry[] = [];

  analyze(
    records: readonly AnonRecord[],
    k: number,
    l: number,
    quasiFields: readonly string[],
    sensitiveField: string,
    grade: DataGrade = 'O',
  ): KLResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 원본 의료 데이터 직접 분석 금지 (N2SF N-05)`);
    }
    if (k < 1 || l < 1) {
      throw new Error('INVALID_PARAMS: k,l은 1 이상이어야 함');
    }

    const groups = new Map<string, AnonRecord[]>();
    for (const record of records) {
      const key = quasiFields.map((f) => String(record[f] ?? 'null')).join('|');
      const bucket = groups.get(key) ?? [];
      bucket.push(record);
      groups.set(key, bucket);
    }

    const kViolations: string[] = [];
    const lViolations: string[] = [];

    for (const [key, group] of groups.entries()) {
      if (group.length < k) {
        kViolations.push(key);
      }
      const distinct = new Set<string>();
      for (const record of group) {
        distinct.add(String(record[sensitiveField] ?? 'null'));
      }
      if (distinct.size < l) {
        lViolations.push(key);
      }
    }

    const result: KLResult = {
      compliant: kViolations.length === 0 && lViolations.length === 0,
      kViolations,
      lViolations,
      groupCount: groups.size,
      totalRecords: records.length,
    };

    this.record('ANALYZE', sensitiveField, {
      k,
      l,
      total: records.length,
      compliant: result.compliant,
    });

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
