// Design Ref: §핵심 알고리즘 — 건축 허가 자동 검토 규칙 엔진
// Plan SC: FR-R515.1~5

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

interface BuildingApplication {
  applicationId: string;
  zoneType: 'residential' | 'commercial' | 'industrial' | 'green';
  floorAreaRatioPct: number;
  buildingCoverageRatioPct: number;
  heightM: number;
  setbackM: number;
  parkingSpaces: number;
  totalUnits: number;
}

interface ZoneRule {
  maxFAR: number;
  maxBCR: number;
  maxHeightM: number;
  minSetbackM: number;
  parkingPerUnit: number;
}

interface ReviewIssue {
  ruleCode: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

interface ReviewResult {
  applicationId: string;
  approved: boolean;
  issues: ReviewIssue[];
  scoreOutOf100: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const DEFAULT_RULES: Record<BuildingApplication['zoneType'], ZoneRule> = {
  residential: { maxFAR: 200, maxBCR: 60, maxHeightM: 30, minSetbackM: 3, parkingPerUnit: 1.0 },
  commercial: { maxFAR: 500, maxBCR: 70, maxHeightM: 80, minSetbackM: 2, parkingPerUnit: 0.5 },
  industrial: { maxFAR: 350, maxBCR: 60, maxHeightM: 50, minSetbackM: 5, parkingPerUnit: 0.3 },
  green: { maxFAR: 50, maxBCR: 20, maxHeightM: 12, minSetbackM: 5, parkingPerUnit: 0.5 },
};

export class AIBuildingPermitAnalyzer {
  private rules: Record<BuildingApplication['zoneType'], ZoneRule>;
  private readonly auditLog: AuditEntry[] = [];

  constructor(customRules?: Partial<Record<BuildingApplication['zoneType'], ZoneRule>>) {
    this.rules = { ...DEFAULT_RULES, ...customRules };
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R515.1
  analyze(app: BuildingApplication, grade: DataGrade = 'O'): ReviewResult {
    blockClassifiedData(grade);
    const rule = this.rules[app.zoneType];
    const issues: ReviewIssue[] = [];

    // Plan SC: FR-R515.2
    if (app.floorAreaRatioPct > rule.maxFAR) {
      issues.push({ ruleCode: 'FAR-EXCEED', severity: 'critical', message: `용적률 ${app.floorAreaRatioPct}% 초과 (한도 ${rule.maxFAR}%)` });
    }
    if (app.buildingCoverageRatioPct > rule.maxBCR) {
      issues.push({ ruleCode: 'BCR-EXCEED', severity: 'critical', message: `건폐율 ${app.buildingCoverageRatioPct}% 초과 (한도 ${rule.maxBCR}%)` });
    }
    if (app.heightM > rule.maxHeightM) {
      issues.push({ ruleCode: 'HEIGHT-EXCEED', severity: 'critical', message: `높이 ${app.heightM}m 초과 (한도 ${rule.maxHeightM}m)` });
    }
    if (app.setbackM < rule.minSetbackM) {
      issues.push({ ruleCode: 'SETBACK-INSUFFICIENT', severity: 'warning', message: `이격거리 ${app.setbackM}m 부족 (최소 ${rule.minSetbackM}m)` });
    }

    // Plan SC: FR-R515.3
    const requiredParking = Math.ceil(app.totalUnits * rule.parkingPerUnit);
    if (app.parkingSpaces < requiredParking) {
      issues.push({ ruleCode: 'PARKING-INSUFFICIENT', severity: 'warning', message: `주차 ${app.parkingSpaces}대 부족 (필요 ${requiredParking}대)` });
    }

    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const score = Math.max(0, 100 - criticalCount * 25 - warningCount * 10);
    const approved = criticalCount === 0;

    this.appendAudit('ANALYZE', { applicationId: app.applicationId, approved, score });
    return { applicationId: app.applicationId, approved, issues, scoreOutOf100: score };
  }

  // Plan SC: FR-R515.4
  batchAnalyze(apps: BuildingApplication[], grade: DataGrade = 'O'): ReviewResult[] {
    return apps.map(a => this.analyze(a, grade));
  }

  // Plan SC: FR-R515.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
