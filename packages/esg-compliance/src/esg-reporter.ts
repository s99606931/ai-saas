/**
 * ESG 리포팅 자동화 (GRI/SASB/TCFD)
 * Design Ref: MTU-N452 §3
 * Plan SC: FR-ESG.1~5
 */

import { z } from 'zod';

export const IndicatorValueSchema = z.object({
  indicatorId: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
  unit: z.string().optional(),
  period: z.string().regex(/^\d{4}(-\d{2})?$/),
  source: z.string().min(1),
});

export type IndicatorValue = z.infer<typeof IndicatorValueSchema>;

export type StandardType = 'GRI' | 'SASB' | 'TCFD';

export interface IndicatorDefinition {
  id: string;
  standard: StandardType;
  category: string;
  title: string;
  mandatory: boolean;
  unit?: string;
}

/**
 * GRI Universal Standards 2021 (FR-ESG.1) - 핵심 지표 일부
 */
export const GRI_INDICATORS: IndicatorDefinition[] = [
  { id: 'GRI-2-1', standard: 'GRI', category: 'organization', title: '조직 세부사항', mandatory: true },
  { id: 'GRI-2-7', standard: 'GRI', category: 'organization', title: '임직원 수', mandatory: true, unit: '명' },
  { id: 'GRI-201-1', standard: 'GRI', category: 'economic', title: '직접 경제가치 창출·배분', mandatory: true, unit: 'KRW' },
  { id: 'GRI-302-1', standard: 'GRI', category: 'environmental', title: '조직 내 에너지 소비', mandatory: true, unit: 'MWh' },
  { id: 'GRI-305-1', standard: 'GRI', category: 'environmental', title: '직접 온실가스 배출 (Scope 1)', mandatory: true, unit: 'tCO2e' },
  { id: 'GRI-305-2', standard: 'GRI', category: 'environmental', title: '간접 온실가스 배출 (Scope 2)', mandatory: true, unit: 'tCO2e' },
  { id: 'GRI-403-9', standard: 'GRI', category: 'social', title: '업무상 상해', mandatory: true, unit: '건' },
  { id: 'GRI-405-1', standard: 'GRI', category: 'social', title: '거버넌스 기구 및 임직원 다양성', mandatory: true, unit: '%' },
];

/**
 * SASB 산업별 지표 (FR-ESG.2)
 */
export const SASB_INDICATORS: IndicatorDefinition[] = [
  { id: 'SASB-IF-RE-410a.1', standard: 'SASB', category: 'real-estate', title: '에너지 소비 데이터 적용률', mandatory: true, unit: '%' },
  { id: 'SASB-TC-SI-230a.1', standard: 'SASB', category: 'software', title: '데이터센터 에너지 사용량', mandatory: true, unit: 'MWh' },
  { id: 'SASB-TC-SI-220a.1', standard: 'SASB', category: 'software', title: '개인정보 보호 정책 준수', mandatory: true },
];

/**
 * TCFD 4대 영역 (FR-ESG.3)
 */
export const TCFD_INDICATORS: IndicatorDefinition[] = [
  { id: 'TCFD-GOV-A', standard: 'TCFD', category: 'governance', title: '이사회의 기후 리스크 감독', mandatory: true },
  { id: 'TCFD-GOV-B', standard: 'TCFD', category: 'governance', title: '경영진의 기후 리스크 평가', mandatory: true },
  { id: 'TCFD-STR-A', standard: 'TCFD', category: 'strategy', title: '단기/중기/장기 기후 리스크', mandatory: true },
  { id: 'TCFD-STR-B', standard: 'TCFD', category: 'strategy', title: '기후 리스크의 사업 영향', mandatory: true },
  { id: 'TCFD-RSK-A', standard: 'TCFD', category: 'risk', title: '기후 리스크 식별·평가 프로세스', mandatory: true },
  { id: 'TCFD-MET-A', standard: 'TCFD', category: 'metrics', title: 'Scope 1, 2, 3 배출량', mandatory: true, unit: 'tCO2e' },
];

/**
 * ESG 리포트 생성기
 */
export class EsgReporter {
  private registry = new Map<string, IndicatorDefinition>();
  private values = new Map<string, IndicatorValue>();

  constructor() {
    [...GRI_INDICATORS, ...SASB_INDICATORS, ...TCFD_INDICATORS].forEach((def) => {
      this.registry.set(def.id, def);
    });
  }

  /**
   * 지표값 등록 (FR-ESG.4)
   */
  setValue(value: IndicatorValue): void {
    const validated = IndicatorValueSchema.parse(value);
    if (!this.registry.has(validated.indicatorId)) {
      throw new Error(`알 수 없는 지표: ${validated.indicatorId}`);
    }
    this.values.set(validated.indicatorId, validated);
  }

  getValue(indicatorId: string): IndicatorValue | undefined {
    return this.values.get(indicatorId);
  }

  /**
   * 필수 지표 누락 체크 (FR-ESG.5)
   */
  validateMandatory(standard: StandardType): {
    complete: boolean;
    missing: string[];
    coverage: number;
  } {
    const mandatoryDefs = Array.from(this.registry.values()).filter(
      (d) => d.standard === standard && d.mandatory,
    );
    const missing = mandatoryDefs.filter((d) => !this.values.has(d.id)).map((d) => d.id);
    const coverage =
      mandatoryDefs.length > 0
        ? ((mandatoryDefs.length - missing.length) / mandatoryDefs.length) * 100
        : 100;
    return {
      complete: missing.length === 0,
      missing,
      coverage,
    };
  }

  /**
   * 표준별 리포트 생성
   */
  generate(standard: StandardType, period: string): {
    standard: StandardType;
    period: string;
    indicators: Array<{ def: IndicatorDefinition; value: IndicatorValue | null }>;
    validation: ReturnType<EsgReporter['validateMandatory']>;
  } {
    const defs = Array.from(this.registry.values()).filter((d) => d.standard === standard);
    const indicators = defs.map((def) => ({
      def,
      value: this.values.get(def.id) ?? null,
    }));
    return {
      standard,
      period,
      indicators,
      validation: this.validateMandatory(standard),
    };
  }
}
