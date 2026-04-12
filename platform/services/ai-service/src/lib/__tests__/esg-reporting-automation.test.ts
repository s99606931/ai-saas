import { describe, it, expect, beforeEach } from 'vitest';
import { EsgReportingAutomation, type EsgIndicator } from '../esg-reporting-automation';

describe('EsgReportingAutomation', () => {
  let svc: EsgReportingAutomation;
  const griTemplate: EsgIndicator[] = [
    { standard: 'GRI', code: '302-1', name: '에너지 소비', category: 'E' },
    { standard: 'GRI', code: '305-1', name: 'Scope1 배출', category: 'E' },
    { standard: 'GRI', code: '401-1', name: '신규채용', category: 'S' },
  ];

  beforeEach(() => {
    svc = new EsgReportingAutomation();
    svc.registerTemplate('GRI', griTemplate);
    svc.registerTemplate('SASB', [{ standard: 'SASB', code: 'TC-SI-230a.1', name: '데이터 보안', category: 'G' }]);
    svc.registerTemplate('TCFD', [{ standard: 'TCFD', code: 'G-1', name: '거버넌스', category: 'G' }]);
  });

  it('FR-ESG.1~3 3대 표준 템플릿', () => {
    const list = svc.listStandards();
    expect(list).toContain('GRI');
    expect(list).toContain('SASB');
    expect(list).toContain('TCFD');
  });

  it('FR-ESG.4 지표 수집', () => {
    const src = new Map<string, number | string>([
      ['302-1', 12000],
      ['305-1', 450],
    ]);
    const collected = svc.collectIndicators('GRI', src);
    expect(collected.length).toBe(3);
    expect(collected[0]!.value).toBe(12000);
  });

  it('FR-ESG.5 보고서 생성 + 품질 점검', () => {
    const src = new Map<string, number | string>([
      ['302-1', 12000],
      ['305-1', 450],
      ['401-1', 20],
    ]);
    const collected = svc.collectIndicators('GRI', src);
    const report = svc.buildReport('GRI', '2026', collected);
    expect(report.coverage).toBe(1);
    expect(report.qualityIssues.length).toBe(0);
  });

  it('FR-ESG.5 커버리지 부족 경고', () => {
    const collected = svc.collectIndicators('GRI', new Map());
    const report = svc.buildReport('GRI', '2026', collected);
    expect(report.coverage).toBe(0);
    expect(report.qualityIssues.length).toBeGreaterThan(0);
  });
});
