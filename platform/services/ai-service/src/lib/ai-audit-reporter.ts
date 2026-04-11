// AI 감사 보고서 생성기 -- FR-ADV37.5
// Design Ref: SVC-AI-ADV-R37 DESIGN §5
// Plan SC: SC-5 (CSAP AI 윤리 감사 대응)
// CSAP: D-06 AI 감사 보고서, AI 윤리 준수 증적

import {
  AIGovernanceMetrics,
  getAIGovernanceMetrics,
} from './ai-governance-metrics';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** AI 감사 보고서 -- Design §5 */
export interface AIAuditReport {
  id: string;
  title: string;
  generatedAt: string;
  period: { start: string; end: string };
  sections: AuditReportSection[];
  overallCompliance: number;
  recommendations: string[];
}

/** 보고서 섹션 */
export interface AuditReportSection {
  title: string;
  content: string;
  data?: Record<string, unknown>;
  complianceStatus: 'compliant' | 'partial' | 'non_compliant';
}

/** AI 시스템 등록 정보 */
export interface AISystemInfo {
  name: string;
  purpose: string;
  model: string;
  riskLevel: 'high' | 'medium' | 'low';
  dataClassification: 'O' | 'C' | 'S';
  owner: string;
}

/** 보고서 생성기 설정 */
export interface AuditReporterConfig {
  /** 조직명 */
  organizationName: string;
  /** AI 시스템 목록 */
  aiSystems: AISystemInfo[];
  /** 메트릭 소스 */
  metricsSource?: AIGovernanceMetrics;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

function auditLog(action: string, details: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    component: 'ai-audit-reporter',
    action,
    ...details,
  };
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

function generateId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// -- AIAuditReporter 메인 클래스 ──────────────────────────────────────────────

/** AI 감사 보고서 생성기 -- Design §5 */
export class AIAuditReporter {
  private readonly config: AuditReporterConfig;
  private readonly metrics: AIGovernanceMetrics;

  constructor(config: AuditReporterConfig) {
    this.config = config;
    this.metrics = config.metricsSource ?? getAIGovernanceMetrics();
  }

  /** 전체 감사 보고서 생성 -- Design §5 */
  generateReport(periodStart: string, periodEnd: string): AIAuditReport {
    const sections: AuditReportSection[] = [];

    // 1. AI 시스템 현황
    sections.push(this.generateSystemOverview());

    // 2. 사용 현황
    sections.push(this.generateUsageSection(periodStart, periodEnd));

    // 3. 비용 분석
    sections.push(this.generateCostSection(periodStart, periodEnd));

    // 4. 품질 현황
    sections.push(this.generateQualitySection());

    // 5. AI 윤리 준수
    sections.push(this.generateEthicsSection());

    // 6. 데이터 보호 (N2SF)
    sections.push(this.generateDataProtectionSection());

    // 전체 준수율 계산
    const complianceScores = sections.map((s) =>
      s.complianceStatus === 'compliant' ? 100
      : s.complianceStatus === 'partial' ? 50
      : 0,
    );
    const overallCompliance =
      (complianceScores as number[]).reduce((s, v) => s + v, 0) / complianceScores.length;

    // 권장 사항 생성
    const recommendations = this.generateRecommendations(sections);

    const report: AIAuditReport = {
      id: generateId(),
      title: `${this.config.organizationName} AI 시스템 감사 보고서`,
      generatedAt: new Date().toISOString(),
      period: { start: periodStart, end: periodEnd },
      sections,
      overallCompliance,
      recommendations,
    };

    auditLog('report_generated', {
      reportId: report.id,
      sections: sections.length,
      overallCompliance,
    });

    return report;
  }

  // -- 섹션 생성기 ───────────────────────────────────────────────────────

  /** 1. AI 시스템 현황 */
  private generateSystemOverview(): AuditReportSection {
    const systems = this.config.aiSystems;
    const highRisk = systems.filter((s) => s.riskLevel === 'high').length;

    return {
      title: 'AI 시스템 현황',
      content: [
        `등록 AI 시스템: ${systems.length}개`,
        `고위험 시스템: ${highRisk}개`,
        `중위험 시스템: ${systems.filter((s) => s.riskLevel === 'medium').length}개`,
        `저위험 시스템: ${systems.filter((s) => s.riskLevel === 'low').length}개`,
      ].join('\n'),
      data: {
        systems: systems.map((s) => ({
          name: s.name,
          purpose: s.purpose,
          riskLevel: s.riskLevel,
          dataClassification: s.dataClassification,
        })),
      },
      complianceStatus: highRisk === 0 ? 'compliant' : 'partial',
    };
  }

