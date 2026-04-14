// Design Ref: §종합점수 — min(usage/10000,1)×100×0.3+satisfaction/5×100×0.3+cost×0.2+access×0.2
// Plan SC: SC-R609-1, SC-R609-2, SC-R609-3

interface ServiceComparison {
  serviceId: string;
  usageCount: number;
  satisfactionScore: number;
  costEfficiency: number;
  accessibilityScore: number;
}

type ComparisonGrade = 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR';

interface ComparisonItem {
  serviceId: string;
  score: number;
  grade: ComparisonGrade;
}

interface ComparisonResult {
  analysisId: string;
  services: ComparisonItem[];
  topService: string;
  bottomService: string;
  avgScore: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  analysisId: string;
  topService: string;
  avgScore: number;
}

export class PublicServiceComparisonAnalyzerV2 {
  private readonly auditLog: AuditEntry[] = [];

  analyze(analysisId: string, services: ServiceComparison[]): ComparisonResult {
    const items: ComparisonItem[] = services.map((svc) => {
      const score = this.computeScore(svc);
      return { serviceId: svc.serviceId, score: Math.round(score * 100) / 100, grade: this.classifyGrade(score) };
    });

    const sorted = [...items].sort((a, b) => b.score - a.score);
    const topService = sorted.length > 0 ? sorted[0]!.serviceId : '';
    const bottomService = sorted.length > 0 ? sorted[sorted.length - 1]!.serviceId : '';
    const avgScore = items.length > 0
      ? Math.round((items.reduce((s, i) => s + i.score, 0) / items.length) * 100) / 100
      : 0;

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'SERVICE_COMPARISON_ANALYZED',
      analysisId,
      topService,
      avgScore,
    });

    return { analysisId, services: items, topService, bottomService, avgScore };
  }

  private computeScore(svc: ServiceComparison): number {
    return (
      Math.min(svc.usageCount / 10000, 1) * 100 * 0.3 +
      (svc.satisfactionScore / 5) * 100 * 0.3 +
      svc.costEfficiency * 0.2 +
      svc.accessibilityScore * 0.2
    );
  }

  private classifyGrade(score: number): ComparisonGrade {
    if (score >= 80) return 'EXCELLENT';
    if (score >= 60) return 'GOOD';
    if (score >= 40) return 'AVERAGE';
    return 'POOR';
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
