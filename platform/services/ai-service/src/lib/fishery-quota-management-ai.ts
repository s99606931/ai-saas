// Design Ref: §수산 쿼터 — TAC 기반 어종별 할당 AI
// Plan SC: FR-R546.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface Quota {
  species: string;
  annualTACTons: number;
  allocatedTons: number;
}

export interface CatchRecord {
  vesselId: string;
  species: string;
  catchTons: number;
  date: string;
}

export interface QuotaStatus {
  species: string;
  remainingTons: number;
  utilizationPct: number;
  overfished: boolean;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class FisheryQuotaManagementAI {
  private quotas = new Map<string, Quota>();
  private catches: CatchRecord[] = [];
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R546.1
  setQuota(species: string, annualTACTons: number, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (annualTACTons < 0) throw new Error('TAC는 0 이상이어야 합니다');
    this.quotas.set(species, { species, annualTACTons, allocatedTons: 0 });
    this.append('SET_QUOTA', { species, annualTACTons });
  }

  // Plan SC: FR-R546.2
  recordCatch(record: CatchRecord, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (record.catchTons < 0) throw new Error('어획량은 0 이상이어야 합니다');
    const q = this.quotas.get(record.species);
    if (!q) throw new Error(`쿼터 미설정 어종: ${record.species}`);
    q.allocatedTons += record.catchTons;
    this.catches.push({ ...record });
    this.append('RECORD_CATCH', { vesselId: record.vesselId, species: record.species });
  }

  // Plan SC: FR-R546.3
  status(species: string): QuotaStatus {
    const q = this.quotas.get(species);
    if (!q) throw new Error(`쿼터 미설정: ${species}`);
    const remainingTons = Math.max(0, q.annualTACTons - q.allocatedTons);
    const utilizationPct =
      q.annualTACTons === 0 ? 0 : Math.round((q.allocatedTons / q.annualTACTons) * 10000) / 100;
    const overfished = q.allocatedTons > q.annualTACTons;
    return { species, remainingTons, utilizationPct, overfished };
  }

  // Plan SC: FR-R546.4
  listOverfished(): string[] {
    const list: string[] = [];
    for (const [species] of this.quotas) {
      if (this.status(species).overfished) list.push(species);
    }
    return list;
  }

  // Plan SC: FR-R546.5
  totalCatchByVessel(vesselId: string): number {
    const total = this.catches
      .filter(c => c.vesselId === vesselId)
      .reduce((s, c) => s + c.catchTons, 0);
    return Math.round(total * 100) / 100;
  }

  // Plan SC: FR-R546.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
