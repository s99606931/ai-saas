// Design Ref: §핵심 알고리즘 — 폐기물 카테고리별 감축 잠재량 추정
// Plan SC: FR-R517.1~5

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

type WasteCategory = 'general' | 'recyclable' | 'food' | 'hazardous' | 'construction';

interface WasteRecord {
  facilityId: string;
  monthYYYYMM: string;
  category: WasteCategory;
  weightKg: number;
}

interface ReductionPlan {
  facilityId: string;
  category: WasteCategory;
  currentKg: number;
  targetKg: number;
  reductionPotentialKg: number;
  recommendation: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const REDUCTION_RATES: Record<WasteCategory, number> = {
  general: 0.15,
  recyclable: 0.30,
  food: 0.40,
  hazardous: 0.10,
  construction: 0.20,
};

const RECOMMENDATIONS: Record<WasteCategory, string> = {
  general: '분리배출 가이드라인 강화',
  recyclable: '재활용 인프라 확충 및 시민 교육',
  food: '음식물 잔반 감축 캠페인 및 소형 처리기 보급',
  hazardous: '유해 폐기물 수거 거점 확대',
  construction: '건설 폐자재 재사용 매뉴얼 보급',
};

export class AIWasteReductionOptimizer {
  private records: WasteRecord[] = [];
  private readonly auditLog: AuditEntry[] = [];

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R517.1
  recordWaste(record: WasteRecord, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (record.weightKg < 0) throw new Error('weightKg >= 0 필요');
    this.records.push(record);
    this.appendAudit('RECORD_WASTE', { facilityId: record.facilityId, category: record.category });
  }

  // Plan SC: FR-R517.2
  computePlan(facilityId: string, monthYYYYMM: string, category: WasteCategory): ReductionPlan {
    const subset = this.records.filter(r =>
      r.facilityId === facilityId && r.monthYYYYMM === monthYYYYMM && r.category === category
    );
    if (subset.length === 0) throw new Error(`기록 없음: ${facilityId} ${monthYYYYMM} ${category}`);

    const currentKg = subset.reduce((sum, r) => sum + r.weightKg, 0);
    const rate = REDUCTION_RATES[category];
    const reductionPotentialKg = Math.round(currentKg * rate * 100) / 100;
    const targetKg = Math.round((currentKg - reductionPotentialKg) * 100) / 100;

    this.appendAudit('COMPUTE_PLAN', { facilityId, category, currentKg, targetKg });
    return {
      facilityId,
      category,
      currentKg,
      targetKg,
      reductionPotentialKg,
      recommendation: RECOMMENDATIONS[category],
    };
  }

  // Plan SC: FR-R517.3
  computeFacilityTotal(facilityId: string, monthYYYYMM: string): number {
    return this.records
      .filter(r => r.facilityId === facilityId && r.monthYYYYMM === monthYYYYMM)
      .reduce((sum, r) => sum + r.weightKg, 0);
  }

  // Plan SC: FR-R517.4
  rankFacilities(monthYYYYMM: string): Array<{ facilityId: string; totalKg: number }> {
    const map = new Map<string, number>();
    for (const r of this.records) {
      if (r.monthYYYYMM !== monthYYYYMM) continue;
      map.set(r.facilityId, (map.get(r.facilityId) ?? 0) + r.weightKg);
    }
    return Array.from(map.entries())
      .map(([facilityId, totalKg]) => ({ facilityId, totalKg }))
      .sort((a, b) => b.totalKg - a.totalKg);
  }

  // Plan SC: FR-R517.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
