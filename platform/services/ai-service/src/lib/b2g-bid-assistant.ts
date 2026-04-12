// Design Ref: MTU-N420 §B2G 입찰 어시스턴트
// Plan SC: FR-N420.1~5

export interface BidNotice {
  noticeId: string;
  title: string;
  agency: string;
  budget: number;
  durationMonths: number;
  deadline: string;
  requirements: string[];
  evaluationCriteria: Array<{ name: string; weight: number }>;
}

export interface CompanyProfile {
  companyId: string;
  capabilities: string[];
  pastWins: number;
  avgContractSize: number;
  certifications: string[];
  csapLevel?: 'basic' | 'standard' | 'advanced';
}

export interface FitScore {
  noticeId: string;
  companyId: string;
  score: number;
  matchedRequirements: string[];
  missingRequirements: string[];
}

export class B2GBidAssistant {
  /** FR-N420.1 공고문 파싱 (간이 규칙 기반) */
  parseNotice(rawText: string, noticeId: string): Partial<BidNotice> {
    const budgetMatch = rawText.match(/예산[:\s]*([\d,]+)\s*원/);
    const durationMatch = rawText.match(/(\d+)\s*개월/);
    const deadlineMatch = rawText.match(/(\d{4}-\d{2}-\d{2})/);
    const requirements: string[] = [];
    const reqLines = rawText.match(/자격[^:]*:\s*([^\n]+)/g);
    if (reqLines) {
      for (const line of reqLines) {
        const parts = line.split(':')[1];
        if (parts) requirements.push(...parts.split(/[,、]/).map((s) => s.trim()).filter(Boolean));
      }
    }
    const result: Partial<BidNotice> = {
      noticeId,
      requirements,
    };
    if (budgetMatch?.[1]) result.budget = parseInt(budgetMatch[1].replaceAll(',', ''), 10);
    if (durationMatch?.[1]) result.durationMonths = parseInt(durationMatch[1], 10);
    if (deadlineMatch?.[1]) result.deadline = deadlineMatch[1];
    return result;
  }

  /** FR-N420.2 적합도 */
  calculateFit(notice: BidNotice, company: CompanyProfile): FitScore {
    const matched: string[] = [];
    const missing: string[] = [];
    for (const req of notice.requirements) {
      const hit = company.capabilities.some((c) => req.includes(c) || c.includes(req)) ||
        company.certifications.some((c) => req.includes(c));
      if (hit) matched.push(req);
      else missing.push(req);
    }
    const reqScore = notice.requirements.length > 0
      ? matched.length / notice.requirements.length
      : 1;
    const sizeScore = company.avgContractSize > 0
      ? Math.min(1, company.avgContractSize / Math.max(1, notice.budget))
      : 0.5;
    const score = +(reqScore * 0.7 + sizeScore * 0.3).toFixed(3);
    return {
      noticeId: notice.noticeId,
      companyId: company.companyId,
      score,
      matchedRequirements: matched,
      missingRequirements: missing,
    };
  }

  /** FR-N420.3 경쟁 수준 예측 */
  predictCompetition(notice: BidNotice): { level: 'low' | 'med' | 'high'; expectedBidders: number } {
    let expected = 3;
    if (notice.budget > 1_000_000_000) expected += 5;
    else if (notice.budget > 500_000_000) expected += 3;
    if (notice.durationMonths >= 12) expected += 2;
    if (notice.requirements.length < 3) expected += 3;
    const level = expected >= 10 ? 'high' : expected >= 6 ? 'med' : 'low';
    return { level, expectedBidders: expected };
  }

  /** FR-N420.4 낙찰 확률 */
  winProbability(fit: FitScore, competition: { expectedBidders: number }, pastWins: number): number {
    const base = fit.score;
    const competitionFactor = 1 / Math.max(1, competition.expectedBidders * 0.6);
    const experienceBonus = Math.min(0.2, pastWins * 0.02);
    return +Math.min(0.95, base * competitionFactor + experienceBonus).toFixed(3);
  }

  /** FR-N420.5 제안서 체크리스트 */
  buildChecklist(notice: BidNotice, fit: FitScore): string[] {
    const items: string[] = [
      '사업자등록증 사본',
      '법인인감증명서',
      '재무제표 최근 3년',
      `${notice.agency} 양식 제안서`,
      '수행 인력 이력서',
      '유사 사업 실적 증명서',
    ];
    for (const missing of fit.missingRequirements) {
      items.push(`미충족 요건 대응 방안: ${missing}`);
    }
    for (const crit of notice.evaluationCriteria) {
      items.push(`평가항목 대응: ${crit.name} (가중치 ${crit.weight})`);
    }
    return items;
  }
}

export const b2gBidAssistant = new B2GBidAssistant();
