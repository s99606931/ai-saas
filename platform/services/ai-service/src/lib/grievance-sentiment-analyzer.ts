// Design Ref: §R167 AI기반공공민원감정분석
// Plan SC: FR-R167.1~5

export type SentimentLabel = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'URGENT';

export interface GrievanceRecord {
  id: string;
  tenantId: string;
  submittedAt: string;
  content: string;
  category: string;
}

export interface SentimentResult {
  grievanceId: string;
  sentiment: SentimentLabel;
  score: number; // 0~1 (1=가장 강함)
  keywords: string[];
  urgencyFlag: boolean;
  analysisAt: string;
}

export interface TrendReport {
  period: string;
  total: number;
  bySentiment: Record<SentimentLabel, number>;
  urgentCount: number;
  topCategories: Array<{ category: string; count: number }>;
}

export interface AuditEntry {
  action: string;
  grievanceId?: string;
  tenantId?: string;
  timestamp: string;
}

// FR-R167.1 민원 텍스트 감정 분류
export class GrievanceSentimentAnalyzer {
  private results = new Map<string, SentimentResult>();
  private grievances = new Map<string, GrievanceRecord>();
  private auditLog: AuditEntry[] = [];

  // 감정 키워드 사전 (공공민원 도메인)
  private readonly negativeKeywords = ['불만', '항의', '시정', '지연', '불편', '문제', '오류', '실망', '화남'];
  private readonly urgentKeywords = ['즉시', '긴급', '위험', '사고', '법적', '고발', '민원'];
  private readonly positiveKeywords = ['감사', '만족', '잘', '훌륭', '도움', '친절', '빠른'];

  /** FR-R167.1 민원 등록 */
  register(record: GrievanceRecord): void {
    this.grievances.set(record.id, record);
    this.auditLog.push({
      action: 'GRIEVANCE_REGISTERED',
      grievanceId: record.id,
      tenantId: record.tenantId,
      timestamp: new Date().toISOString(),
    });
  }

  /** FR-R167.2 감정 분석 */
  analyze(grievanceId: string): SentimentResult {
    const g = this.grievances.get(grievanceId);
    if (!g) throw new Error(`민원 ${grievanceId} 없음`);

    const text = g.content;
    const posScore = this.countKeywords(text, this.positiveKeywords);
    const negScore = this.countKeywords(text, this.negativeKeywords);
    const urgentScore = this.countKeywords(text, this.urgentKeywords);

    const urgencyFlag = urgentScore > 0;
    let sentiment: SentimentLabel;
    let score: number;

    if (urgencyFlag && negScore > 0) {
      sentiment = 'URGENT';
      score = Math.min(1, (urgentScore + negScore) / 6);
    } else if (negScore > posScore) {
      sentiment = 'NEGATIVE';
      score = Math.min(1, negScore / 5);
    } else if (posScore > negScore) {
      sentiment = 'POSITIVE';
      score = Math.min(1, posScore / 5);
    } else {
      sentiment = 'NEUTRAL';
      score = 0.5;
    }

    const keywords = [
      ...this.extractKeywords(text, this.urgentKeywords),
      ...this.extractKeywords(text, this.negativeKeywords),
      ...this.extractKeywords(text, this.positiveKeywords),
    ].slice(0, 5);

    const result: SentimentResult = {
      grievanceId,
      sentiment,
      score: +score.toFixed(3),
      keywords,
      urgencyFlag,
      analysisAt: new Date().toISOString(),
    };

    this.results.set(grievanceId, result);

    // FR-R167.5 감사 로그 (CSAP D-06)
    this.auditLog.push({
      action: 'SENTIMENT_ANALYZED',
      grievanceId,
      tenantId: g.tenantId,
      timestamp: new Date().toISOString(),
    });

    return result;
  }

  /** FR-R167.3 긴급 민원 목록 */
  getUrgent(): SentimentResult[] {
    return Array.from(this.results.values()).filter((r) => r.urgencyFlag);
  }

  /** FR-R167.4 기간별 트렌드 리포트 */
  getTrend(tenantId: string, period: string): TrendReport {
    const relevant = Array.from(this.grievances.values()).filter(
      (g) => g.tenantId === tenantId
    );

    const bySentiment: Record<SentimentLabel, number> = {
      POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0, URGENT: 0,
    };

    let urgentCount = 0;
    const categoryCount = new Map<string, number>();

    for (const g of relevant) {
      const r = this.results.get(g.id);
      if (r) {
        bySentiment[r.sentiment]++;
        if (r.urgencyFlag) urgentCount++;
      }
      categoryCount.set(g.category, (categoryCount.get(g.category) ?? 0) + 1);
    }

    const topCategories = Array.from(categoryCount.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      period,
      total: relevant.length,
      bySentiment,
      urgentCount,
      topCategories,
    };
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }

  private countKeywords(text: string, keywords: string[]): number {
    return keywords.filter((k) => text.includes(k)).length;
  }

  private extractKeywords(text: string, keywords: string[]): string[] {
    return keywords.filter((k) => text.includes(k));
  }
}

export const grievanceSentimentAnalyzer = new GrievanceSentimentAnalyzer();
