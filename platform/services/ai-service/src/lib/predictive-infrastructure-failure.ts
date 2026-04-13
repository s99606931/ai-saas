// SVC-AI-ADV-R465 Predictive Infrastructure Failure
// Design Ref: SVC-AI-ADV-R465.design.md
// Plan SC: FR-465.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type FacilityType = 'bridge' | 'tunnel' | 'water';

export interface Facility {
  readonly id: string;
  readonly type: FacilityType;
  readonly ageYears: number;
  readonly crackIndex: number;
  readonly vibration: number;
  readonly corrosion: number;
}

export type RiskLevel = 'low' | 'mid' | 'high';

export interface FailurePrediction {
  readonly id: string;
  readonly failureProbability: number;
  readonly riskLevel: RiskLevel;
  readonly inspectionPriority: 1 | 2 | 3 | 4 | 5;
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

export class PredictiveInfrastructureFailure {
  private readonly auditLog: AuditEntry[] = [];

  predict(facility: Facility, grade: DataGrade = 'O'): FailurePrediction {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 시설 데이터 차단 (N2SF N-05)`);
    }
    const { ageYears, crackIndex, vibration, corrosion } = facility;
    if (ageYears < 0 || crackIndex < 0 || crackIndex > 1 || vibration < 0 || vibration > 1 || corrosion < 0 || corrosion > 1) {
      throw new Error(`INVALID_FACILITY: ${facility.id}`);
    }

    const ageScore = Math.min(1, ageYears / 50);
    const prob = 0.3 * ageScore + 0.3 * crackIndex + 0.2 * vibration + 0.2 * corrosion;
    const failureProbability = Number(Math.max(0, Math.min(1, prob)).toFixed(3));

    let riskLevel: RiskLevel = 'low';
    let inspectionPriority: 1 | 2 | 3 | 4 | 5 = 5;
    if (failureProbability >= 0.75) {
      riskLevel = 'high';
      inspectionPriority = 1;
    } else if (failureProbability >= 0.5) {
      riskLevel = 'mid';
      inspectionPriority = 3;
    }

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'FAILURE_PREDICT',
      details: { id: facility.id, failureProbability, riskLevel },
    });

    return {
      id: facility.id,
      failureProbability,
      riskLevel,
      inspectionPriority,
    };
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }
}
