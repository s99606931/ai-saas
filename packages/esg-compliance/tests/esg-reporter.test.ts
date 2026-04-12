/**
 * ESG 리포팅 테스트 (GRI/SASB/TCFD)
 * Plan SC: FR-ESG.1~5
 */

import {
  EsgReporter,
  GRI_INDICATORS,
  SASB_INDICATORS,
  TCFD_INDICATORS,
} from '../src/esg-reporter';

describe('ESG 표준 지표 정의', () => {
  it('GRI/SASB/TCFD 지표 사전 등록', () => {
    expect(GRI_INDICATORS.length).toBeGreaterThan(0);
    expect(SASB_INDICATORS.length).toBeGreaterThan(0);
    expect(TCFD_INDICATORS.length).toBeGreaterThan(0);
  });

  it('GRI: GRI-2-1 조직 세부사항 필수', () => {
    const item = GRI_INDICATORS.find((i) => i.id === 'GRI-2-1');
    expect(item?.mandatory).toBe(true);
  });

  it('TCFD: 4대 영역 모두 포함 (governance/strategy/risk/metrics)', () => {
    const cats = new Set(TCFD_INDICATORS.map((i) => i.category));
    expect(cats.has('governance')).toBe(true);
    expect(cats.has('strategy')).toBe(true);
    expect(cats.has('risk')).toBe(true);
    expect(cats.has('metrics')).toBe(true);
  });
});

describe('EsgReporter', () => {
  let reporter: EsgReporter;
  beforeEach(() => {
    reporter = new EsgReporter();
  });

  it('setValue: 등록된 지표값 입력 성공', () => {
    reporter.setValue({
      indicatorId: 'GRI-2-7',
      value: 1500,
      unit: '명',
      period: '2026',
      source: 'HRIS',
    });
    expect(reporter.getValue('GRI-2-7')?.value).toBe(1500);
  });

  it('setValue: 미등록 지표 입력 시 오류', () => {
    expect(() =>
      reporter.setValue({
        indicatorId: 'UNKNOWN-001',
        value: 1,
        period: '2026',
        source: 'x',
      }),
    ).toThrow(/알 수 없는 지표/);
  });

  it('validateMandatory: 모든 필수 누락 시 0% 커버리지', () => {
    const result = reporter.validateMandatory('GRI');
    expect(result.complete).toBe(false);
    expect(result.coverage).toBe(0);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it('validateMandatory: 일부 채우면 부분 커버리지', () => {
    reporter.setValue({
      indicatorId: 'GRI-2-1',
      value: '공공기관 X',
      period: '2026',
      source: 'manual',
    });
    const result = reporter.validateMandatory('GRI');
    expect(result.coverage).toBeGreaterThan(0);
    expect(result.coverage).toBeLessThan(100);
  });

  it('generate: 표준별 리포트 indicators + validation 포함', () => {
    reporter.setValue({
      indicatorId: 'TCFD-MET-A',
      value: 1234,
      unit: 'tCO2e',
      period: '2026',
      source: 'carbon-tracker',
    });
    const report = reporter.generate('TCFD', '2026');
    expect(report.standard).toBe('TCFD');
    expect(report.indicators.length).toBe(TCFD_INDICATORS.length);
    expect(report.validation).toBeDefined();
    const filled = report.indicators.find((i) => i.def.id === 'TCFD-MET-A');
    expect(filled?.value?.value).toBe(1234);
  });

  it('SASB 표준 리포트 생성', () => {
    const report = reporter.generate('SASB', '2026');
    expect(report.indicators.length).toBe(SASB_INDICATORS.length);
  });

  it('잘못된 period 형식 시 zod 오류', () => {
    expect(() =>
      reporter.setValue({
        indicatorId: 'GRI-2-7',
        value: 1,
        period: 'invalid',
        source: 'x',
      }),
    ).toThrow();
  });
});
