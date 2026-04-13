// SVC-AI-ADV-R479 Public Infrastructure Inspector AI
// Design Ref: SVC-AI-ADV-R479.design.md §인프라점검
// Plan SC: FR-479.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface InspectionItem {
  readonly assetId: string;
  readonly assetType: 'BRIDGE' | 'TUNNEL' | 'ROAD' | 'BUILDING' | 'PIPE';
  readonly ageYears: number;
  readonly lastInspectionDays: number;
  readonly defectCount: number;
  readonly structuralRating: number; // 0..100 (100=perfect)
  readonly trafficLoad: number; // 0..100
}

export interface InspectionReport {
  readonly assetId: string;
  readonly conditionGrade: 'A' | 'B' | 'C' | 'D' | 'E';
  readonly riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly recommendedAction: string;
  readonly daysUntilNextInspection: number;
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

function block(grade: DataGrade): void {
  if (grade === 'C' || grade === 'S') {
    throw new Error(`N2SF_BLOCKED: ${grade}등급 인프라 데이터 차단 (N2SF N-05)`);
  }
}

export class PublicInfrastructureInspectorAi {
  private readonly auditLog: AuditEntry[] = [];

  inspect(item: InspectionItem, grade: DataGrade = 'O'): InspectionReport {
    block(grade);

    const ageFactor = Math.min(30, item.ageYears) * 0.8;
    const defectFactor = Math.min(50, item.defectCount) * 1.5;
    const loadFactor = item.trafficLoad * 0.1;
    const penalty = ageFactor + defectFactor + loadFactor;

    const condition = Math.max(0, item.structuralRating - penalty);

    const g: InspectionReport['conditionGrade'] =
      condition >= 85
        ? 'A'
        : condition >= 70
          ? 'B'
          : condition >= 55
            ? 'C'
            : condition >= 40
              ? 'D'
              : 'E';

    const risk: InspectionReport['riskLevel'] =
      g === 'E' ? 'CRITICAL' : g === 'D' ? 'HIGH' : g === 'C' ? 'MEDIUM' : 'LOW';

    const action =
      g === 'E'
        ? 'immediate_closure_and_rebuild'
        : g === 'D'
          ? 'urgent_repair'
          : g === 'C'
            ? 'scheduled_maintenance'
            : 'routine_monitoring';

    const nextInspection =
      g === 'E' ? 0 : g === 'D' ? 30 : g === 'C' ? 180 : g === 'B' ? 365 : 730;

    this.appendAudit('INFRA_INSPECT', {
      assetId: item.assetId,
      grade: g,
      risk,
    });

    return {
      assetId: item.assetId,
      conditionGrade: g,
      riskLevel: risk,
      recommendedAction: action,
      daysUntilNextInspection: nextInspection,
    };
  }

  prioritize(items: readonly InspectionItem[]): readonly InspectionReport[] {
    const reports = items.map((i) => this.inspect(i));
    const order: Record<InspectionReport['riskLevel'], number> = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
    };
    return [...reports].sort((a, b) => order[a.riskLevel] - order[b.riskLevel]);
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }

  private appendAudit(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      details,
    });
  }
}
