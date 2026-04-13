// Design Ref: §도시 계획 준수 AI — 용도지역·건폐율·용적률 규정 자동 검증
// Plan SC: FR-R583.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type ZoneType =
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'greenbelt'
  | 'historic';

export interface ZoneRule {
  zone: ZoneType;
  maxBuildingCoverageRatio: number; // 건폐율 %
  maxFloorAreaRatio: number; // 용적률 %
  maxHeightMeter: number;
  allowedUses: string[];
}

export interface DevelopmentPlan {
  planId: string;
  zone: ZoneType;
  siteAreaSqm: number;
  buildingFootprintSqm: number;
  totalFloorAreaSqm: number;
  buildingHeightMeter: number;
  useType: string;
}

export interface ComplianceViolation {
  code: string;
  description: string;
}

export interface ComplianceResult {
  planId: string;
  compliant: boolean;
  violations: ComplianceViolation[];
  coverageRatio: number;
  floorAreaRatio: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const DEFAULT_RULES: Record<ZoneType, ZoneRule> = {
  residential: {
    zone: 'residential',
    maxBuildingCoverageRatio: 60,
    maxFloorAreaRatio: 250,
    maxHeightMeter: 60,
    allowedUses: ['housing', 'school', 'community'],
  },
  commercial: {
    zone: 'commercial',
    maxBuildingCoverageRatio: 80,
    maxFloorAreaRatio: 800,
    maxHeightMeter: 120,
    allowedUses: ['retail', 'office', 'hotel', 'housing'],
  },
  industrial: {
    zone: 'industrial',
    maxBuildingCoverageRatio: 70,
    maxFloorAreaRatio: 400,
    maxHeightMeter: 80,
    allowedUses: ['factory', 'warehouse', 'lab'],
  },
  greenbelt: {
    zone: 'greenbelt',
    maxBuildingCoverageRatio: 20,
    maxFloorAreaRatio: 40,
    maxHeightMeter: 12,
    allowedUses: ['park', 'agriculture'],
  },
  historic: {
    zone: 'historic',
    maxBuildingCoverageRatio: 40,
    maxFloorAreaRatio: 120,
    maxHeightMeter: 20,
    allowedUses: ['housing', 'museum', 'retail'],
  },
};

export class UrbanPlanningComplianceAI {
  private readonly audit: AuditEntry[] = [];
  private readonly rules = new Map<ZoneType, ZoneRule>();

  constructor() {
    for (const key of Object.keys(DEFAULT_RULES) as ZoneType[]) {
      const rule = DEFAULT_RULES[key];
      this.rules.set(key, rule);
    }
  }

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  overrideRule(rule: ZoneRule): void {
    this.rules.set(rule.zone, rule);
    this.log('OVERRIDE_RULE', { zone: rule.zone });
  }

  check(plan: DevelopmentPlan, grade: DataGrade = 'O'): ComplianceResult {
    blockClassifiedData(grade);
    if (plan.siteAreaSqm <= 0) throw new Error('siteAreaSqm는 양수여야 함');
    const rule = this.rules.get(plan.zone);
    if (!rule) throw new Error(`미등록 용도지역: ${plan.zone}`);

    const coverageRatio = (plan.buildingFootprintSqm / plan.siteAreaSqm) * 100;
    const floorAreaRatio = (plan.totalFloorAreaSqm / plan.siteAreaSqm) * 100;
    const violations: ComplianceViolation[] = [];

    if (coverageRatio > rule.maxBuildingCoverageRatio) {
      violations.push({
        code: 'BCR_EXCEEDED',
        description: `건폐율 ${coverageRatio.toFixed(1)}% > ${rule.maxBuildingCoverageRatio}%`,
      });
    }
    if (floorAreaRatio > rule.maxFloorAreaRatio) {
      violations.push({
        code: 'FAR_EXCEEDED',
        description: `용적률 ${floorAreaRatio.toFixed(1)}% > ${rule.maxFloorAreaRatio}%`,
      });
    }
    if (plan.buildingHeightMeter > rule.maxHeightMeter) {
      violations.push({
        code: 'HEIGHT_EXCEEDED',
        description: `높이 ${plan.buildingHeightMeter}m > ${rule.maxHeightMeter}m`,
      });
    }
    if (!rule.allowedUses.includes(plan.useType)) {
      violations.push({
        code: 'USE_NOT_ALLOWED',
        description: `용도 ${plan.useType}는 ${plan.zone}에서 불허`,
      });
    }

    const result: ComplianceResult = {
      planId: plan.planId,
      compliant: violations.length === 0,
      violations,
      coverageRatio: Math.round(coverageRatio * 10) / 10,
      floorAreaRatio: Math.round(floorAreaRatio * 10) / 10,
    };
    this.log('CHECK', { planId: plan.planId, compliant: result.compliant, violationCount: violations.length });
    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.audit];
  }
}
