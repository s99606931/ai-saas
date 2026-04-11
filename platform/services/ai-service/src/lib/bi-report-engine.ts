// BI 자동화: AI 리포트 생성 -- FR-N265.1~FR-N265.6
// Design Ref: MTU-N265 DESIGN §1~§6
// CSAP: D-06 감사/이력, D-07 모니터링, D-12 개발 보안

import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 보고서 유형 -- Design §1 */
export type ReportType = 'operations' | 'security' | 'performance' | 'business';

/** 보고서 주기 -- Design §5 */
export type ReportFrequency = 'daily' | 'weekly' | 'monthly';

/** 보고서 상태 */
export type ReportStatus = 'draft' | 'generated' | 'delivered' | 'archived';

/** 보고서 템플릿 -- Design §1 */
export interface ReportTemplate {
  id: string;
  type: ReportType;
  name: string;
  description: string;
  sections: ReportSection[];
  frequency: ReportFrequency;
  recipients: string[];
  isActive: boolean;
  createdAt: string;
}

/** 보고서 섹션 */
export interface ReportSection {
  id: string;
  title: string;
  order: number;
  type: 'kpi' | 'table' | 'chart' | 'text' | 'insight';
  metricsQuery: string;
  aiPrompt?: string;
}

/** KPI 카드 */
export interface KpiCard {
  name: string;
  currentValue: number;
  previousValue: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
  status: 'good' | 'warning' | 'critical';
}

/** AI 인사이트 -- Design §3 */
export interface AiInsight {
  id: string;
  title: string;
  description: string;
  category: 'trend' | 'anomaly' | 'recommendation' | 'risk';
  severity: 'high' | 'medium' | 'low';
  relatedMetrics: string[];
  suggestedAction: string;
}

/** 생성된 보고서 */
export interface GeneratedReport {
  id: string;
  templateId: string;
  type: ReportType;
  title: string;
  period: { from: string; to: string };
  kpis: KpiCard[];
  insights: AiInsight[];
  tables: Array<{ title: string; headers: string[]; rows: string[][] }>;
  markdownContent: string;
  status: ReportStatus;
  generatedAt: string;
  version: number;
}

/** 보고서 메트릭 */
export interface BiMetrics {
  totalReports: number;
  reportsThisMonth: number;
  activeTemplates: number;
  averageInsightsPerReport: number;
  lastGeneratedAt: string;
}

// -- 보고서 템플릿 레지스트리 -- Design §1 ───────────────────────────────────

/** 보고서 템플릿 관리 */
export class ReportTemplateRegistry {
  private templates = new Map<string, ReportTemplate>();

  /** 템플릿 등록 */
  register(template: Omit<ReportTemplate, 'id' | 'createdAt'>): ReportTemplate {
    const newTemplate: ReportTemplate = {
      ...template,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.templates.set(newTemplate.id, newTemplate);
    return newTemplate;
  }

  /** 템플릿 조회 */
  get(templateId: string): ReportTemplate | undefined {
    return this.templates.get(templateId);
  }

  /** 유형별 검색 */
  getByType(type: ReportType): ReportTemplate[] {
    return Array.from(this.templates.values()).filter((t) => t.type === type);
  }

  /** 활성 템플릿 */
  getActive(): ReportTemplate[] {
    return Array.from(this.templates.values()).filter((t) => t.isActive);
  }

  /** 주기별 검색 */
  getByFrequency(frequency: ReportFrequency): ReportTemplate[] {
    return Array.from(this.templates.values()).filter(
      (t) => t.isActive && t.frequency === frequency,
    );
  }

  /** 전체 템플릿 */
  getAll(): ReportTemplate[] {
    return Array.from(this.templates.values());
  }

  /** 템플릿 삭제 */
  remove(templateId: string): boolean {
    return this.templates.delete(templateId);
  }
}

// -- 메트릭 수집기 -- Design §2 ──────────────────────────────────────────────

/** 보고서용 메트릭 수집기 */
export class ReportMetricsCollector {
  private metricsStore: Record<string, Array<{ period: string; value: number }>> = {};

  /** 메트릭 기록 */
  record(metric: string, value: number, period?: string): void {
    if (!this.metricsStore[metric]) {
      this.metricsStore[metric] = [];
    }
    const store = this.metricsStore[metric];
    if (store) {
      store.push({
        period: period ?? new Date().toISOString().split('T')[0] ?? '',
        value,
      });
    }
  }

