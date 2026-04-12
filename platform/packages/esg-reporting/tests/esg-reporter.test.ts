// Test Ref: MTU-N452 §esg-reporter
// Plan SC: FR-ESG.1 ~ FR-ESG.5
import { describe, it, expect } from 'vitest';
import {
  EsgReporter,
  GRI_INDICATORS,
  SASB_INDICATORS,
  TCFD_INDICATORS,
  getStandardIndicators,
} from '../src/index.js';

describe('Standard indicators — FR-ESG.1/2/3', () => {
  it('GRI 지표 존재', () => {
    expect(GRI_INDICATORS.length).toBeGreaterThanOrEqual(10);
    expect(GRI_INDICATORS.some((i) => i.id === 'GRI-305-1')).toBe(true);
  });

  it('SASB 지표 존재', () => {
    expect(SASB_INDICATORS.length).toBeGreaterThanOrEqual(5);
  });

  it('TCFD 4대 영역 커버', () => {
    const cats = new Set(TCFD_INDICATORS.map((i) => i.category));
    expect(cats.has('governance')).toBe(true);
    expect(cats.has('strategy')).toBe(true);
    expect(cats.has('risk')).toBe(true);
    expect(cats.has('metrics')).toBe(true);
  });

  it('getStandardIndicators 라우팅', () => {
    expect(getStandardIndicators('GRI')).toBe(GRI_INDICATORS);
    expect(getStandardIndicators('SASB')).toBe(SASB_INDICATORS);
    expect(getStandardIndicators('TCFD')).toBe(TCFD_INDICATORS);
  });
});

describe('EsgReporter.buildSection — FR-ESG.4', () => {
  it('필수 지표 전부 제공 시 coverage 1.0', () => {
    const rep = new EsgReporter();
    const values = GRI_INDICATORS.filter((i) => i.required).map((i) => ({
      id: i.id,
      value: 'provided',
    }));
    const sec = rep.buildSection('GRI', values);
    expect(sec.coverage).toBe(1);
    expect(sec.missing).toEqual([]);
  });

  it('필수 지표 누락 시 missing 수집', () => {
    const rep = new EsgReporter();
    const sec = rep.buildSection('TCFD', [
      { id: 'TCFD-G-A', value: 'ok' },
    ]);
    expect(sec.coverage).toBeLessThan(1);
    expect(sec.missing).toContain('TCFD-G-B');
  });

  it('값 0은 유효한 값으로 간주', () => {
    const rep = new EsgReporter();
    const sec = rep.buildSection('SASB', [
      { id: 'SASB-GHG-1', value: 0 },
      { id: 'SASB-EN-1', value: 0 },
      { id: 'SASB-WT-1', value: 0 },
      { id: 'SASB-HC-1', value: 'N/A' },
      { id: 'SASB-LD-1', value: '이사회' },
    ]);
    expect(sec.coverage).toBe(1);
  });
});

describe('EsgReporter.buildReport — FR-ESG.5', () => {
  it('3개 표준 전체 보고서 + 품질 이슈', () => {
    const rep = new EsgReporter();
    const report = rep.buildReport({
      period: '2026Q1',
      values: {
        GRI: [{ id: 'GRI-305-1', value: 10 }],
        SASB: [{ id: 'SASB-GHG-1', value: 10 }],
        TCFD: [{ id: 'TCFD-M-B', value: 10 }],
      },
    });
    expect(report.period).toBe('2026Q1');
    expect(report.overallCoverage).toBeGreaterThan(0);
    expect(report.overallCoverage).toBeLessThan(1);
    expect(report.qualityIssues.length).toBeGreaterThan(0);
    expect(report.summary).toContain('2026Q1');
    expect(report.summary).toContain('GRI');
    expect(report.summary).toContain('TCFD');
  });

  it('모든 필수 지표 충족 시 품질 이슈 없음', () => {
    const rep = new EsgReporter();
    const values: Record<'GRI' | 'SASB' | 'TCFD', Array<{ id: string; value: number }>> = {
      GRI: GRI_INDICATORS.filter((i) => i.required).map((i) => ({ id: i.id, value: 1 })),
      SASB: SASB_INDICATORS.filter((i) => i.required).map((i) => ({ id: i.id, value: 1 })),
      TCFD: TCFD_INDICATORS.filter((i) => i.required).map((i) => ({ id: i.id, value: 1 })),
    };
    const report = rep.buildReport({ period: '2026', values });
    expect(report.overallCoverage).toBe(1);
    expect(report.qualityIssues).toEqual([]);
  });
});
