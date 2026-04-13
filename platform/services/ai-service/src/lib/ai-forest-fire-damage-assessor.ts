// Design Ref: §AI 산불 피해 평가기 — 면적·수종·지형 기반 피해액 추정
// Plan SC: FR-R597.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type ForestType = 'pine' | 'oak' | 'mixed' | 'bamboo' | 'planted';
export type TerrainType = 'flat' | 'hill' | 'steep' | 'ridge';
export type BurnSeverity = 'low' | 'moderate' | 'high' | 'total';

export interface FireReport {
  fireId: string;
  region: string;
  burnedAreaHa: number;
  forestType: ForestType;
  terrain: TerrainType;
  severity: BurnSeverity;
  affectedHouses: number;
  injuredPeople: number;
}

export interface DamageAssessment {
  fireId: string;
  totalDamage: number; // KRW
  timberLoss: number;
  infrastructureLoss: number;
  restorationCost: number;
  recoveryYears: number;
  priorityRegion: boolean;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const TIMBER_VALUE_PER_HA: Record<ForestType, number> = {
  pine: 25_000_000,
  oak: 30_000_000,
  mixed: 22_000_000,
  bamboo: 10_000_000,
  planted: 35_000_000,
};

const SEVERITY_FACTOR: Record<BurnSeverity, number> = {
  low: 0.2,
  moderate: 0.5,
  high: 0.8,
  total: 1.0,
};

const TERRAIN_RESTORATION_FACTOR: Record<TerrainType, number> = {
  flat: 1.0,
  hill: 1.3,
  steep: 1.8,
  ridge: 2.2,
};

const RECOVERY_BASE: Record<ForestType, number> = {
  pine: 30,
  oak: 50,
  mixed: 40,
  bamboo: 10,
  planted: 20,
};

export class AIForestFireDamageAssessor {
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  assess(report: FireReport, grade: DataGrade = 'O'): DamageAssessment {
    blockClassifiedData(grade);
    if (report.burnedAreaHa <= 0) throw new Error('burnedAreaHa 양수');
    if (report.affectedHouses < 0 || report.injuredPeople < 0) throw new Error('음수 불가');

    const severity = SEVERITY_FACTOR[report.severity];
    const timberPerHa = TIMBER_VALUE_PER_HA[report.forestType];
    const timberLoss = Math.round(report.burnedAreaHa * timberPerHa * severity);

    const infrastructureLoss = report.affectedHouses * 150_000_000;
    const terrainFactor = TERRAIN_RESTORATION_FACTOR[report.terrain];
    const restorationCost = Math.round(report.burnedAreaHa * 8_000_000 * terrainFactor * severity);

    const totalDamage = timberLoss + infrastructureLoss + restorationCost;

    const recoveryYears = Math.ceil(RECOVERY_BASE[report.forestType] * severity * (terrainFactor / 1.3));

    const priorityRegion =
      report.burnedAreaHa >= 50 ||
      report.affectedHouses >= 10 ||
      report.injuredPeople >= 5 ||
      report.severity === 'total';

    const result: DamageAssessment = {
      fireId: report.fireId,
      totalDamage,
      timberLoss,
      infrastructureLoss,
      restorationCost,
      recoveryYears,
      priorityRegion,
    };
    this.log('ASSESS', { fireId: report.fireId, totalDamage, priorityRegion });
    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.audit];
  }
}