  /** 기간별 메트릭 조회 */
  getMetric(metric: string, from: string, to: string): Array<{ period: string; value: number }> {
    const data = this.metricsStore[metric] || [];
    return data.filter((d) => d.period >= from && d.period <= to);
  }

  /** KPI 카드 생성 */
  buildKpi(
    name: string,
    metric: string,
    unit: string,
    currentPeriod: { from: string; to: string },
    previousPeriod: { from: string; to: string },
    goodDirection: 'up' | 'down',
  ): KpiCard {
    const current = this.getMetric(metric, currentPeriod.from, currentPeriod.to);
    const previous = this.getMetric(metric, previousPeriod.from, previousPeriod.to);

    const currentAvg = current.length > 0
      ? current.reduce((sum, d) => sum + d.value, 0) / current.length : 0;
    const previousAvg = previous.length > 0
      ? previous.reduce((sum, d) => sum + d.value, 0) / previous.length : 0;

    const change = previousAvg !== 0
      ? Math.round(((currentAvg - previousAvg) / previousAvg) * 10000) / 100 : 0;

    const trend = change > 1 ? 'up' : change < -1 ? 'down' : 'stable';
    const isGood = (goodDirection === 'up' && trend === 'up') || (goodDirection === 'down' && trend === 'down') || trend === 'stable';

    return {
      name,
      currentValue: Math.round(currentAvg * 100) / 100,
      previousValue: Math.round(previousAvg * 100) / 100,
      unit,
      trend,
      changePercent: change,
      status: isGood ? 'good' : Math.abs(change) > 20 ? 'critical' : 'warning',
    };
  }

  /** 등록된 메트릭 목록 */
  getMetricNames(): string[] {
    return Object.keys(this.metricsStore);
  }
}

// -- AI 인사이트 생성 -- Design §3 ──────────────────────────────────────────

/** AI 인사이트 생성기 */
export class InsightGenerator {
  // NOTE: config는 향후 AI 분석 기능 확장 시 사용 예정
  constructor(
    _config?: {
      aiAnalyzeFn?: (data: string, prompt: string) => Promise<string>;
    },
  ) {}

