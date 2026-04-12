/**
 * 녹색구매 AI 추천
 * Design Ref: MTU-N454 §3
 * Plan SC: FR-GP.1~5
 */

import { z } from 'zod';

export const CertifiedProductSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  certificationType: z.enum(['eco-label', 'gr-mark', 'low-carbon']),
  certificationNo: z.string().min(1),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vendor: z.string().min(1),
  pricePerUnit: z.number().nonnegative(),
});

export type CertifiedProduct = z.infer<typeof CertifiedProductSchema>;

export interface PurchaseRequest {
  requestId: string;
  category: string;
  quantity: number;
  maxBudgetKrw: number;
  keywords: string[];
}

/**
 * 녹색제품 DB (FR-GP.1)
 */
export class GreenProductRegistry {
  private products = new Map<string, CertifiedProduct>();

  register(product: CertifiedProduct): void {
    const validated = CertifiedProductSchema.parse(product);
    this.products.set(validated.productId, validated);
  }

  list(): CertifiedProduct[] {
    return Array.from(this.products.values());
  }

  findByCategory(category: string): CertifiedProduct[] {
    return this.list().filter((p) => p.category === category);
  }

  /**
   * 인증 만료 체크 (FR-GP.4)
   */
  findExpiring(withinDays: number, today: Date = new Date()): CertifiedProduct[] {
    const threshold = new Date(today);
    threshold.setDate(threshold.getDate() + withinDays);
    return this.list().filter((p) => {
      const valid = new Date(p.validUntil);
      return valid >= today && valid <= threshold;
    });
  }
}

/**
 * 매칭 추천 엔진 (FR-GP.2, FR-GP.5)
 */
export class GreenProcurementMatcher {
  constructor(private registry: GreenProductRegistry) {}

  recommend(request: PurchaseRequest, topN = 5): Array<{
    product: CertifiedProduct;
    score: number;
    totalCost: number;
    withinBudget: boolean;
  }> {
    const candidates = this.registry.findByCategory(request.category);
    const scored = candidates.map((product) => {
      const keywordScore = this.keywordSimilarity(request.keywords, product.name);
      const totalCost = product.pricePerUnit * request.quantity;
      const withinBudget = totalCost <= request.maxBudgetKrw;
      const budgetScore = withinBudget ? 1 : request.maxBudgetKrw / totalCost;
      const certScore = product.certificationType === 'low-carbon' ? 1.2 : 1;
      const score = keywordScore * 0.5 + budgetScore * 0.3 + certScore * 0.2;
      return {
        product,
        score: Math.round(score * 100) / 100,
        totalCost,
        withinBudget,
      };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topN);
  }

  private keywordSimilarity(keywords: string[], text: string): number {
    if (keywords.length === 0) return 0.5;
    const lower = text.toLowerCase();
    const hits = keywords.filter((k) => lower.includes(k.toLowerCase())).length;
    return hits / keywords.length;
  }
}

/**
 * 의무비율 추적기 (FR-GP.3)
 */
export interface ProcurementRecord {
  recordId: string;
  productId: string;
  amountKrw: number;
  isCertified: boolean;
  period: string;
}

export class MandatoryRatioTracker {
  private records: ProcurementRecord[] = [];

  addRecord(record: ProcurementRecord): void {
    this.records.push(record);
  }

  calculateRatio(period: string): {
    totalKrw: number;
    certifiedKrw: number;
    ratioPercent: number;
    achieved: boolean;
    targetPercent: number;
  } {
    const targetPercent = 20; // 공공기관 녹색구매 의무비율
    const periodRecords = this.records.filter((r) => r.period === period);
    const totalKrw = periodRecords.reduce((s, r) => s + r.amountKrw, 0);
    const certifiedKrw = periodRecords
      .filter((r) => r.isCertified)
      .reduce((s, r) => s + r.amountKrw, 0);
    const ratioPercent = totalKrw > 0 ? (certifiedKrw / totalKrw) * 100 : 0;
    return {
      totalKrw,
      certifiedKrw,
      ratioPercent: Math.round(ratioPercent * 10) / 10,
      achieved: ratioPercent >= targetPercent,
      targetPercent,
    };
  }
}
