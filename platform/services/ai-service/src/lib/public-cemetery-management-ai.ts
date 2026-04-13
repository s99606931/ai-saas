// Design Ref: §공공 묘지 관리 AI — 구역 관리·사용 현황·계약 만료 알림
// Plan SC: FR-R540.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type PlotStatus = 'available' | 'reserved' | 'occupied' | 'expired';
export type PlotKind = 'burial' | 'charnel' | 'naturalBurial';

export interface Plot {
  plotId: string;
  zone: string;
  kind: PlotKind;
  status: PlotStatus;
  capacity: number;
}

export interface Contract {
  contractId: string;
  plotId: string;
  familyIdHash: string; // 익명화된 가족 ID
  startDate: string;
  endDate: string;
}

export interface OccupancyStats {
  totalPlots: number;
  available: number;
  reserved: number;
  occupied: number;
  expired: number;
  utilizationPercent: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class PublicCemeteryManagementAI {
  private readonly plots = new Map<string, Plot>();
  private readonly contracts = new Map<string, Contract>();
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R540.1
  registerPlot(plot: Plot, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (plot.capacity <= 0) throw new Error('수용 수는 양수여야 합니다');
    this.plots.set(plot.plotId, { ...plot });
    this.append('REGISTER_PLOT', { plotId: plot.plotId, zone: plot.zone });
  }

  // Plan SC: FR-R540.2
  createContract(contract: Contract, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    const plot = this.plots.get(contract.plotId);
    if (!plot) throw new Error(`묘지 구역 미등록: ${contract.plotId}`);
    if (plot.status === 'occupied') throw new Error('이미 사용 중인 묘지');
    if (new Date(contract.endDate).getTime() <= new Date(contract.startDate).getTime()) {
      throw new Error('종료일은 시작일 이후여야 합니다');
    }
    if (!/^[a-f0-9]{6,}$/i.test(contract.familyIdHash)) {
      throw new Error('가족 ID는 해시값이어야 합니다 (PII 금지)');
    }
    this.contracts.set(contract.contractId, { ...contract });
    plot.status = 'occupied';
    this.append('CREATE_CONTRACT', { contractId: contract.contractId, plotId: contract.plotId });
  }

  // Plan SC: FR-R540.3
  getExpiringContracts(withinDays: number, nowIso: string): Contract[] {
    const now = new Date(nowIso).getTime();
    const threshold = now + withinDays * 24 * 60 * 60 * 1000;
    const results: Contract[] = [];
    for (const c of this.contracts.values()) {
      const endTime = new Date(c.endDate).getTime();
      if (endTime >= now && endTime <= threshold) {
        results.push({ ...c });
      }
    }
    this.append('GET_EXPIRING', { withinDays, count: results.length });
    return results;
  }

  // Plan SC: FR-R540.4
  getOccupancyStats(zone?: string): OccupancyStats {
    const target = zone
      ? Array.from(this.plots.values()).filter(p => p.zone === zone)
      : Array.from(this.plots.values());

    const total = target.length;
    let available = 0;
    let reserved = 0;
    let occupied = 0;
    let expired = 0;
    for (const p of target) {
      if (p.status === 'available') available += 1;
      else if (p.status === 'reserved') reserved += 1;
      else if (p.status === 'occupied') occupied += 1;
      else if (p.status === 'expired') expired += 1;
    }
    const utilizationPercent = total === 0 ? 0 : Math.round(((occupied + reserved) / total) * 100);
    return {
      totalPlots: total,
      available,
      reserved,
      occupied,
      expired,
      utilizationPercent,
    };
  }

  // Plan SC: FR-R540.5
  expireContract(contractId: string): void {
    const contract = this.contracts.get(contractId);
    if (!contract) throw new Error(`계약 미등록: ${contractId}`);
    const plot = this.plots.get(contract.plotId);
    if (plot) plot.status = 'expired';
    this.append('EXPIRE_CONTRACT', { contractId });
  }

  // Plan SC: FR-R540.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
