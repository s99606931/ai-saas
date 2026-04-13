// SVC-AI-ADV-R400 Public Safety Score Engine
// Design Ref: SVC-AI-ADV-R400.design.md
// Plan SC: SC-R400-1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface RegionMetrics {
  readonly regionId: string;
  readonly crimeRate: number;
  readonly fireRate: number;
  readonly accidentRate: number;
  readonly disasterRate: number;
}

export type SafetyGrade = 'A' | 'B' | 'C' | 'D';

export interface SafetyReport {
  readonly regionId: string;
  readonly crimeScore: number;
  readonly fireScore: number;
  readonly accidentScore: number;
  readonly disasterScore: number;
  readonly totalScore: number;
  readonly grade: SafetyGrade;
  readonly riskFactors: readonly string[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const SCALE = { crime: 10, fire: 20, accident: 5, disaster: 50 } as const;

export class PublicSafetyScoreEngine {
  private readonly auditLog: AuditEntry[] = [];

  evaluate(metrics: RegionMetrics, grade: DataGrade = 'O'): SafetyReport {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 지역 데이터 차단 (N2SF N-05)`);
    }
    for (const [k, v] of Object.entries(metrics)) {
      if (k === 'regionId') continue;
      if ((v as number) < 0) {
        throw new Error(`INVALID_METRIC: ${k} < 0`);
      }
    }

    const crimeScore = this.scoreOf(metrics.crimeRate, SCALE.crime);
    const fireScore = this.scoreOf(metrics.fireRate, SCALE.fire);
    const accidentScore = this.scoreOf(metrics.accidentRate, SCALE.accident);
    const disasterScore = this.scoreOf(metrics.disasterRate, SCALE.disaster);

    const totalScore = Number(
      ((crimeScore + fireScore + accidentScore + disasterScore) / 4).toFixed(2),
    );

    const riskFactors: string[] = [];
    if (crimeScore < 60) riskFactors.push('crime');
    if (fireScore < 60) riskFactors.push('fire');
    if (accidentScore < 60) riskFactors.push('accident');
    if (disasterScore < 60) riskFactors.push('disaster');

    let letter: SafetyGrade;
    if (totalScore >= 85) letter = 'A';
    else if (totalScore >= 70) letter = 'B';
    else if (totalScore >= 50) letter = 'C';
    else letter = 'D';

    const report: SafetyReport = {
      regionId: metrics.regionId,
      crimeScore,
      fireScore,
      accidentScore,
      disasterScore,
      totalScore,
      grade: letter,
      riskFactors,
    };

    this.record('EVALUATE', metrics.regionId, { totalScore, grade: letter });
    return report;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private scoreOf(rate: number, scale: number): number {
    return Math.max(0, Number((100 - rate * scale).toFixed(2)));
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
