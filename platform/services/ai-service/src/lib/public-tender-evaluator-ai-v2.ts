// Design Ref: SVC-AI-ADV-R701.design.md — AI기반 공공 입찰 평가 자동화 v2
// Plan SC: FR-R701.1~5

import { createHash } from 'crypto';

export type TenderGrade = 'PASS' | 'BORDER' | 'FAIL';

interface Criterion { criterionId: string; weight: number }
interface BidInput {
  bidId: string;
  bizRegNo: string;
  scores: Record<string, number>;
}
interface BidVerdict {
  bidId: string;
  maskedBizRegNo: string;
  totalScore: number;
  grade: TenderGrade;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

function maskId(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

export class PublicTenderEvaluatorAIV2 {
  private criteria = new Map<string, Criterion>();
  private verdicts: BidVerdict[] = [];
  private auditLog: AuditEntry[] = [];

  addCriterion(c: Criterion): void {
    if (c.weight <= 0 || c.weight > 1) throw new Error('INVALID_WEIGHT');
    const current = Array.from(this.criteria.values()).reduce((s, x) => s + x.weight, 0);
    if (current + c.weight > 1.0 + 1e-9) throw new Error('WEIGHT_OVERFLOW');
    this.criteria.set(c.criterionId, c);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ADD_CRITERION',
      details: { criterionId: c.criterionId, weight: c.weight },
    });
  }

  submitBid(bid: BidInput, dataGrade?: string): BidVerdict {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    if (this.criteria.size === 0) throw new Error('NO_CRITERIA');
    let total = 0;
    for (const [cid, crit] of this.criteria.entries()) {
      const raw = bid.scores[cid];
      if (raw === undefined) throw new Error(`MISSING_SCORE: ${cid}`);
      if (raw < 0 || raw > 100) throw new Error('INVALID_SCORE');
      total += raw * crit.weight;
    }
    const grade: TenderGrade = total >= 80 ? 'PASS' : total >= 60 ? 'BORDER' : 'FAIL';
    const maskedBizRegNo = maskId(bid.bizRegNo);
    const verdict: BidVerdict = { bidId: bid.bidId, maskedBizRegNo, totalScore: Math.round(total * 100) / 100, grade };
    this.verdicts.push(verdict);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'SUBMIT_BID',
      details: { bidId: bid.bidId, maskedBizRegNo, totalScore: verdict.totalScore, grade },
    });
    return verdict;
  }

  rank(topN: number): BidVerdict[] {
    return [...this.verdicts].sort((a, b) => b.totalScore - a.totalScore).slice(0, topN);
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
