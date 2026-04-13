// SVC-AI-ADV-R468 Public Land Use Optimizer
// Design Ref: SVC-AI-ADV-R468.design.md
// Plan SC: FR-468.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type LandDemand = 'housing' | 'commerce' | 'park' | 'industry';

export interface Parcel {
  readonly id: string;
  readonly areaSqm: number;
  readonly accessScore: number;
  readonly demand: LandDemand;
  readonly currentUse: string;
  readonly restricted: boolean;
}

export interface LandRecommendation {
  readonly id: string;
  readonly recommendedUse: string;
  readonly utilityScore: number;
  readonly convertible: boolean;
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

const DEMAND_WEIGHT: Readonly<Record<LandDemand, number>> = {
  housing: 20,
  commerce: 15,
  park: 10,
  industry: 5,
};

export class PublicLandUseOptimizer {
  private readonly auditLog: AuditEntry[] = [];

  recommend(parcel: Parcel, grade: DataGrade = 'O'): LandRecommendation {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 토지 데이터 차단 (N2SF N-05)`);
    }
    if (parcel.areaSqm < 0 || parcel.accessScore < 0 || parcel.accessScore > 1) {
      throw new Error(`INVALID_PARCEL: ${parcel.id}`);
    }

    if (parcel.restricted) {
      this.auditLog.push({
        timestamp: new Date().toISOString(),
        action: 'LAND_RECOMMEND',
        details: { id: parcel.id, restricted: true },
      });
      return {
        id: parcel.id,
        recommendedUse: parcel.currentUse,
        utilityScore: 0,
        convertible: false,
      };
    }

    const areaPoints = parcel.areaSqm >= 5000 ? 30 : 15;
    const utilityScore = Number(
      (50 * parcel.accessScore + areaPoints + DEMAND_WEIGHT[parcel.demand]).toFixed(2),
    );

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'LAND_RECOMMEND',
      details: { id: parcel.id, utilityScore },
    });

    return {
      id: parcel.id,
      recommendedUse: parcel.demand,
      utilityScore,
      convertible: utilityScore >= 60,
    };
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }
}
