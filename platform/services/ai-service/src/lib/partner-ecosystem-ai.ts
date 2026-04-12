// Design Ref: MTU-N417 §파트너 에코시스템 AI
// Plan SC: FR-N417.1~5

export interface Partner {
  partnerId: string;
  name: string;
  joinedAt: string;
  revenueYTD: number;
  dealsClosed: number;
  csatScore: number;
  certifications: number;
}

export type PartnerTier = 'platinum' | 'gold' | 'silver' | 'bronze';

export interface Lead {
  leadId: string;
  region: string;
  industry: string;
  size: 'small' | 'medium' | 'large';
  createdAt: string;
}

export class PartnerEcosystemAI {
  /** FR-N417.1 파트너 등급 */
  calculateTier(p: Partner): PartnerTier {
    const score =
      Math.min(100, p.revenueYTD / 1_000_000) * 0.5 +
      Math.min(100, p.dealsClosed * 2) * 0.2 +
      p.csatScore * 0.2 +
      Math.min(100, p.certifications * 10) * 0.1;
    if (score >= 85) return 'platinum';
    if (score >= 70) return 'gold';
    if (score >= 50) return 'silver';
    return 'bronze';
  }

  /** FR-N417.2 리드 할당 (라운드로빈 + 등급 가중) */
  assignLead(lead: Lead, partners: Partner[]): string | null {
    if (partners.length === 0) return null;
    const tierWeight: Record<PartnerTier, number> = {
      platinum: 4,
      gold: 3,
      silver: 2,
      bronze: 1,
    };
    const scored = partners.map((p) => ({
      p,
      weight: tierWeight[this.calculateTier(p)] * (lead.size === 'large' ? 2 : 1),
    }));
    scored.sort((a, b) => b.weight - a.weight);
    return scored[0]!.p.partnerId;
  }

  /** FR-N417.3 이탈 예측 */
  predictChurn(p: Partner, recentActivityDays: number): {
    churnProbability: number;
    risk: 'low' | 'med' | 'high';
  } {
    let score = 0;
    if (recentActivityDays > 90) score += 0.4;
    else if (recentActivityDays > 60) score += 0.25;
    else if (recentActivityDays > 30) score += 0.1;
    if (p.dealsClosed < 2) score += 0.2;
    if (p.csatScore < 70) score += 0.2;
    if (p.revenueYTD < 1_000_000) score += 0.1;
    const prob = Math.min(1, +score.toFixed(2));
    const risk = prob >= 0.6 ? 'high' : prob >= 0.3 ? 'med' : 'low';
    return { churnProbability: prob, risk };
  }

  /** FR-N417.4 인센티브 계산 */
  calculateIncentive(p: Partner, rateByTier: Record<PartnerTier, number> = {
    platinum: 0.15,
    gold: 0.1,
    silver: 0.07,
    bronze: 0.05,
  }): number {
    const tier = this.calculateTier(p);
    return +(p.revenueYTD * rateByTier[tier]).toFixed(0);
  }

  /** FR-N417.5 에코시스템 건강도 */
  ecosystemHealth(partners: Partner[]): {
    totalPartners: number;
    activeRate: number;
    avgCsat: number;
    tierDistribution: Record<PartnerTier, number>;
    healthScore: number;
  } {
    if (partners.length === 0) {
      return {
        totalPartners: 0,
        activeRate: 0,
        avgCsat: 0,
        tierDistribution: { platinum: 0, gold: 0, silver: 0, bronze: 0 },
        healthScore: 0,
      };
    }
    const active = partners.filter((p) => p.dealsClosed > 0).length;
    const avgCsat = partners.reduce((s, p) => s + p.csatScore, 0) / partners.length;
    const dist: Record<PartnerTier, number> = {
      platinum: 0,
      gold: 0,
      silver: 0,
      bronze: 0,
    };
    for (const p of partners) dist[this.calculateTier(p)]++;
    const activeRate = active / partners.length;
    const healthScore = +(
      activeRate * 0.4 +
      (avgCsat / 100) * 0.4 +
      ((dist.platinum + dist.gold) / partners.length) * 0.2
    ).toFixed(3);
    return {
      totalPartners: partners.length,
      activeRate: +activeRate.toFixed(3),
      avgCsat: +avgCsat.toFixed(1),
      tierDistribution: dist,
      healthScore,
    };
  }
}

export const partnerEcosystemAI = new PartnerEcosystemAI();
