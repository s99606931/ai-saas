// Design Ref: §건물 에너지 감사 점수 모델
// Plan SC: FR-R613.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type BuildingType = 'office' | 'school' | 'hospital' | 'residential' | 'government';

interface BuildingProfile {
  id: string;
  type: BuildingType;
  areaSqm: number;
  yearBuilt: number;
  occupancy: number;
}

interface EnergyReading {
  buildingId: string;
  month: string;
  electricityKwh: number;
  heatingGJ: number;
  waterM3: number;
}

interface AuditResult {
  buildingId: string;
  benchmarkRatio: number;
  efficiencyGrade: 'A' | 'B' | 'C' | 'D' | 'E';
  recommendedRetrofits: string[];
  estimatedSavingsPercent: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

function blockClassifiedData(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

// kWh/m2 기준 벤치마크 (연간)
const BENCHMARK: Record<BuildingType, number> = {
  office: 200,
  school: 120,
  hospital: 320,
  residential: 150,
  government: 180,
};

export class AIBuildingEnergyAuditor {
  private buildings = new Map<string, BuildingProfile>();
  private readings = new Map<string, EnergyReading[]>();
  private readonly auditEntries: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.auditEntries.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R613.1
  registerBuilding(profile: BuildingProfile): void {
    if (profile.areaSqm <= 0) throw new Error('면적은 양수여야 합니다');
    this.buildings.set(profile.id, profile);
    this.log('REGISTER_BUILDING', { id: profile.id, type: profile.type });
  }

  // Plan SC: FR-R613.2
  recordReading(reading: EnergyReading, grade: DataGrade = DataGrade.O): void {
    blockClassifiedData(grade);
    if (!this.buildings.has(reading.buildingId)) {
      throw new Error(`미등록 건물: ${reading.buildingId}`);
    }
    const list = this.readings.get(reading.buildingId) ?? [];
    list.push(reading);
    this.readings.set(reading.buildingId, list);
    this.log('RECORD_READING', { buildingId: reading.buildingId, month: reading.month });
  }

  // Plan SC: FR-R613.3
  private computeAnnualKwhPerSqm(buildingId: string): number {
    const profile = this.buildings.get(buildingId);
    const list = this.readings.get(buildingId) ?? [];
    if (!profile || list.length === 0) return 0;
    const totalKwh = list.reduce((acc, r) => acc + r.electricityKwh + r.heatingGJ * 277.78, 0);
    const months = list.length;
    const annualKwh = (totalKwh / months) * 12;
    return annualKwh / profile.areaSqm;
  }

  // Plan SC: FR-R613.4
  private gradeFromRatio(ratio: number): AuditResult['efficiencyGrade'] {
    if (ratio <= 0.7) return 'A';
    if (ratio <= 0.9) return 'B';
    if (ratio <= 1.1) return 'C';
    if (ratio <= 1.3) return 'D';
    return 'E';
  }

  private recommend(ratio: number, profile: BuildingProfile): string[] {
    const recs: string[] = [];
    if (ratio > 1.0) recs.push('LED 조명 교체');
    if (ratio > 1.1) recs.push('단열재 보강');
    if (ratio > 1.2) recs.push('고효율 보일러 교체');
    if (profile.yearBuilt < 2000) recs.push('외피 리모델링');
    return recs;
  }

  // Plan SC: FR-R613.5
  audit(buildingId: string, grade: DataGrade = DataGrade.O): AuditResult {
    blockClassifiedData(grade);
    const profile = this.buildings.get(buildingId);
    if (!profile) throw new Error(`미등록 건물: ${buildingId}`);

    const kwhPerSqm = this.computeAnnualKwhPerSqm(buildingId);
    const benchmark = BENCHMARK[profile.type];
    const ratio = benchmark === 0 ? 1 : kwhPerSqm / benchmark;
    const grade2 = this.gradeFromRatio(ratio);
    const recs = this.recommend(ratio, profile);
    const savings = Math.min(40, Math.max(0, Math.round((ratio - 1) * 25)));

    const result: AuditResult = {
      buildingId,
      benchmarkRatio: Math.round(ratio * 100) / 100,
      efficiencyGrade: grade2,
      recommendedRetrofits: recs,
      estimatedSavingsPercent: savings,
    };
    this.log('AUDIT', { buildingId, grade: grade2 });
    return result;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditEntries;
  }
}
