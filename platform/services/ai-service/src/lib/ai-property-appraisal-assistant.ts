// Design Ref: §AI 감정 평가 보조 — 공시지가 기반 비교 거래 가중 평균
// Plan SC: FR-R582.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type PropertyType = 'apartment' | 'house' | 'land' | 'commercial';

export interface Comparable {
  id: string;
  type: PropertyType;
  areaSqm: number;
  soldPriceKrw: number;
  soldDaysAgo: number;
  distanceKm: number;
}

export interface AppraisalInput {
  propertyId: string;
  type: PropertyType;
  areaSqm: number;
  publicPriceKrw: number; // 공시지가
  comparables: Comparable[];
}

export interface AppraisalResult {
  propertyId: string;
  estimatedKrw: number;
  pricePerSqmKrw: number;
  confidence: number; // 0~1
  notes: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class AIPropertyAppraisalAssistant {
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  appraise(input: AppraisalInput, grade: DataGrade = 'O'): AppraisalResult {
    blockClassifiedData(grade);
    if (input.areaSqm <= 0) throw new Error('areaSqm는 양수여야 함');
    if (input.publicPriceKrw <= 0) throw new Error('publicPriceKrw는 양수여야 함');

    const sameType = input.comparables.filter((c) => c.type === input.type);
    const notes: string[] = [];

    if (sameType.length === 0) {
      notes.push('동일 유형 비교 거래 없음 → 공시지가 기반 산정');
      const estimated = Math.round(input.publicPriceKrw * 1.15);
      this.log('APPRAISE', { propertyId: input.propertyId, method: 'public-only', estimated });
      return {
        propertyId: input.propertyId,
        estimatedKrw: estimated,
        pricePerSqmKrw: Math.round(estimated / input.areaSqm),
        confidence: 0.4,
        notes,
      };
    }

    let totalWeight = 0;
    let weightedSum = 0;
    for (const c of sameType) {
      const recencyWeight = 1 / (1 + c.soldDaysAgo / 180);
      const distanceWeight = 1 / (1 + c.distanceKm);
      const weight = recencyWeight * distanceWeight;
      const perSqm = c.soldPriceKrw / Math.max(1, c.areaSqm);
      weightedSum += perSqm * weight;
      totalWeight += weight;
    }
    const avgPerSqm = totalWeight === 0 ? input.publicPriceKrw / input.areaSqm : weightedSum / totalWeight;
    const rawEstimate = avgPerSqm * input.areaSqm;
    const blended = rawEstimate * 0.75 + input.publicPriceKrw * 1.1 * 0.25;
    const estimatedKrw = Math.round(blended);
    const confidence = Math.min(1, 0.4 + 0.1 * sameType.length);

    if (sameType.length < 3) notes.push('비교 거래 부족(3건 미만) — 신뢰도 주의');
    if (Math.abs(rawEstimate - input.publicPriceKrw) / input.publicPriceKrw > 0.4) {
      notes.push('공시지가 대비 40% 이상 편차 — 재검토 권고');
    }

    this.log('APPRAISE', {
      propertyId: input.propertyId,
      method: 'blended',
      estimated: estimatedKrw,
      comparables: sameType.length,
    });

    return {
      propertyId: input.propertyId,
      estimatedKrw,
      pricePerSqmKrw: Math.round(estimatedKrw / input.areaSqm),
      confidence,
      notes,
    };
  }

  getAuditLog(): AuditEntry[] {
    return [...this.audit];
  }
}
