// Design Ref: MTU-N416 §API 마켓플레이스
// Plan SC: FR-N416.1~5

export interface APIListing {
  apiId: string;
  publisherId: string;
  name: string;
  category: string;
  baseUrl: string;
  openapiVersion: string;
  endpoints: Array<{ path: string; method: string }>;
  status: 'draft' | 'review' | 'approved' | 'suspended';
}

export type PlanKind = 'free' | 'payg' | 'subscription';
export interface PricingPlan {
  planId: string;
  apiId: string;
  kind: PlanKind;
  monthlyFee?: number;
  unitPrice?: number;
  freeQuota?: number;
  rateLimitPerMin?: number;
}

export interface UsageRecord {
  apiId: string;
  consumerId: string;
  planId: string;
  calls: number;
  periodStart: string;
  periodEnd: string;
}

export interface Review {
  apiId: string;
  consumerId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  createdAt: string;
}

export class APIMarketplace {
  /** FR-N416.1 등록 + OpenAPI 검증 */
  register(listing: Omit<APIListing, 'status'>): APIListing {
    if (!listing.openapiVersion.startsWith('3.')) {
      throw new Error('OpenAPI 3.x 필요');
    }
    if (listing.endpoints.length === 0) {
      throw new Error('엔드포인트 최소 1개 필요');
    }
    try {
      new URL(listing.baseUrl);
    } catch {
      throw new Error('baseUrl 형식 오류');
    }
    return { ...listing, status: 'review' };
  }

  /** FR-N416.2 플랜 등록 검증 */
  createPlan(plan: PricingPlan): PricingPlan {
    if (plan.kind === 'subscription' && (plan.monthlyFee ?? 0) <= 0) {
      throw new Error('구독 플랜은 monthlyFee 필수');
    }
    if (plan.kind === 'payg' && (plan.unitPrice ?? 0) <= 0) {
      throw new Error('종량 플랜은 unitPrice 필수');
    }
    return plan;
  }

  /** FR-N416.3 요금 계산 */
  computeCharge(usage: UsageRecord, plan: PricingPlan): {
    base: number;
    usageCharge: number;
    total: number;
  } {
    const base = plan.kind === 'subscription' ? plan.monthlyFee ?? 0 : 0;
    let usageCharge = 0;
    if (plan.kind === 'payg') {
      const billable = Math.max(0, usage.calls - (plan.freeQuota ?? 0));
      usageCharge = billable * (plan.unitPrice ?? 0);
    } else if (plan.kind === 'free') {
      if (usage.calls > (plan.freeQuota ?? 0)) {
        throw new Error('무료 플랜 한도 초과');
      }
    }
    return {
      base,
      usageCharge: +usageCharge.toFixed(2),
      total: +(base + usageCharge).toFixed(2),
    };
  }

  /** FR-N416.4 평점 집계 */
  aggregateReviews(reviews: Review[]): { count: number; avg: number; distribution: Record<string, number> } {
    const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    let sum = 0;
    for (const r of reviews) {
      distribution[String(r.rating)] = (distribution[String(r.rating)] ?? 0) + 1;
      sum += r.rating;
    }
    return {
      count: reviews.length,
      avg: reviews.length > 0 ? +(sum / reviews.length).toFixed(2) : 0,
      distribution,
    };
  }

  /** FR-N416.5 수익 분배 (플랫폼 수수료 공제 후 퍼블리셔 지급) */
  settleRevenue(
    usages: UsageRecord[],
    plans: PricingPlan[],
    listings: APIListing[],
    platformFeeRate = 0.15,
  ): Array<{ publisherId: string; gross: number; platformFee: number; net: number }> {
    const perPublisher = new Map<string, number>();
    for (const u of usages) {
      const plan = plans.find((p) => p.planId === u.planId);
      const listing = listings.find((l) => l.apiId === u.apiId);
      if (!plan || !listing) continue;
      const charge = this.computeCharge(u, plan).total;
      perPublisher.set(listing.publisherId, (perPublisher.get(listing.publisherId) ?? 0) + charge);
    }
    return Array.from(perPublisher.entries()).map(([publisherId, gross]) => {
      const fee = +(gross * platformFeeRate).toFixed(2);
      return {
        publisherId,
        gross: +gross.toFixed(2),
        platformFee: fee,
        net: +(gross - fee).toFixed(2),
      };
    });
  }
}

export const apiMarketplace = new APIMarketplace();
