// Design Ref: §SVC-AI-ADV-R482 — AI기반 공공 데이터 연계 자동화 v3
// Plan SC: FR-R482.1~5

export type DataGrade = 'O' | 'C' | 'S';

export interface DataSource {
  readonly sourceId: string;
  readonly fields: readonly string[];
  readonly grade: DataGrade;
}

export interface LinkageMapping {
  readonly sourceA: string;
  readonly sourceB: string;
  readonly mappableFields: readonly string[];
  readonly missingInA: readonly string[];
  readonly missingInB: readonly string[];
  readonly compatibilityScore: number;
}

interface AuditEvent {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class PublicDataLinkageAutomatorV3 {
  private readonly auditLog: AuditEvent[] = [];

  link(sourceA: DataSource, sourceB: DataSource): LinkageMapping {
    if (sourceA.grade === 'C' || sourceA.grade === 'S') {
      this.auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'linkage.blocked',
        details: { sourceId: sourceA.sourceId, grade: sourceA.grade },
      });
      throw new Error(`BLOCKED: ${sourceA.grade}등급 데이터 소스 연계 금지 (N2SF N-05)`);
    }
    if (sourceB.grade === 'C' || sourceB.grade === 'S') {
      this.auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'linkage.blocked',
        details: { sourceId: sourceB.sourceId, grade: sourceB.grade },
      });
      throw new Error(`BLOCKED: ${sourceB.grade}등급 데이터 소스 연계 금지 (N2SF N-05)`);
    }

    const setA = new Set(sourceA.fields);
    const setB = new Set(sourceB.fields);

    const mappableFields = sourceA.fields.filter(f => setB.has(f));
    const missingInA = sourceB.fields.filter(f => !setA.has(f));
    const missingInB = sourceA.fields.filter(f => !setB.has(f));

    const unionSize = new Set([...sourceA.fields, ...sourceB.fields]).size;
    const compatibilityScore = unionSize === 0
      ? 0
      : Math.round((mappableFields.length / unionSize) * 100);

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'linkage.analyze',
      details: {
        sourceA: sourceA.sourceId,
        sourceB: sourceB.sourceId,
        compatibilityScore,
        mappableCount: mappableFields.length,
      },
    });

    return {
      sourceA: sourceA.sourceId,
      sourceB: sourceB.sourceId,
      mappableFields,
      missingInA,
      missingInB,
      compatibilityScore,
    };
  }

  getAuditLog(): readonly AuditEvent[] {
    return [...this.auditLog];
  }
}
