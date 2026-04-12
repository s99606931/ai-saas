// Design Ref: MTU-N452 §ESG 리포팅 자동화
// Plan SC: FR-ESG.1~5

export type EsgStandard = 'GRI' | 'SASB' | 'TCFD' | 'K-ESG';

export interface EsgIndicator {
  standard: EsgStandard;
  code: string;
  name: string;
  category: 'E' | 'S' | 'G';
  value?: number | string;
  unit?: string;
}

export interface EsgReport {
  period: string;
  standard: EsgStandard;
  indicators: EsgIndicator[];
  coverage: number;
  aiSummary?: string;
  qualityIssues: string[];
}

export class EsgReportingAutomation {
  private templates = new Map<EsgStandard, EsgIndicator[]>();

  /** FR-ESG.1 GRI / FR-ESG.2 SASB / FR-ESG.3 TCFD 템플릿 등록 */
  registerTemplate(standard: EsgStandard, indicators: EsgIndicator[]): void {
    this.templates.set(standard, indicators);
  }

  /** FR-ESG.4 지표 자동 수집 */
  collectIndicators(standard: EsgStandard, dataSource: Map<string, number | string>): EsgIndicator[] {
    const tmpl = this.templates.get(standard) ?? [];
    return tmpl.map((i) => ({
      ...i,
      value: dataSource.get(i.code) ?? undefined,
    }));
  }

  /** FR-ESG.5 AI 품질 점검 + 보고서 생성 */
  buildReport(standard: EsgStandard, period: string, collected: EsgIndicator[]): EsgReport {
    const total = collected.length;
    const filled = collected.filter((i) => i.value !== undefined && i.value !== null && i.value !== '').length;
    const coverage = total === 0 ? 0 : +(filled / total).toFixed(3);

    const issues: string[] = [];
    if (coverage < 0.8) issues.push(`커버리지 부족: ${(coverage * 100).toFixed(1)}%`);
    const missing = collected.filter((i) => i.value === undefined).map((i) => i.code);
    if (missing.length > 0) issues.push(`누락 지표: ${missing.slice(0, 5).join(',')}`);

    return {
      period,
      standard,
      indicators: collected,
      coverage,
      aiSummary: `${standard} ${period} 총 ${total}개 지표 중 ${filled}개 충족.`,
      qualityIssues: issues,
    };
  }

  listStandards(): EsgStandard[] {
    return Array.from(this.templates.keys());
  }
}

export const esgReportingAutomation = new EsgReportingAutomation();
