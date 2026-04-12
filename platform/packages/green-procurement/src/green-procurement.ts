// Design Ref: MTU-N454 §green-procurement
// Plan SC: FR-GP.1 ~ FR-GP.5
//
// 녹색구매 인증 제품 DB + 매칭 + 의무비율 추적.
// 매칭은 Jaccard 유사도 (카테고리 토큰) + 이름 부분 일치.
// 외부 AI API 호출 없음 — 로컬 인덱스 기반 순수 검색.

export type CertType = 'ENV_MARK' | 'GR' | 'LOW_CARBON' | 'RECYCLED';

export interface CertifiedProduct {
  id: string;
  name: string;
  category: string;
  certType: CertType;
  certNumber: string;
  validUntil: string; // ISO date
  manufacturer: string;
  tags: string[];
}

export interface PurchaseRequest {
  id: string;
  name: string;
  category: string;
  keywords?: string[];
  budgetKrw: number;
}

export interface MatchResult {
  request: PurchaseRequest;
  matches: Array<{ product: CertifiedProduct; score: number }>;
}

export interface ObligationStatus {
  totalBudgetKrw: number;
  greenBudgetKrw: number;
  ratio: number;
  targetRatio: number;
  achieved: boolean;
  gapKrw: number;
}

// FR-GP.1: 인증 제품 DB (in-memory registry)
export class CertifiedProductRegistry {
  private products: Map<string, CertifiedProduct> = new Map();
  private byCategory: Map<string, Set<string>> = new Map();

  register(product: CertifiedProduct): void {
    this.products.set(product.id, product);
    if (!this.byCategory.has(product.category)) {
      this.byCategory.set(product.category, new Set());
    }
    this.byCategory.get(product.category)!.add(product.id);
  }

  get(id: string): CertifiedProduct | undefined {
    return this.products.get(id);
  }

  byCategoryList(category: string): CertifiedProduct[] {
    const ids = this.byCategory.get(category) ?? new Set<string>();
    return Array.from(ids)
      .map((id) => this.products.get(id))
      .filter((p): p is CertifiedProduct => p !== undefined);
  }

  size(): number {
    return this.products.size;
  }

  // FR-GP.4: 인증 만료 알림
  findExpiring(now: Date, windowDays: number): CertifiedProduct[] {
    const threshold = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);
    const result: CertifiedProduct[] = [];
    for (const p of this.products.values()) {
      const until = new Date(p.validUntil);
      if (until <= threshold) {
        result.push(p);
      }
    }
    return result;
  }
}

// FR-GP.2: 구매 요청 매칭
export class GreenMatcher {
  constructor(private registry: CertifiedProductRegistry) {}

  match(request: PurchaseRequest, topK: number = 5, now: Date = new Date()): MatchResult {
    const candidates = this.registry.byCategoryList(request.category);
    const scored = candidates
      .filter((p) => new Date(p.validUntil) > now) // 만료 제품 제외
      .map((p) => ({ product: p, score: this.score(request, p) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return { request, matches: scored };
  }

  // FR-GP.5: 대체품 추천 — 요청 키워드와 tag Jaccard
  suggestAlternatives(
    request: PurchaseRequest,
    excludeId: string,
    topK: number = 3,
  ): CertifiedProduct[] {
    const result = this.match(request, topK + 1);
    return result.matches
      .filter((m) => m.product.id !== excludeId)
      .slice(0, topK)
      .map((m) => m.product);
  }

  private score(req: PurchaseRequest, product: CertifiedProduct): number {
    const reqTokens = new Set(
      [req.name, ...(req.keywords ?? [])]
        .flatMap((t) => t.toLowerCase().split(/\s+/))
        .filter(Boolean),
    );
    const prodTokens = new Set(
      [product.name, ...product.tags]
        .flatMap((t) => t.toLowerCase().split(/\s+/))
        .filter(Boolean),
    );
    if (reqTokens.size === 0 || prodTokens.size === 0) return 0;
    let inter = 0;
    for (const t of reqTokens) if (prodTokens.has(t)) inter++;
    const union = reqTokens.size + prodTokens.size - inter;
    const jaccard = union === 0 ? 0 : inter / union;

    // 저탄소 인증 가산점
    const certBonus = product.certType === 'LOW_CARBON' ? 0.15 : 0;
    return round4(Math.min(1, jaccard + certBonus));
  }
}

// FR-GP.3: 의무비율 달성률 추적
export class ObligationTracker {
  constructor(private targetRatio: number = 0.2) {}

  compute(purchases: Array<{ amountKrw: number; isGreen: boolean }>): ObligationStatus {
    let total = 0;
    let green = 0;
    for (const p of purchases) {
      total += p.amountKrw;
      if (p.isGreen) green += p.amountKrw;
    }
    const ratio = total === 0 ? 0 : green / total;
    const gap = Math.max(0, this.targetRatio * total - green);
    return {
      totalBudgetKrw: total,
      greenBudgetKrw: green,
      ratio: round4(ratio),
      targetRatio: this.targetRatio,
      achieved: ratio >= this.targetRatio,
      gapKrw: Math.round(gap),
    };
  }
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
