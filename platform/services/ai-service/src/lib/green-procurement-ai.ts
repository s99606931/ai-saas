// Design Ref: MTU-N454 §녹색구매 AI
// Plan SC: FR-GP.1~5

export type GreenCertification = '환경마크' | 'GR' | '저탄소' | 'KS';

export interface CertifiedProduct {
  id: string;
  name: string;
  category: string;
  certifications: GreenCertification[];
  expiresAt: string; // ISO date
  co2KgPerUnit?: number;
  price: number;
}

export interface PurchaseRequest {
  id: string;
  category: string;
  budget: number;
  quantity: number;
}

export interface Recommendation {
  requestId: string;
  productId: string;
  matchScore: number;
  reason: string;
}

export interface ComplianceStatus {
  totalSpent: number;
  greenSpent: number;
  ratio: number;
  targetRatio: number;
  achieved: boolean;
}

export class GreenProcurementAi {
  private catalog = new Map<string, CertifiedProduct>();

  /** FR-GP.1 인증 제품 DB 등록 */
  registerProduct(p: CertifiedProduct): void {
    this.catalog.set(p.id, p);
  }

  /** FR-GP.2 구매 요청 → 인증 제품 매칭 */
  recommend(request: PurchaseRequest, today: Date): Recommendation[] {
    const todayStr = today.toISOString().slice(0, 10);
    const candidates: Recommendation[] = [];
    for (const p of this.catalog.values()) {
      if (p.category !== request.category) continue;
      if (p.expiresAt < todayStr) continue;
      const unitBudget = request.budget / request.quantity;
      if (p.price > unitBudget) continue;
      const certBoost = p.certifications.length * 0.1;
      const priceFit = 1 - p.price / unitBudget;
      const score = +(0.5 + certBoost + priceFit * 0.3).toFixed(3);
      candidates.push({
        requestId: request.id,
        productId: p.id,
        matchScore: score,
        reason: `인증 ${p.certifications.length}종, 단가 적합`,
      });
    }
    return candidates.sort((a, b) => b.matchScore - a.matchScore);
  }

  /** FR-GP.3 의무비율 추적 */
  trackCompliance(purchases: { productId: string; amount: number }[], targetRatio: number): ComplianceStatus {
    let total = 0;
    let green = 0;
    for (const p of purchases) {
      total += p.amount;
      const product = this.catalog.get(p.productId);
      if (product && product.certifications.length > 0) green += p.amount;
    }
    const ratio = total === 0 ? 0 : +(green / total).toFixed(3);
    return { totalSpent: total, greenSpent: green, ratio, targetRatio, achieved: ratio >= targetRatio };
  }

  /** FR-GP.4 인증 만료 알림 */
  findExpiring(withinDays: number, today: Date): CertifiedProduct[] {
    const threshold = new Date(today.getTime() + withinDays * 86400000).toISOString().slice(0, 10);
    const out: CertifiedProduct[] = [];
    for (const p of this.catalog.values()) {
      if (p.expiresAt <= threshold && p.expiresAt >= today.toISOString().slice(0, 10)) out.push(p);
    }
    return out;
  }

  /** FR-GP.5 대체품 추천 */
  findAlternatives(expiredProductId: string, today: Date): CertifiedProduct[] {
    const expired = this.catalog.get(expiredProductId);
    if (!expired) return [];
    const todayStr = today.toISOString().slice(0, 10);
    return Array.from(this.catalog.values()).filter(
      (p) => p.id !== expiredProductId && p.category === expired.category && p.expiresAt >= todayStr,
    );
  }
}

export const greenProcurementAi = new GreenProcurementAi();
