// Design Ref: MTU-N474 §공공기관 통계 자동 산출
// Plan SC: FR-STAT.1~5

export interface StatIndicator {
  code: string;
  name: string;
  category: string;
  unit: string;
  dataType: 'int' | 'decimal';
}

export interface StatQuery {
  indicatorCode: string;
  period: string;
  dimensions: string[];
}

export interface StatResult {
  indicatorCode: string;
  period: string;
  value: number;
  breakdown?: Record<string, number>;
}

export interface QualityIssue {
  indicatorCode: string;
  issue: string;
  severity: 'info' | 'warning' | 'error';
}

export interface KosisFormat {
  ORG_ID: string;
  TBL_ID: string;
  ITM_ID: string;
  PRD_DE: string;
  DT: string;
}

export class StatisticsAutomation {
  private indicators = new Map<string, StatIndicator>();

  /** FR-STAT.1 국가통계 항목 등록 */
  registerIndicator(i: StatIndicator): void {
    this.indicators.set(i.code, i);
  }

  /** FR-STAT.2 집계 쿼리 생성 */
  generateQuery(code: string, period: string, dimensions: string[] = []): StatQuery {
    if (!this.indicators.has(code)) throw new Error('지표 없음');
    return { indicatorCode: code, period, dimensions };
  }

  /** FR-STAT.3 보고서 템플릿 */
  buildReport(results: StatResult[]): string {
    const lines = ['# 통계 보고서', ''];
    for (const r of results) {
      const ind = this.indicators.get(r.indicatorCode);
      if (!ind) continue;
      lines.push(`## ${ind.name} (${r.period})`);
      lines.push(`- 값: ${r.value.toLocaleString()} ${ind.unit}`);
      if (r.breakdown) {
        for (const [k, v] of Object.entries(r.breakdown)) lines.push(`  - ${k}: ${v}`);
      }
      lines.push('');
    }
    return lines.join('\n');
  }

  /** FR-STAT.4 품질 검증 */
  validateQuality(results: StatResult[]): QualityIssue[] {
    const issues: QualityIssue[] = [];
    for (const r of results) {
      if (r.value < 0) issues.push({ indicatorCode: r.indicatorCode, issue: '음수 값', severity: 'error' });
      if (r.value === 0) issues.push({ indicatorCode: r.indicatorCode, issue: '0 값 의심', severity: 'warning' });
    }
    return issues;
  }

  /** FR-STAT.5 KOSIS 포맷 */
  toKosisFormat(result: StatResult, orgId: string, tblId: string): KosisFormat {
    return {
      ORG_ID: orgId,
      TBL_ID: tblId,
      ITM_ID: result.indicatorCode,
      PRD_DE: result.period.replace(/-/g, ''),
      DT: String(result.value),
    };
  }
}

export const statisticsAutomation = new StatisticsAutomation();
