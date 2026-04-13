// SVC-AI-ADV-R477 Government Procurement AI Advisor
// Design Ref: SVC-AI-ADV-R477.design.md §정부조달
// Plan SC: FR-477.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface Bid {
  readonly bidderId: string;
  readonly priceKrw: number;
  readonly technicalScore: number; // 0..100
  readonly deliveryDays: number;
  readonly pastPerformance: number; // 0..100
  readonly smallBusiness: boolean;
}

export interface BidEvaluation {
  readonly bidderId: string;
  readonly totalScore: number;
  readonly priceScore: number;
  readonly rank: number;
  readonly recommended: boolean;
}

interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly details: Record<string, unknown>;
}

function block(grade: DataGrade): void {
  if (grade === 'C' || grade === 'S') {
    throw new Error(`N2SF_BLOCKED: ${grade}등급 조달 데이터 차단 (N2SF N-05)`);
  }
}

export class GovProcurementAiAdvisor {
  private readonly auditLog: AuditEntry[] = [];

  evaluateBids(
    bids: readonly Bid[],
    estimatedPrice: number,
    grade: DataGrade = 'O',
  ): readonly BidEvaluation[] {
    block(grade);

    if (bids.length === 0) return [];

    const minPrice = Math.min(...bids.map((b) => b.priceKrw));

    const scored = bids.map((b) => {
      const priceScore = minPrice === 0 ? 0 : Math.round((minPrice / Math.max(1, b.priceKrw)) * 40);
      const tech = (b.technicalScore / 100) * 40;
      const perf = (b.pastPerformance / 100) * 15;
      const smallBonus = b.smallBusiness ? 5 : 0;
      const total = Number((priceScore + tech + perf + smallBonus).toFixed(2));
      const withinBudget = b.priceKrw <= estimatedPrice * 1.1;

      return {
        bidderId: b.bidderId,
        totalScore: total,
        priceScore,
        withinBudget,
      };
    });

    scored.sort((a, b) => b.totalScore - a.totalScore);

    const evaluations: BidEvaluation[] = scored.map((s, idx) => ({
      bidderId: s.bidderId,
      totalScore: s.totalScore,
      priceScore: s.priceScore,
      rank: idx + 1,
      recommended: idx === 0 && s.withinBudget,
    }));

    this.appendAudit('BID_EVALUATE', {
      count: bids.length,
      topBidder: evaluations[0]?.bidderId,
    });

    return evaluations;
  }

  checkCompliance(bid: Bid): readonly string[] {
    const issues: string[] = [];
    if (bid.priceKrw <= 0) issues.push('invalid_price');
    if (bid.technicalScore < 60) issues.push('technical_below_threshold');
    if (bid.deliveryDays > 365) issues.push('excessive_delivery');
    this.appendAudit('BID_COMPLIANCE', { bidderId: bid.bidderId, issues });
    return issues;
  }

  getAuditLog(): readonly AuditEntry[] {
    return [...this.auditLog];
  }

  private appendAudit(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      details,
    });
  }
}
