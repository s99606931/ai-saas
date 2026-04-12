// Design Ref: §핵심 알고리즘 — 갭 분석 + 준수율 + 법적 보고서
// Plan SC: FR-R248.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface LegalArticle {
  id: string;
  requirement: string;
  mandatory: boolean;
}

interface Regulation {
  id: string;
  name: string;
  articles: LegalArticle[];
}

interface Policy {
  id: string;
  name: string;
  capabilities: string[];
}

interface GapItem {
  articleId: string;
  requirement: string;
  mandatory: boolean;
  reason: string;
}

interface GapAnalysis {
  policyId: string;
  regulationId: string;
  gaps: GapItem[];
  mandatoryGaps: number;
}

interface ComplianceReport {
  policyId: string;
  complianceRate: number;
  totalRequirements: number;
  metRequirements: number;
  gaps: GapItem[];
  recommendations: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R248.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class LegalComplianceReviewerAI {
  private regulations = new Map<string, Regulation>();
  private policies = new Map<string, Policy>();
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R248.1
  registerRegulation(id: string, name: string, articles: LegalArticle[]): void {
    this.regulations.set(id, { id, name, articles });
    this.log('REGISTER_REGULATION', { id, name, articleCount: articles.length });
  }

  // Plan SC: FR-R248.2
  registerPolicy(id: string, name: string, capabilities: string[]): void {
    this.policies.set(id, { id, name, capabilities });
    this.log('REGISTER_POLICY', { id, name, capabilityCount: capabilities.length });
  }

  // Plan SC: FR-R248.3
  analyzeGaps(policyId: string, regulationId: string, grade: DataGrade = DataGrade.O): GapAnalysis {
    guardDataGrade(grade);

    const policy = this.policies.get(policyId);
    const regulation = this.regulations.get(regulationId);
    if (!policy) throw new Error(`정책 미등록: ${policyId}`);
    if (!regulation) throw new Error(`규정 미등록: ${regulationId}`);

    const capabilitySet = new Set(policy.capabilities);
    const gaps: GapItem[] = [];

    for (const article of regulation.articles) {
      if (!capabilitySet.has(article.requirement)) {
        gaps.push({
          articleId: article.id,
          requirement: article.requirement,
          mandatory: article.mandatory,
          reason: `정책에 '${article.requirement}' 역량 없음`,
        });
      }
    }

    const mandatoryGaps = gaps.filter(g => g.mandatory).length;
    this.log('ANALYZE_GAPS', { policyId, regulationId, gapsCount: gaps.length, mandatoryGaps });
    return { policyId, regulationId, gaps, mandatoryGaps };
  }

  // Plan SC: FR-R248.4
  generateReport(policyId: string): ComplianceReport {
    const policy = this.policies.get(policyId);
    if (!policy) throw new Error(`정책 미등록: ${policyId}`);

    const allGaps: GapItem[] = [];
    let totalRequirements = 0;

    for (const regulation of this.regulations.values()) {
      const gapAnalysis = this.analyzeGaps(policyId, regulation.id);
      allGaps.push(...gapAnalysis.gaps);
      totalRequirements += regulation.articles.length;
    }

    const metRequirements = totalRequirements - allGaps.length;
    const complianceRate = totalRequirements === 0 ? 100 : Math.round((metRequirements / totalRequirements) * 100);

    const recommendations = allGaps.filter(g => g.mandatory).map(
      g => `[필수] ${g.requirement} — ${g.reason}`
    );

    this.log('GENERATE_REPORT', { policyId, complianceRate, totalRequirements });
    return { policyId, complianceRate, totalRequirements, metRequirements, gaps: allGaps, recommendations };
  }

  // Plan SC: FR-R248.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
