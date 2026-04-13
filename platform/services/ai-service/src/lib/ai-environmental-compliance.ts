// SVC-AI-ADV-R478 AI Environmental Compliance
// Design Ref: SVC-AI-ADV-R478.design.md §환경준수
// Plan SC: FR-478.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface EmissionRecord {
  readonly facilityId: string;
  readonly pollutant: 'CO2' | 'NOx' | 'SOx' | 'PM10' | 'VOC';
  readonly valuePpm: number;
  readonly timestamp: string;
}

export interface ComplianceResult {
  readonly facilityId: string;
  readonly violations: readonly ViolationDetail[];
  readonly overallStatus: 'COMPLIANT' | 'WARNING' | 'VIOLATION';
  readonly penaltyEstimateKrw: number;
}

export interface ViolationDetail {
  readonly pollutant: EmissionRecord['pollutant'];
  readonly actual: number;
  readonly limit: number;
  readonly severity: 'MINOR' | 'MAJOR' | 'SEVERE';
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

const LIMITS: Readonly<Record<EmissionRecord['pollutant'], number>> = {
  CO2: 1000,
  NOx: 100,
  SOx: 80,
  PM10: 50,
  VOC: 200,
};

function block(grade: DataGrade): void {
  if (grade === 'C' || grade === 'S') {
    throw new Error(`N2SF_BLOCKED: ${grade}등급 환경 데이터 차단 (N2SF N-05)`);
  }
}

export class AiEnvironmentalCompliance {
  private readonly auditLog: AuditEntry[] = [];

  check(
    facilityId: string,
    records: readonly EmissionRecord[],
    grade: DataGrade = 'O',
  ): ComplianceResult {
    block(grade);

    const violations: ViolationDetail[] = [];
    let penalty = 0;

    for (const r of records) {
      const limit = LIMITS[r.pollutant];
      if (r.valuePpm > limit) {
        const ratio = r.valuePpm / limit;
        const severity: ViolationDetail['severity'] =
          ratio >= 2 ? 'SEVERE' : ratio >= 1.5 ? 'MAJOR' : 'MINOR';
        violations.push({
          pollutant: r.pollutant,
          actual: r.valuePpm,
          limit,
          severity,
        });
        penalty +=
          severity === 'SEVERE'
            ? 50_000_000
            : severity === 'MAJOR'
              ? 20_000_000
              : 5_000_000;
      }
    }

    const overall: ComplianceResult['overallStatus'] =
      violations.length === 0
        ? 'COMPLIANT'
        : violations.some((v) => v.severity !== 'MINOR')
          ? 'VIOLATION'
          : 'WARNING';

    this.appendAudit('ENV_COMPLIANCE_CHECK', {
      facilityId,
      violations: violations.length,
      status: overall,
    });

    return {
      facilityId,
      violations,
      overallStatus: overall,
      penaltyEstimateKrw: penalty,
    };
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
