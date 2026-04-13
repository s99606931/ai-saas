// SVC-AI-ADV-R460 기관 간 데이터 교환 AI
// Design Ref: SVC-AI-ADV-R460.design.md
// Plan SC: FR-460.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type FieldType = 'string' | 'number' | 'date';

export interface Mapping {
  readonly sourceField: string;
  readonly targetField: string;
  readonly type: FieldType;
}

export interface ExchangeResult {
  readonly transformed: Record<string, string | number>;
  readonly lostFields: readonly string[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class InteragencyDataExchangeAI {
  private readonly auditLog: AuditEntry[] = [];

  exchange(
    record: Record<string, unknown>,
    mappings: readonly Mapping[],
    grade: DataGrade = 'O',
  ): ExchangeResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 교환 데이터 차단 (N2SF N-05)`);
    }

    const transformed: Record<string, string | number> = {};
    const lostFields: string[] = [];

    for (const m of mappings) {
      if (!m.sourceField || !m.targetField) throw new Error('INVALID_MAPPING');
      const raw = record[m.sourceField];
      if (raw === undefined || raw === null) {
        lostFields.push(m.sourceField);
        continue;
      }

      if (m.type === 'string') {
        transformed[m.targetField] = String(raw);
      } else if (m.type === 'number') {
        const n = Number(raw);
        if (Number.isNaN(n)) {
          lostFields.push(m.sourceField);
        } else {
          transformed[m.targetField] = n;
        }
      } else {
        const s = String(raw);
        if (!DATE_REGEX.test(s)) {
          lostFields.push(m.sourceField);
        } else {
          transformed[m.targetField] = s;
        }
      }
    }

    this.record('EXCHANGE', 'record', {
      mappings: mappings.length,
      lost: lostFields.length,
    });
    return { transformed, lostFields };
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