  /** 2. 사용 현황 */
  private generateUsageSection(
    periodStart: string,
    periodEnd: string,
  ): AuditReportSection {
    const metrics = this.metrics.getUsageMetrics(undefined, periodStart, periodEnd);
    const totalCalls = metrics.reduce((s, m) => s + m.totalCalls, 0);
    const avgErrorRate = metrics.length > 0
      ? metrics.reduce((s, m) => s + m.errorRate, 0) / metrics.length
      : 0;

    return {
      title: 'AI 사용 현황',
      content: [
        `총 호출 수: ${totalCalls.toLocaleString()}회`,
        `활성 모델: ${metrics.length}개`,
        `평균 에러율: ${avgErrorRate.toFixed(2)}%`,
      ].join('\n'),
      data: { metrics },
      complianceStatus: avgErrorRate < 5 ? 'compliant' : 'partial',
    };
  }

  /** 3. 비용 분석 */
  private generateCostSection(
    periodStart: string,
    periodEnd: string,
  ): AuditReportSection {
    const costs = this.metrics.getCostMetrics(undefined, periodStart, periodEnd);
    const totalCost = costs.reduce((s, c) => s + c.totalCost, 0);

    return {
      title: '비용 분석',
      content: [
        `총 AI 비용: $${totalCost.toFixed(2)}`,
        `모델별 비용 분포: ${costs.map((c) => `${c.model}: $${c.totalCost.toFixed(2)}`).join(', ')}`,
      ].join('\n'),
      data: { costs, totalCost },
      complianceStatus: 'compliant',
    };
  }

  /** 4. 품질 현황 */
  private generateQualitySection(): AuditReportSection {
    const qualities = this.metrics.getQualityMetrics();
    const maxHallucination = qualities.reduce((max, q) => Math.max(max, q.hallucinationRate), 0);

    return {
      title: 'AI 품질 현황',
      content: [
        `환각률 (최대): ${maxHallucination.toFixed(2)}%`,
        `품질 모니터링 대상: ${qualities.length}개 모델`,
      ].join('\n'),
      data: { qualities },
      complianceStatus: maxHallucination < 10 ? 'compliant' : 'non_compliant',
    };
  }

  /** 5. AI 윤리 준수 */
  private generateEthicsSection(): AuditReportSection {
    const ethics = this.metrics.getEthicsMetrics();

    return {
      title: 'AI 윤리 준수',
      content: [
        `편향성 점수: ${ethics.avgBiasScore.toFixed(3)} (낮을수록 양호)`,
        `공정성 지수: ${ethics.fairnessIndex.toFixed(3)}`,
        `투명성 비율: ${ethics.transparencyRate.toFixed(1)}%`,
        `설명 가능성: ${ethics.avgExplainability.toFixed(3)}`,
      ].join('\n'),
      data: { ethics },
      complianceStatus:
        ethics.avgBiasScore < 0.2 && ethics.fairnessIndex > 0.8
          ? 'compliant'
          : ethics.avgBiasScore < 0.3
          ? 'partial'
          : 'non_compliant',
    };
  }

  /** 6. 데이터 보호 */
  private generateDataProtectionSection(): AuditReportSection {
    const sensitiveSystemCount = this.config.aiSystems.filter(
      (s) => s.dataClassification === 'C' || s.dataClassification === 'S',
    ).length;

    return {
      title: '데이터 보호 (N2SF)',
      content: [
        `C/S등급 데이터 처리 시스템: ${sensitiveSystemCount}개`,
        `O등급 데이터만 외부 AI API 전송 정책 준수`,
        `PII 마스킹 적용 확인`,
      ].join('\n'),
      data: { sensitiveSystemCount },
      complianceStatus: sensitiveSystemCount === 0 ? 'compliant' : 'partial',
    };
  }

  // -- 권장 사항 생성 ────────────────────────────────────────────────────

  private generateRecommendations(sections: AuditReportSection[]): string[] {
    const recommendations: string[] = [];

    for (const section of sections) {
      if (section.complianceStatus === 'non_compliant') {
        recommendations.push(`[긴급] ${section.title}: 미준수 항목 즉시 개선 필요`);
      } else if (section.complianceStatus === 'partial') {
        recommendations.push(`[개선] ${section.title}: 부분 준수 상태. 추가 조치 권장`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('모든 영역 준수 상태. 지속적 모니터링 유지 권장.');
    }

    return recommendations;
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

let reporterInstance: AIAuditReporter | null = null;

export function getAIAuditReporter(
  config: AuditReporterConfig,
): AIAuditReporter {
  if (!reporterInstance) {
    reporterInstance = new AIAuditReporter(config);
  }
  return reporterInstance;
}

export function resetAIAuditReporter(): void {
  reporterInstance = null;
}
