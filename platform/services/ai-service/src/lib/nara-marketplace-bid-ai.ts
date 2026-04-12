// Design Ref: MTU-N436 §나라장터 입찰 AI
// Plan SC: FR-N436.1~5

export interface BidNotice {
  noticeId: string;
  title: string;
  category: string;
  budgetKrw: number;
  requiredLicenses: string[];
  requiredExperienceYears: number;
  closingDate: string;
  rawText: string;
}

export interface AgencyProfile {
  agencyId: string;
  specialties: string[];
  licenses: string[];
  experienceYears: number;
  maxBudgetKrw: number;
}

export interface FitScore {
  noticeId: string;
  score: number;
  reasons: string[];
}

export interface EligibilityCheck {
  noticeId: string;
  eligible: boolean;
  missing: string[];
}

export interface CompetitionEstimate {
  noticeId: string;
  estimatedBidders: number;
  confidence: number;
}

export interface BidRecommendation {
  noticeId: string;
  title: string;
  fit: number;
  eligible: boolean;
  competition: number;
  decision: 'recommend' | 'review' | 'skip';
}

export class NaraMarketplaceBidAi {
  /** FR-N436.1 공고 정규화 */
  normalizeNotices(raw: BidNotice[]): BidNotice[] {
    return raw.filter((n) => n.noticeId && n.budgetKrw > 0);
  }

  /** FR-N436.2 적합도 점수 */
  scoreFit(notice: BidNotice, agency: AgencyProfile): FitScore {
    const reasons: string[] = [];
    let score = 0;
    const textLower = `${notice.title} ${notice.category} ${notice.rawText}`.toLowerCase();
    const specMatches = agency.specialties.filter((s) => textLower.includes(s.toLowerCase()));
    if (specMatches.length > 0) {
      score += 0.4 * (specMatches.length / agency.specialties.length);
      reasons.push(`전문 분야 매칭: ${specMatches.join(', ')}`);
    }
    if (notice.budgetKrw <= agency.maxBudgetKrw) {
      score += 0.2;
      reasons.push('예산 규모 적합');
    }
    if (agency.experienceYears >= notice.requiredExperienceYears) {
      score += 0.2;
      reasons.push('경력 요건 충족');
    }
    const licenseMatches = notice.requiredLicenses.filter((l) => agency.licenses.includes(l));
    if (licenseMatches.length === notice.requiredLicenses.length) {
      score += 0.2;
      reasons.push('면허 전부 보유');
    }
    return { noticeId: notice.noticeId, score: +score.toFixed(3), reasons };
  }

  /** FR-N436.3 필수 요건 충족 여부 */
  checkEligibility(notice: BidNotice, agency: AgencyProfile): EligibilityCheck {
    const missing: string[] = [];
    for (const lic of notice.requiredLicenses) {
      if (!agency.licenses.includes(lic)) missing.push(`면허:${lic}`);
    }
    if (agency.experienceYears < notice.requiredExperienceYears) {
      missing.push(`경력:${notice.requiredExperienceYears}년 필요`);
    }
    return { noticeId: notice.noticeId, eligible: missing.length === 0, missing };
  }

  /** FR-N436.4 경쟁 강도 예측 */
  estimateCompetition(notice: BidNotice, historicalAvgBidders: number): CompetitionEstimate {
    const budgetFactor = Math.log10(Math.max(1, notice.budgetKrw / 10_000_000));
    const base = historicalAvgBidders * (1 + budgetFactor * 0.1);
    return {
      noticeId: notice.noticeId,
      estimatedBidders: Math.round(base),
      confidence: 0.75,
    };
  }

  /** FR-N436.5 추천 리포트 */
  recommend(
    notices: BidNotice[],
    agency: AgencyProfile,
    historicalAvgBidders = 5,
  ): BidRecommendation[] {
    return notices.map((n) => {
      const fit = this.scoreFit(n, agency);
      const elig = this.checkEligibility(n, agency);
      const comp = this.estimateCompetition(n, historicalAvgBidders);
      let decision: BidRecommendation['decision'] = 'skip';
      if (elig.eligible && fit.score >= 0.6) decision = 'recommend';
      else if (elig.eligible && fit.score >= 0.4) decision = 'review';
      return {
        noticeId: n.noticeId,
        title: n.title,
        fit: fit.score,
        eligible: elig.eligible,
        competition: comp.estimatedBidders,
        decision,
      };
    });
  }
}

export const naraMarketplaceBidAi = new NaraMarketplaceBidAi();
