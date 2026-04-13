// SVC-AI-ADV-R475 Digital Twin City AI
// Design Ref: SVC-AI-ADV-R475.design.md §디지털트윈
// Plan SC: FR-475.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface CityZone {
  readonly id: string;
  readonly populationDensity: number; // persons/km²
  readonly trafficVolume: number;
  readonly greenCoverage: number; // 0..1
  readonly airQualityIdx: number; // 0..500
  readonly buildings: number;
}

export interface TwinSimulation {
  readonly scenario: string;
  readonly zoneId: string;
  readonly predictedCongestion: number;
  readonly predictedAQI: number;
  readonly sustainabilityScore: number;
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

function block(grade: DataGrade): void {
  if (grade === 'C' || grade === 'S') {
    throw new Error(`N2SF_BLOCKED: ${grade}등급 도시 데이터 차단 (N2SF N-05)`);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export class DigitalTwinCityAi {
  private readonly auditLog: AuditEntry[] = [];

  simulate(
    zone: CityZone,
    scenario: 'NORMAL' | 'EVENT' | 'EMERGENCY' | 'CONSTRUCTION',
    grade: DataGrade = 'O',
  ): TwinSimulation {
    block(grade);

    const factor =
      scenario === 'EMERGENCY'
        ? 1.8
        : scenario === 'EVENT'
          ? 1.4
          : scenario === 'CONSTRUCTION'
            ? 1.25
            : 1.0;

    const congestion = clamp(
      (zone.trafficVolume / 10_000) * factor * 100,
      0,
      100,
    );
    const baseAqi = zone.airQualityIdx;
    const predictedAQI = Math.round(baseAqi * factor);
    const sustainability = clamp(
      zone.greenCoverage * 100 - congestion * 0.3 - Math.max(0, predictedAQI - 50) * 0.2,
      0,
      100,
    );

    this.appendAudit('TWIN_SIMULATE', {
      zoneId: zone.id,
      scenario,
      congestion,
      predictedAQI,
    });

    return {
      scenario,
      zoneId: zone.id,
      predictedCongestion: Number(congestion.toFixed(2)),
      predictedAQI,
      sustainabilityScore: Number(sustainability.toFixed(2)),
    };
  }

  compareScenarios(
    zone: CityZone,
    scenarios: readonly ('NORMAL' | 'EVENT' | 'EMERGENCY' | 'CONSTRUCTION')[],
  ): readonly TwinSimulation[] {
    const results = scenarios.map((s) => this.simulate(zone, s));
    this.appendAudit('TWIN_COMPARE', { zoneId: zone.id, count: scenarios.length });
    return results;
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
