// Design Ref: §공공 주택 유지보수 AI — 설비 노후도 기반 수선 우선순위 산정
// Plan SC: FR-R596.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type FacilityKind = 'elevator' | 'plumbing' | 'electric' | 'heating' | 'roof' | 'wall';

export interface HousingUnit {
  unitId: string;
  complexName: string;
  builtYear: number;
  floorArea: number;
  householdCount: number;
}

export interface FacilityRecord {
  unitId: string;
  kind: FacilityKind;
  installedYear: number;
  lastInspection: string; // ISO
  defectCount: number;
  complaintCount: number;
}

export type RepairPriority = 'monitor' | 'scheduled' | 'urgent' | 'emergency';

export interface RepairPlan {
  unitId: string;
  kind: FacilityKind;
  priority: RepairPriority;
  score: number;
  estimatedCost: number; // KRW
  reason: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const LIFE_EXPECTANCY: Record<FacilityKind, number> = {
  elevator: 25,
  plumbing: 30,
  electric: 20,
  heating: 20,
  roof: 30,
  wall: 40,
};

const BASE_COST: Record<FacilityKind, number> = {
  elevator: 80_000_000,
  plumbing: 15_000_000,
  electric: 20_000_000,
  heating: 25_000_000,
  roof: 30_000_000,
  wall: 10_000_000,
};

export class PublicHousingMaintenanceAI {
  private readonly audit: AuditEntry[] = [];
  private readonly units = new Map<string, HousingUnit>();
  private readonly records: FacilityRecord[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  registerUnit(unit: HousingUnit, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (unit.householdCount <= 0) throw new Error('householdCount 양수');
    this.units.set(unit.unitId, unit);
    this.log('REGISTER_UNIT', { unitId: unit.unitId });
  }

  addRecord(record: FacilityRecord, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (record.defectCount < 0 || record.complaintCount < 0) throw new Error('음수 불가');
    this.records.push(record);
    this.log('ADD_RECORD', { unitId: record.unitId, kind: record.kind });
  }

  plan(currentYear: number, grade: DataGrade = 'O'): RepairPlan[] {
    blockClassifiedData(grade);
    const plans: RepairPlan[] = [];
    for (const rec of this.records) {
      const unit = this.units.get(rec.unitId);
      if (!unit) continue;

      const expectedLife = LIFE_EXPECTANCY[rec.kind];
      const age = currentYear - rec.installedYear;
      const ageRatio = age / expectedLife;

      let score = 0;
      const reasons: string[] = [];

      if (ageRatio >= 1.0) {
        score += 50;
        reasons.push(`수명 초과 (${age}/${expectedLife})`);
      } else if (ageRatio >= 0.8) {
        score += 30;
        reasons.push(`수명 임박`);
      } else if (ageRatio >= 0.5) {
        score += 10;
      }

      if (rec.defectCount >= 5) {
        score += 30;
        reasons.push(`결함 ${rec.defectCount}건`);
      } else if (rec.defectCount >= 2) {
        score += 15;
      }

      if (rec.complaintCount >= 10) {
        score += 20;
        reasons.push(`민원 ${rec.complaintCount}건`);
      } else if (rec.complaintCount >= 3) {
        score += 10;
      }

      // 엘리베이터 + 결함 → 긴급 가중
      if (rec.kind === 'elevator' && rec.defectCount >= 3) {
        score += 20;
        reasons.push('승강기 안전');
      }

      const priority: RepairPriority =
        score >= 80 ? 'emergency' : score >= 55 ? 'urgent' : score >= 25 ? 'scheduled' : 'monitor';

      const householdMultiplier = 1 + Math.min(2, unit.householdCount / 100);
      const estimatedCost = Math.round(BASE_COST[rec.kind] * householdMultiplier);

      plans.push({
        unitId: rec.unitId,
        kind: rec.kind,
        priority,
        score,
        estimatedCost,
        reason: reasons.join(', ') || '정기 모니터링',
      });
    }
    const order: Record<RepairPriority, number> = { emergency: 0, urgent: 1, scheduled: 2, monitor: 3 };
    plans.sort((a, b) => order[a.priority] - order[b.priority]);
    this.log('PLAN', { count: plans.length });
    return plans;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.audit];
  }
}
