// SVC-AI-ADV-R498 Public Safety Prediction AI
// Design Ref: SVC-AI-ADV-R498.design.md §공공안전예측
// Plan SC: FR-498.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

const DATA_GRADE_BLOCK = ['C', 'S'] as const;

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type IncidentType =
  | 'fire'
  | 'traffic_accident'
  | 'crime'
  | 'flood'
  | 'gas_leak'
  | 'medical_emergency';

export interface IncidentRecord {
  readonly recordId: string;
  readonly regionCode: string;
  readonly type: IncidentType;
  readonly occurredAt: string;
  readonly casualties: number;
  readonly weatherCondition: 'clear' | 'rain' | 'snow' | 'fog';
}

export interface SafetyForecast {
  readonly regionCode: string;
  readonly periodDays: number;
  readonly hotspots: ReadonlyArray<{ readonly type: IncidentType; readonly count: number }>;
  readonly riskScore: number;
  readonly recommendedPatrols: number;
  readonly emergencyResponseLevel: 'normal' | 'elevated' | 'high' | 'critical';
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly detail: Record<string, unknown>;
}

export class PublicSafetyPredictionAi {
  private readonly auditLog: AuditEntry[] = [];
  private readonly records: IncidentRecord[] = [];

  ingest(record: IncidentRecord, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (record.casualties < 0) {
      throw new Error('VALIDATION: 음수 사상자 불가');
    }
    this.records.push(record);
    this.appendAudit('INGEST', { recordId: record.recordId });
  }

  forecast(regionCode: string, periodDays = 7): SafetyForecast {
    const regional = this.records.filter((r) => r.regionCode === regionCode);
    const counts: Map<IncidentType, number> = new Map();
    for (const rec of regional) {
      counts.set(rec.type, (counts.get(rec.type) ?? 0) + 1);
    }
    const hotspots = Array.from(counts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    const totalCasualties = regional.reduce((acc, r) => acc + r.casualties, 0);
    const totalIncidents = regional.length;
    const riskScore = Math.min(
      100,
      Math.round(totalIncidents * 2 + totalCasualties * 3),
    );

    const recommendedPatrols =
      riskScore >= 80 ? 12 : riskScore >= 60 ? 8 : riskScore >= 30 ? 4 : 2;

    const emergencyResponseLevel: SafetyForecast['emergencyResponseLevel'] =
      riskScore >= 80
        ? 'critical'
        : riskScore >= 60
          ? 'high'
          : riskScore >= 30
            ? 'elevated'
            : 'normal';

    const result: SafetyForecast = {
      regionCode,
      periodDays,
      hotspots,
      riskScore,
      recommendedPatrols,
      emergencyResponseLevel,
    };

    this.appendAudit('FORECAST', {
      regionCode,
      riskScore,
      level: emergencyResponseLevel,
    });
    return result;
  }

  totalIncidents(): number {
    return this.records.length;
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
