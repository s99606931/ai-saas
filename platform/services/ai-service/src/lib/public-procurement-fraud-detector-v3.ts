// Design Ref: SVC-AI-ADV-R665.design.md — AI기반 공공조달 사기 탐지 v3
// Plan SC: FR-R665.1~5

import { createHash } from 'crypto';

export type FraudRisk = 'LOW' | 'MID' | 'HIGH';

interface BidRecord {
  bidder: string;
  amount: number;
  ip: string;
  wins: number;
}
interface FraudResult {
  maskedBidder: string;
  suspicionScore: number;
  risk: FraudRisk;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

function mask(v: string): string {
  return createHash('sha256').update(v).digest('hex').substring(0, 16);
}

export class PublicProcurementFraudDetectorV3 {
  private auditLog: AuditEntry[] = [];

  analyze(bids: BidRecord[], dataGrade?: string): FraudResult[] {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    if (bids.length === 0) return [];

    const avg = bids.reduce((s, b) => s + b.amount, 0) / bids.length;
    const ipCounts = new Map<string, number>();
    for (const b of bids) {
      ipCounts.set(b.ip, (ipCounts.get(b.ip) ?? 0) + 1);
    }

    const results: FraudResult[] = bids.map((b) => {
      const deviation = avg > 0 ? Math.min(Math.abs(b.amount - avg) / avg, 1) : 0;
      const ipShare = ((ipCounts.get(b.ip) ?? 1) - 1) / Math.max(bids.length - 1, 1);
      const winRate = Math.min(b.wins / 10, 1);
      const score = 0.4 * deviation + 0.3 * ipShare + 0.3 * winRate;
      const risk: FraudRisk = score >= 0.7 ? 'HIGH' : score >= 0.4 ? 'MID' : 'LOW';
      return {
        maskedBidder: mask(b.bidder),
        suspicionScore: Number(score.toFixed(4)),
        risk,
      };
    });

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ANALYZE_BIDS',
      details: { count: bids.length, highCount: results.filter((r) => r.risk === 'HIGH').length },
    });
    return results;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