  /** KPI 기반 인사이트 생성 */
  generateFromKpis(kpis: KpiCard[]): AiInsight[] {
    const insights: AiInsight[] = [];

    // 트렌드 인사이트
    const criticalKpis = kpis.filter((k) => k.status === 'critical');
    for (const kpi of criticalKpis) {
      insights.push({
        id: randomUUID(),
        title: `${kpi.name} 주의 필요`,
        description: `${kpi.name}이(가) ${Math.abs(kpi.changePercent)}% ${kpi.trend === 'up' ? '증가' : '감소'}했습니다. 현재 ${kpi.currentValue}${kpi.unit}입니다.`,
        category: 'anomaly',
        severity: 'high',
        relatedMetrics: [kpi.name],
        suggestedAction: `${kpi.name} 변화 원인을 분석하고 조치 계획을 수립하세요.`,
      });
    }

    // 개선 인사이트
    const warningKpis = kpis.filter((k) => k.status === 'warning');
    for (const kpi of warningKpis) {
      insights.push({
        id: randomUUID(),
        title: `${kpi.name} 모니터링 권장`,
        description: `${kpi.name}이(가) 소폭 ${kpi.trend === 'up' ? '증가' : '감소'} 추세입니다 (${kpi.changePercent}%).`,
        category: 'trend',
        severity: 'medium',
        relatedMetrics: [kpi.name],
        suggestedAction: '추이를 계속 관찰하세요.',
      });
    }

    // 긍정 인사이트
    const goodKpis = kpis.filter((k) => k.status === 'good' && Math.abs(k.changePercent) > 10);
    if (goodKpis.length > 0) {
      insights.push({
        id: randomUUID(),
        title: '양호한 지표 다수',
        description: `${goodKpis.map((k) => k.name).join(', ')} 등 ${goodKpis.length}개 지표가 긍정적 추세입니다.`,
        category: 'trend',
        severity: 'low',
        relatedMetrics: goodKpis.map((k) => k.name),
        suggestedAction: '현재 운영 방식을 유지하세요.',
      });
    }

    return insights;
  }
}

// -- 보고서 렌더러 -- Design §4 ──────────────────────────────────────────────

/** 마크다운 보고서 렌더러 */
export class ReportRenderer {
  /** 보고서 렌더링 */
  render(report: Omit<GeneratedReport, 'markdownContent'>): string {
    const lines: string[] = [];

    lines.push(`# ${report.title}`);
    lines.push('');
    lines.push(`> 기간: ${report.period.from} ~ ${report.period.to}`);
    lines.push(`> 생성일: ${report.generatedAt}`);
    lines.push('');

    // KPI 섹션
    if (report.kpis.length > 0) {
      lines.push('## 핵심 성과 지표 (KPI)');
      lines.push('');
      lines.push('| 지표 | 현재 | 이전 | 변화 | 상태 |');
      lines.push('|------|------|------|------|------|');
      for (const kpi of report.kpis) {
        const icon = kpi.status === 'good' ? '[양호]' : kpi.status === 'warning' ? '[주의]' : '[경고]';
        const arrow = kpi.trend === 'up' ? '+' : kpi.trend === 'down' ? '' : '=';
        lines.push(`| ${kpi.name} | ${kpi.currentValue}${kpi.unit} | ${kpi.previousValue}${kpi.unit} | ${arrow}${kpi.changePercent}% | ${icon} |`);
      }
      lines.push('');
    }

    // AI 인사이트 섹션
    if (report.insights.length > 0) {
      lines.push('## AI 분석 인사이트');
      lines.push('');
      for (const insight of report.insights) {
        const badge = insight.severity === 'high' ? '[높음]' : insight.severity === 'medium' ? '[중간]' : '[낮음]';
        lines.push(`### ${badge} ${insight.title}`);
        lines.push('');
        lines.push(insight.description);
        lines.push('');
        lines.push(`**권장 조치**: ${insight.suggestedAction}`);
        lines.push('');
      }
    }

    // 테이블 섹션
    for (const table of report.tables) {
      lines.push(`## ${table.title}`);
      lines.push('');
      lines.push(`| ${table.headers.join(' | ')} |`);
      lines.push(`| ${table.headers.map(() => '------').join(' | ')} |`);
      for (const row of table.rows) {
        lines.push(`| ${row.join(' | ')} |`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

// -- 보고서 생성 엔진 (통합) ─────────────────────────────────────────────────

/** BI 보고서 자동 생성 엔진 */
export class BiReportEngine {
  private templateRegistry: ReportTemplateRegistry;
  private metricsCollector: ReportMetricsCollector;
  private insightGenerator: InsightGenerator;
  private renderer: ReportRenderer;
  private reportHistory: GeneratedReport[] = [];

  constructor(config?: {
    aiAnalyzeFn?: (data: string, prompt: string) => Promise<string>;
  }) {
    this.templateRegistry = new ReportTemplateRegistry();
    this.metricsCollector = new ReportMetricsCollector();
    this.insightGenerator = new InsightGenerator(config);
    this.renderer = new ReportRenderer();
  }

  /** 템플릿 접근 */
  getTemplateRegistry(): ReportTemplateRegistry {
    return this.templateRegistry;
  }

  /** 메트릭 접근 */
  getMetricsCollector(): ReportMetricsCollector {
    return this.metricsCollector;
  }

  /** 보고서 생성 */
  generate(
    templateId: string,
    period: { from: string; to: string },
    kpis: KpiCard[],
    tables?: Array<{ title: string; headers: string[]; rows: string[][] }>,
  ): GeneratedReport {
    const template = this.templateRegistry.get(templateId);
    if (!template) {
      throw new Error(`템플릿을 찾을 수 없습니다: ${templateId}`);
    }

    // AI 인사이트 생성
    const insights = this.insightGenerator.generateFromKpis(kpis);

    const reportBase = {
      id: randomUUID(),
      templateId,
      type: template.type,
      title: `${template.name} (${period.from} ~ ${period.to})`,
      period,
      kpis,
      insights,
      tables: tables || [],
      status: 'generated' as ReportStatus,
      generatedAt: new Date().toISOString(),
      version: this.getNextVersion(templateId),
    };

    // 마크다운 렌더링
    const markdownContent = this.renderer.render(reportBase);

    const report: GeneratedReport = {
      ...reportBase,
      markdownContent,
    };

    // 이력 저장
    this.reportHistory.push(report);

    return report;
  }

  /** 보고서 이력 조회 -- Design §6 */
  getHistory(templateId?: string, limit = 50): GeneratedReport[] {
    const history = templateId
      ? this.reportHistory.filter((r) => r.templateId === templateId)
      : this.reportHistory;
    return history.slice(-limit);
  }

  /** 두 보고서 비교 -- Design §6 */
  compare(reportIdA: string, reportIdB: string): {
    kpiChanges: Array<{ name: string; valueA: number; valueB: number; change: number }>;
    newInsights: AiInsight[];
  } {
    const reportA = this.reportHistory.find((r) => r.id === reportIdA);
    const reportB = this.reportHistory.find((r) => r.id === reportIdB);

    if (!reportA || !reportB) {
      throw new Error('보고서를 찾을 수 없습니다');
    }

    const kpiChanges = reportB.kpis.map((kpiB) => {
      const kpiA = reportA.kpis.find((k) => k.name === kpiB.name);
      return {
        name: kpiB.name,
        valueA: kpiA?.currentValue ?? 0,
        valueB: kpiB.currentValue,
        change: kpiB.currentValue - (kpiA?.currentValue ?? 0),
      };
    });

    const newInsights = reportB.insights.filter(
      (insightB) => !reportA.insights.some((insightA) => insightA.title === insightB.title),
    );

    return { kpiChanges, newInsights };
  }

  /** BI 메트릭 */
  getBiMetrics(): BiMetrics {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const reportsThisMonth = this.reportHistory.filter(
      (r) => r.generatedAt >= monthStart,
    ).length;

    const totalInsights = this.reportHistory.reduce(
      (sum, r) => sum + r.insights.length, 0,
    );

    return {
      totalReports: this.reportHistory.length,
      reportsThisMonth,
      activeTemplates: this.templateRegistry.getActive().length,
      averageInsightsPerReport: this.reportHistory.length > 0
        ? Math.round((totalInsights / this.reportHistory.length) * 10) / 10 : 0,
      lastGeneratedAt: this.reportHistory.length > 0
        ? (this.reportHistory[this.reportHistory.length - 1]?.generatedAt ?? '') : '',
    };
  }

  private getNextVersion(templateId: string): number {
    const existing = this.reportHistory.filter((r) => r.templateId === templateId);
    return existing.length + 1;
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

/** BI 보고서 엔진 생성 (기본 템플릿 포함) */
export function createBiReportEngine(config?: {
  aiAnalyzeFn?: (data: string, prompt: string) => Promise<string>;
}): BiReportEngine {
  const engine = new BiReportEngine(config);
  const registry = engine.getTemplateRegistry();

  // 기본 템플릿 등록
  registry.register({
    type: 'operations',
    name: '운영 현황 보고서',
    description: '서비스 가용성, API 응답 시간, 에러율, 사용자 활동 등 운영 지표',
    sections: [
      { id: 's1', title: 'KPI 요약', order: 1, type: 'kpi', metricsQuery: 'ops.*' },
      { id: 's2', title: '서비스별 상태', order: 2, type: 'table', metricsQuery: 'service.status' },
      { id: 's3', title: 'AI 인사이트', order: 3, type: 'insight', metricsQuery: '*', aiPrompt: '운영 지표를 분석하세요' },
    ],
    frequency: 'weekly',
    recipients: ['admin@example.com'],
    isActive: true,
  });

  registry.register({
    type: 'security',
    name: '보안 현황 보고서',
    description: '보안 이벤트, 취약점, 준수 현황, 접근 통제 상태',
    sections: [
      { id: 's1', title: '보안 KPI', order: 1, type: 'kpi', metricsQuery: 'security.*' },
      { id: 's2', title: '보안 이벤트', order: 2, type: 'table', metricsQuery: 'security.events' },
      { id: 's3', title: 'CSAP 준수', order: 3, type: 'table', metricsQuery: 'csap.compliance' },
    ],
    frequency: 'weekly',
    recipients: ['security@example.com'],
    isActive: true,
  });

  registry.register({
    type: 'business',
    name: 'SaaS 사업 현황 보고서',
    description: '테넌트 수, 구독, 매출, 이탈률, 고객 만족도',
    sections: [
      { id: 's1', title: '사업 KPI', order: 1, type: 'kpi', metricsQuery: 'business.*' },
      { id: 's2', title: '테넌트별 현황', order: 2, type: 'table', metricsQuery: 'tenant.status' },
      { id: 's3', title: 'AI 분석', order: 3, type: 'insight', metricsQuery: '*', aiPrompt: '사업 지표를 분석하세요' },
    ],
    frequency: 'monthly',
    recipients: ['management@example.com'],
    isActive: true,
  });

  return engine;
}
