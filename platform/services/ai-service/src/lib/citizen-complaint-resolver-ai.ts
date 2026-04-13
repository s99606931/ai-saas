// SVC-AI-ADV-R457 민원 자동 해결 제안 AI
// Design Ref: SVC-AI-ADV-R457.design.md
// Plan SC: FR-457.1~6
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface FAQ {
  readonly id: string;
  readonly keywords: readonly string[];
  readonly solution: string;
}

export interface ResolveResult {
  readonly matched: boolean;
  readonly faqId?: string;
  readonly score?: number;
  readonly recommendation: string;
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class CitizenComplaintResolverAI {
  private readonly auditLog: AuditEntry[] = [];

  resolve(
    complaintText: string,
    faqs: readonly FAQ[],
    grade: DataGrade = 'O',
  ): ResolveResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 민원 데이터 차단 (N2SF N-05)`);
    }
    if (!complaintText) throw new Error('EMPTY_COMPLAINT');

    const tokens = new Set(
      complaintText.toLowerCase().split(/\s+/).filter((t) => t.length > 0),
    );

    let bestScore = 0;
    let bestFaq: FAQ | undefined;
    for (const faq of faqs) {
      if (faq.keywords.length === 0) continue;
      let hits = 0;
      for (const k of faq.keywords) {
        if (tokens.has(k.toLowerCase())) hits += 1;
      }
      const score = hits / faq.keywords.length;
      if (score > bestScore) {
        bestScore = score;
        bestFaq = faq;
      }
    }

    if (bestFaq && bestScore >= 0.5) {
      this.record('RESOLVE', bestFaq.id, { score: bestScore });
      return {
        matched: true,
        faqId: bestFaq.id,
        score: Math.round(bestScore * 1000) / 1000,
        recommendation: bestFaq.solution,
      };
    }

    this.record('RESOLVE', 'none', { score: bestScore });
    return { matched: false, recommendation: 'HUMAN_REVIEW' };
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
