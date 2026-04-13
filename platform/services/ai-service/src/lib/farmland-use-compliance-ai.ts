// Design Ref: §농지 이용 — 농지법 준수 여부 판별 AI
// Plan SC: FR-R544.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type LandUse = 'cultivation' | 'fallow' | 'greenhouse' | 'illegal_structure' | 'conversion';

export interface FarmlandParcel {
  parcelId: string;
  areaM2: number;
  designatedUse: LandUse;
  actualUse: LandUse;
  lastInspectedAt: string;
}

export interface ComplianceResult {
  parcelId: string;
  compliant: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  violations: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class FarmlandUseComplianceAI {
  private parcels = new Map<string, FarmlandParcel>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R544.1
  registerParcel(parcel: FarmlandParcel, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (parcel.areaM2 <= 0) throw new Error('면적은 양수여야 합니다');
    this.parcels.set(parcel.parcelId, { ...parcel });
    this.append('REGISTER', { parcelId: parcel.parcelId });
  }

  // Plan SC: FR-R544.2
  evaluate(parcelId: string, grade: DataGrade = 'O'): ComplianceResult {
    blockClassifiedData(grade);
    const p = this.parcels.get(parcelId);
    if (!p) throw new Error(`필지 미등록: ${parcelId}`);
    const violations: string[] = [];

    if (p.actualUse === 'illegal_structure') violations.push('ILLEGAL_STRUCTURE');
    if (p.actualUse === 'conversion' && p.designatedUse !== 'conversion') violations.push('UNAUTHORIZED_CONVERSION');
    if (p.designatedUse === 'cultivation' && p.actualUse === 'fallow') violations.push('IDLE_FARMLAND');

    const compliant = violations.length === 0;
    const riskLevel: 'low' | 'medium' | 'high' =
      violations.includes('ILLEGAL_STRUCTURE') || violations.includes('UNAUTHORIZED_CONVERSION')
        ? 'high'
        : violations.length > 0
          ? 'medium'
          : 'low';

    const result: ComplianceResult = { parcelId, compliant, riskLevel, violations };
    this.append('EVALUATE', { parcelId, compliant });
    return result;
  }

  // Plan SC: FR-R544.3
  listHighRisk(): string[] {
    const ids: string[] = [];
    for (const [id] of this.parcels) {
      const r = this.evaluate(id);
      if (r.riskLevel === 'high') ids.push(id);
    }
    return ids;
  }

  // Plan SC: FR-R544.4
  totalArea(): number {
    let total = 0;
    for (const [, p] of this.parcels) total += p.areaM2;
    return total;
  }

  // Plan SC: FR-R544.5
  getParcel(parcelId: string): FarmlandParcel | undefined {
    const p = this.parcels.get(parcelId);
    return p ? { ...p } : undefined;
  }

  // Plan SC: FR-R544.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
