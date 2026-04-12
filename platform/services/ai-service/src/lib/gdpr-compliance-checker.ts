// Design Ref: MTU-N457 §GDPR/개보법 컴플라이언스
// Plan SC: FR-GDPR.1~5

export interface GdprArticle {
  code: string;
  title: string;
  summary: string;
  mapsTo?: string; // 개보법 매핑
}

export interface ComplianceCheck {
  articleCode: string;
  status: 'compliant' | 'partial' | 'non-compliant' | 'not-applicable';
  evidence?: string;
}

export interface GapAnalysisReport {
  gdprGaps: string[];
  domesticGaps: string[];
  commonIssues: string[];
  totalArticles: number;
  compliantCount: number;
  score: number;
}

export interface CrossBorderTransfer {
  destCountry: string;
  mechanism: 'adequacy' | 'scc' | 'bcr' | 'consent' | 'none';
  approved: boolean;
}

export class GdprComplianceChecker {
  private articles = new Map<string, GdprArticle>();

  /** FR-GDPR.1 GDPR 조항 등록 */
  registerArticle(a: GdprArticle): void {
    this.articles.set(a.code, a);
  }

  /** FR-GDPR.2 개보법 매핑 조회 */
  getMappings(): Array<{ gdpr: string; domestic: string | undefined }> {
    return Array.from(this.articles.values()).map((a) => ({ gdpr: a.code, domestic: a.mapsTo }));
  }

  /** FR-GDPR.3 갭 분석 */
  analyzeGap(checks: ComplianceCheck[]): GapAnalysisReport {
    const compliantCount = checks.filter((c) => c.status === 'compliant').length;
    const gdprGaps = checks.filter((c) => c.status === 'non-compliant').map((c) => c.articleCode);
    const partialGaps = checks.filter((c) => c.status === 'partial').map((c) => c.articleCode);
    const total = this.articles.size || checks.length;
    const score = total === 0 ? 0 : +(compliantCount / total).toFixed(3);
    return {
      gdprGaps,
      domesticGaps: gdprGaps
        .map((g) => this.articles.get(g)?.mapsTo)
        .filter((d): d is string => d !== undefined),
      commonIssues: partialGaps,
      totalArticles: total,
      compliantCount,
      score,
    };
  }

  /** FR-GDPR.4 DPIA 트리거 조건 */
  requiresDpia(activity: { largeScale: boolean; specialCategories: boolean; systematicMonitoring: boolean }): boolean {
    const flags = [activity.largeScale, activity.specialCategories, activity.systematicMonitoring];
    return flags.filter(Boolean).length >= 2;
  }

  /** FR-GDPR.5 국외이전 체크 */
  checkTransfer(transfer: Omit<CrossBorderTransfer, 'approved'>): CrossBorderTransfer {
    const adequateCountries = new Set(['JP', 'KR', 'CH', 'GB', 'CA']);
    let approved = false;
    if (transfer.mechanism === 'adequacy' && adequateCountries.has(transfer.destCountry)) approved = true;
    else if (transfer.mechanism === 'scc' || transfer.mechanism === 'bcr') approved = true;
    else if (transfer.mechanism === 'consent') approved = true;
    return { ...transfer, approved };
  }
}

export const gdprComplianceChecker = new GdprComplianceChecker();
