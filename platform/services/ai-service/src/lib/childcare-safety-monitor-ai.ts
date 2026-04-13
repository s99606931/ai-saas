// Design Ref: §보육시설 안전 모니터링 — 위험 요인 가중 점수 모델
// Plan SC: FR-R521.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type HazardType = 'fall' | 'fire' | 'choking' | 'intrusion' | 'allergen' | 'hygiene';
export type SafetyLevel = 'safe' | 'caution' | 'warning' | 'critical';

export interface FacilityRegistration {
  facilityId: string;
  name: string;
  childCount: number;
  staffCount: number;
}

export interface HazardReport {
  facilityId: string;
  hazard: HazardType;
  severity: number; // 1~10
  detectedAt: string;
}

export interface SafetyAssessment {
  facilityId: string;
  riskScore: number;
  level: SafetyLevel;
  topHazards: HazardType[];
  staffChildRatio: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const HAZARD_WEIGHT: Record<HazardType, number> = {
  fall: 1.0,
  fire: 2.0,
  choking: 1.8,
  intrusion: 1.5,
  allergen: 1.2,
  hygiene: 0.8,
};

export class ChildcareSafetyMonitorAI {
  private facilities = new Map<string, FacilityRegistration>();
  private reports: HazardReport[] = [];
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R521.1
  registerFacility(reg: FacilityRegistration, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (reg.childCount < 0 || reg.staffCount < 0) {
      throw new Error('아동 수/교직원 수는 0 이상이어야 합니다');
    }
    this.facilities.set(reg.facilityId, { ...reg });
    this.append('REGISTER_FACILITY', { facilityId: reg.facilityId, childCount: reg.childCount });
  }

  // Plan SC: FR-R521.2
  reportHazard(report: HazardReport, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (!this.facilities.has(report.facilityId)) {
      throw new Error(`시설 미등록: ${report.facilityId}`);
    }
    if (report.severity < 1 || report.severity > 10) {
      throw new Error('심각도는 1~10 범위여야 합니다');
    }
    this.reports.push({ ...report });
    this.append('REPORT_HAZARD', { facilityId: report.facilityId, hazard: report.hazard, severity: report.severity });
  }

  // Plan SC: FR-R521.3
  assess(facilityId: string, grade: DataGrade = 'O'): SafetyAssessment {
    blockClassifiedData(grade);
    const facility = this.facilities.get(facilityId);
    if (!facility) throw new Error(`시설 미등록: ${facilityId}`);

    const facilityReports = this.reports.filter(r => r.facilityId === facilityId);
    const hazardScores = new Map<HazardType, number>();

    for (const r of facilityReports) {
      const weight = HAZARD_WEIGHT[r.hazard];
      const current = hazardScores.get(r.hazard) ?? 0;
      hazardScores.set(r.hazard, current + r.severity * weight);
    }

    let riskScore = 0;
    for (const score of hazardScores.values()) {
      riskScore += score;
    }

    const ratio = facility.childCount === 0 ? 0 : facility.staffCount / facility.childCount;
    if (ratio < 0.1) riskScore += 15;
    else if (ratio < 0.2) riskScore += 7;

    const level: SafetyLevel =
      riskScore >= 60 ? 'critical' : riskScore >= 30 ? 'warning' : riskScore >= 10 ? 'caution' : 'safe';

    const topHazards = Array.from(hazardScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);

    const assessment: SafetyAssessment = {
      facilityId,
      riskScore: Math.round(riskScore * 100) / 100,
      level,
      topHazards,
      staffChildRatio: Math.round(ratio * 100) / 100,
    };
    this.append('ASSESS', { facilityId, riskScore: assessment.riskScore, level });
    return assessment;
  }

  // Plan SC: FR-R521.4
  listFacilities(): FacilityRegistration[] {
    return Array.from(this.facilities.values()).map(f => ({ ...f }));
  }

  // Plan SC: FR-R521.5
  getReports(facilityId?: string): HazardReport[] {
    return facilityId ? this.reports.filter(r => r.facilityId === facilityId) : [...this.reports];
  }

  // Plan SC: FR-R521.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
