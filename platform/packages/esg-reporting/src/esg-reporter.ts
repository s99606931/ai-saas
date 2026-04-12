// Design Ref: MTU-N452 §esg-reporter
// Plan SC: FR-ESG.1 ~ FR-ESG.5
//
// GRI Standards 2021 / SASB / TCFD 3대 ESG 보고 표준의 템플릿 + 지표 수집.
// AI 자연어 요약 부분은 로컬 규칙 기반 요약 (외부 AI API 호출 없음, N2SF O등급
// 데이터만 처리). 운영 환경에서 선택적으로 AI 게이트웨이에 위임 가능.

export type Standard = 'GRI' | 'SASB' | 'TCFD';

export interface Indicator {
  id: string;
  category: string;
  title: string;
  required: boolean;
  unit?: string;
}

export interface IndicatorValue {
  id: string;
  value: number | string | null;
  source?: string;
  note?: string;
}

export interface ReportSection {
  standard: Standard;
  coverage: number; // 0~1
  missing: string[];
  indicators: Array<Indicator & { value: IndicatorValue['value']; note?: string }>;
}

export interface EsgReport {
  period: string;
  sections: Record<Standard, ReportSection>;
  overallCoverage: number;
  qualityIssues: string[];
  summary: string;
}

// FR-ESG.1: GRI Universal Standards 2021 — 핵심 지표 서브셋
// (필수 공개 Universal 2-* / 환경 305-* / 사회 401-* / 거버넌스 2-9~21 등)
export const GRI_INDICATORS: Indicator[] = [
  { id: 'GRI-2-1', category: 'universal', title: '조직 개요', required: true },
  { id: 'GRI-2-9', category: 'governance', title: '거버넌스 구조', required: true },
  { id: 'GRI-2-22', category: 'strategy', title: '지속가능성 전략', required: true },
  { id: 'GRI-201-1', category: 'economic', title: '경제적 가치 창출', required: true, unit: 'KRW' },
  { id: 'GRI-302-1', category: 'environment', title: '조직 내 에너지 소비', required: true, unit: 'GJ' },
  { id: 'GRI-305-1', category: 'environment', title: 'Scope 1 직접 배출', required: true, unit: 'tCO2e' },
  { id: 'GRI-305-2', category: 'environment', title: 'Scope 2 간접 배출', required: true, unit: 'tCO2e' },
  { id: 'GRI-305-3', category: 'environment', title: 'Scope 3 기타 간접', required: false, unit: 'tCO2e' },
  { id: 'GRI-401-1', category: 'social', title: '신규 채용 및 이직', required: true },
  { id: 'GRI-403-9', category: 'social', title: '산업재해', required: true },
  { id: 'GRI-405-1', category: 'social', title: '다양성 지표', required: true },
];

// FR-ESG.2: SASB 산업별 — 기본 프레임워크 (산업별 매핑은 외부 DB 주입)
export const SASB_INDICATORS: Indicator[] = [
  { id: 'SASB-GHG-1', category: 'environment', title: 'GHG 배출', required: true, unit: 'tCO2e' },
  { id: 'SASB-EN-1', category: 'environment', title: '에너지 관리', required: true, unit: 'GJ' },
  { id: 'SASB-WT-1', category: 'environment', title: '물 사용량', required: true, unit: 'm3' },
  { id: 'SASB-HC-1', category: 'social', title: '인적자본 관리', required: true },
  { id: 'SASB-LD-1', category: 'governance', title: '리더십·거버넌스', required: true },
];

// FR-ESG.3: TCFD 4대 영역 (거버넌스/전략/위험관리/지표와 목표)
export const TCFD_INDICATORS: Indicator[] = [
  { id: 'TCFD-G-A', category: 'governance', title: '이사회 감독', required: true },
  { id: 'TCFD-G-B', category: 'governance', title: '경영진 역할', required: true },
  { id: 'TCFD-S-A', category: 'strategy', title: '기후 관련 위험/기회', required: true },
  { id: 'TCFD-S-B', category: 'strategy', title: '사업/재무 영향', required: true },
  { id: 'TCFD-S-C', category: 'strategy', title: '시나리오 분석', required: false },
  { id: 'TCFD-R-A', category: 'risk', title: '위험 식별', required: true },
  { id: 'TCFD-R-B', category: 'risk', title: '위험 관리', required: true },
  { id: 'TCFD-M-A', category: 'metrics', title: '기후 지표', required: true },
  { id: 'TCFD-M-B', category: 'metrics', title: 'GHG 배출', required: true, unit: 'tCO2e' },
  { id: 'TCFD-M-C', category: 'metrics', title: '감축 목표', required: true, unit: 'tCO2e' },
];

export function getStandardIndicators(std: Standard): Indicator[] {
  switch (std) {
    case 'GRI':
      return GRI_INDICATORS;
    case 'SASB':
      return SASB_INDICATORS;
    case 'TCFD':
      return TCFD_INDICATORS;
  }
}

// FR-ESG.4: 지표 자동 수집 + 섹션 빌더
export class EsgReporter {
  buildSection(standard: Standard, values: IndicatorValue[]): ReportSection {
    const indicators = getStandardIndicators(standard);
    const valueMap = new Map(values.map((v) => [v.id, v]));
    const merged = indicators.map((ind) => {
      const v = valueMap.get(ind.id);
      return {
        ...ind,
        value: v?.value ?? null,
        note: v?.note,
      };
    });
    const requiredTotal = indicators.filter((i) => i.required).length;
    const requiredFilled = merged.filter(
      (m) => m.required && m.value !== null && m.value !== '',
    ).length;
    const coverage = requiredTotal === 0 ? 1 : requiredFilled / requiredTotal;
    const missing = merged
      .filter((m) => m.required && (m.value === null || m.value === ''))
      .map((m) => m.id);
    return {
      standard,
      coverage: round4(coverage),
      missing,
      indicators: merged,
    };
  }

  // FR-ESG.5: 품질 점검 + 자연어 요약 (로컬 규칙 기반)
  buildReport(params: {
    period: string;
    values: Record<Standard, IndicatorValue[]>;
  }): EsgReport {
    const sections: Record<Standard, ReportSection> = {
      GRI: this.buildSection('GRI', params.values.GRI ?? []),
      SASB: this.buildSection('SASB', params.values.SASB ?? []),
      TCFD: this.buildSection('TCFD', params.values.TCFD ?? []),
    };
    const overall =
      (sections.GRI.coverage + sections.SASB.coverage + sections.TCFD.coverage) / 3;
    const qualityIssues: string[] = [];
    for (const [std, sec] of Object.entries(sections) as Array<[Standard, ReportSection]>) {
      if (sec.coverage < 1) {
        qualityIssues.push(
          `${std}: 필수 지표 ${sec.missing.length}개 누락 (${sec.missing.join(', ')})`,
        );
      }
    }
    const summary = this.summarize(params.period, sections, overall);
    return {
      period: params.period,
      sections,
      overallCoverage: round4(overall),
      qualityIssues,
      summary,
    };
  }

  private summarize(
    period: string,
    sections: Record<Standard, ReportSection>,
    overall: number,
  ): string {
    const parts: string[] = [];
    parts.push(`${period} ESG 통합 보고서`);
    parts.push(`전체 커버리지: ${(overall * 100).toFixed(1)}%`);
    for (const std of ['GRI', 'SASB', 'TCFD'] as const) {
      parts.push(
        `${std} ${(sections[std].coverage * 100).toFixed(1)}% (${sections[std].indicators.length}개 지표)`,
      );
    }
    return parts.join(' | ');
  }
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
