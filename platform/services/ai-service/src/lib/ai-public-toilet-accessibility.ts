// Design Ref: §공공화장실 접근성 — 장애인/여성/어린이 기준 점수화
// Plan SC: FR-R607.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface ToiletFacility {
  toiletId: string;
  location: string;
  hasWheelchairAccess: boolean;
  hasBabyChangingTable: boolean;
  hasChildToilet: boolean;
  hasEmergencyButton: boolean;
  hasNonSlipFloor: boolean;
  cleanlinessScore: number; // 0~10
}

export interface AccessibilityResult {
  toiletId: string;
  totalScore: number;
  grade: 'A' | 'B' | 'C' | 'D';
  missingFeatures: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class AIPublicToiletAccessibility {
  private facilities = new Map<string, ToiletFacility>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R607.1
  registerFacility(facility: ToiletFacility, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (facility.cleanlinessScore < 0 || facility.cleanlinessScore > 10) {
      throw new Error('청결도는 0~10 범위여야 합니다');
    }
    if (!facility.toiletId) throw new Error('화장실 ID가 필요합니다');
    this.facilities.set(facility.toiletId, { ...facility });
    this.append('REGISTER_FACILITY', { toiletId: facility.toiletId });
  }

  // Plan SC: FR-R607.2
  evaluate(toiletId: string, grade: DataGrade = 'O'): AccessibilityResult {
    blockClassifiedData(grade);
    const f = this.facilities.get(toiletId);
    if (!f) throw new Error(`화장실 미등록: ${toiletId}`);

    let score = 0;
    const missing: string[] = [];
    if (f.hasWheelchairAccess) score += 25;
    else missing.push('휠체어 접근');
    if (f.hasBabyChangingTable) score += 15;
    else missing.push('영유아 기저귀 교환대');
    if (f.hasChildToilet) score += 10;
    else missing.push('어린이 변기');
    if (f.hasEmergencyButton) score += 15;
    else missing.push('비상벨');
    if (f.hasNonSlipFloor) score += 10;
    else missing.push('미끄럼 방지 바닥');
    score += f.cleanlinessScore * 2.5;

    const totalScore = Math.round(score * 100) / 100;
    const resultGrade: AccessibilityResult['grade'] =
      totalScore >= 85 ? 'A' : totalScore >= 65 ? 'B' : totalScore >= 45 ? 'C' : 'D';

    this.append('EVALUATE', { toiletId, totalScore, grade: resultGrade });
    return { toiletId, totalScore, grade: resultGrade, missingFeatures: missing };
  }

  // Plan SC: FR-R607.3
  listByGrade(targetGrade: AccessibilityResult['grade']): AccessibilityResult[] {
    const results: AccessibilityResult[] = [];
    for (const id of this.facilities.keys()) {
      const r = this.evaluate(id);
      if (r.grade === targetGrade) results.push(r);
    }
    return results;
  }

  // Plan SC: FR-R607.4
  wheelchairAccessibleCount(): number {
    let n = 0;
    for (const f of this.facilities.values()) if (f.hasWheelchairAccess) n++;
    return n;
  }

  // Plan SC: FR-R607.5
  getFacility(toiletId: string): ToiletFacility | undefined {
    const f = this.facilities.get(toiletId);
    return f ? { ...f } : undefined;
  }

  // Plan SC: FR-R607.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
