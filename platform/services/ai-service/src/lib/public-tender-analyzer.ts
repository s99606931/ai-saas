// SVC-AI-ADV-R360 Public Tender Analyzer
// Design Ref: SVC-AI-ADV-R360.design.md
// Plan SC: SC-R360-1~4
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface TenderRecord {
  readonly id: string;
  readonly winner: string;
  readonly bidAmount: number;
}

export interface TenderAnalysis {
  readonly count: number;
  readonly avgBid: number;
  readonly variance: number;
  readonly collusionScore: number;
  readonly suspect: boolean;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class PublicTenderAnalyzer {
  private readonly auditLog: AuditEntry[] = [];

  analyze(tenders: readonly TenderRecord[], grade: DataGrade = 'O'): TenderAnalysis {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 입찰 데이터 차단 (N2SF N-05)`);
    }
    if (tenders.length === 0) {
      throw new Error('INVALID_PARAMS: empty tenders');
    }

    const bids = tenders.map((t) => t.bidAmount);
    const avg = bids.reduce((a, b) => a + b, 0) / bids.length;
    const variance =
      bids.reduce((s, b) => s + (b - avg) ** 2, 0) / bids.length;

    const winnerCounts = new Map<string, number>();
    for (const t of tenders) {
      winnerCounts.set(t.winner, (winnerCounts.get(t.winner) ?? 0) + 1);
    }
    const maxRepeat = Math.max(...Array.from(winnerCounts.values()));
    const repeatRatio = maxRepeat / tenders.length;

    const cv = avg > 0 ? Math.sqrt(variance) / avg : 0;
    const lowVariance = Math.max(0, 1 - Math.min(1, cv * 10));

    const collusionScore = Number(
      (repeatRatio * 0.5 + lowVariance * 0.5).toFixed(4),
    );
    const suspect = collusionScore >= 0.6;

    const result: TenderAnalysis = {
      count: tenders.length,
      avgBid: Number(avg.toFixed(2)),
      variance: Number(variance.toFixed(2)),
      collusionScore,
      suspect,
    };

    this.record('ANALYZE', 'tenders', {
      count: tenders.length,
      collusionScore,
      suspect,
    });

    return result;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private record(action: string, target: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      target,
      details,
    });
  }
}
