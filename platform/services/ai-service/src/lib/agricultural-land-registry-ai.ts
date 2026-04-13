// Design Ref: §농지 등록 관리 AI — 지목·면적·용도 검증
// Plan SC: FR-R573.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type LandCategory = 'paddy' | 'upland' | 'orchard' | 'pasture' | 'forest';
export type UseStatus = 'in_use' | 'idle' | 'reclaimed' | 'converted';

export interface FarmLand {
  parcelId: string;
  ownerId: string;
  category: LandCategory;
  areaM2: number;
  useStatus: UseStatus;
  isProtectedZone: boolean;
  registeredAt: string;
}

export interface ValidationIssue {
  parcelId: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class AgriculturalLandRegistryAI {
  private parcels = new Map<string, FarmLand>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R573.1
  registerParcel(land: FarmLand, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (land.areaM2 <= 0) throw new Error('면적은 0보다 커야 합니다');
    if (this.parcels.has(land.parcelId)) throw new Error(`이미 등록된 필지: ${land.parcelId}`);
    this.parcels.set(land.parcelId, { ...land });
    this.append('REGISTER_PARCEL', { parcelId: land.parcelId, category: land.category });
  }

  // Plan SC: FR-R573.2
  updateUseStatus(parcelId: string, status: UseStatus, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    const land = this.parcels.get(parcelId);
    if (!land) throw new Error(`필지 미등록: ${parcelId}`);
    land.useStatus = status;
    this.append('UPDATE_USE_STATUS', { parcelId, status });
  }

  // Plan SC: FR-R573.3
  validateParcel(parcelId: string): ValidationIssue[] {
    const land = this.parcels.get(parcelId);
    if (!land) throw new Error(`필지 미등록: ${parcelId}`);

    const issues: ValidationIssue[] = [];

    if (land.isProtectedZone && land.useStatus === 'converted') {
      issues.push({
        parcelId,
        severity: 'error',
        message: '보호구역은 지목 전환 불가',
      });
    }
    if (land.useStatus === 'idle') {
      issues.push({
        parcelId,
        severity: 'warning',
        message: '유휴 농지 — 활용 계획 필요',
      });
    }
    if (land.category === 'paddy' && land.areaM2 < 100) {
      issues.push({
        parcelId,
        severity: 'warning',
        message: '논 최소 면적 100㎡ 미달',
      });
    }
    if (land.category === 'orchard' && land.areaM2 < 300) {
      issues.push({
        parcelId,
        severity: 'info',
        message: '과수원 권장 면적 300㎡ 미달',
      });
    }

    this.append('VALIDATE_PARCEL', { parcelId, issueCount: issues.length });
    return issues;
  }

  // Plan SC: FR-R573.4
  getOwnerParcels(ownerId: string): FarmLand[] {
    return Array.from(this.parcels.values())
      .filter(p => p.ownerId === ownerId)
      .map(p => ({ ...p }));
  }

  // Plan SC: FR-R573.5
  getTotalAreaByCategory(): Record<LandCategory, number> {
    const totals: Record<LandCategory, number> = {
      paddy: 0,
      upland: 0,
      orchard: 0,
      pasture: 0,
      forest: 0,
    };
    for (const p of this.parcels.values()) {
      totals[p.category] += p.areaM2;
    }
    return totals;
  }

  // Plan SC: FR-R573.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
