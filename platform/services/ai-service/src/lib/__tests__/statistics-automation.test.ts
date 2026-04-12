import { describe, it, expect, beforeEach } from 'vitest';
import { StatisticsAutomation } from '../statistics-automation';

describe('StatisticsAutomation', () => {
  let svc: StatisticsAutomation;

  beforeEach(() => {
    svc = new StatisticsAutomation();
    svc.registerIndicator({ code: 'S001', name: '민원 건수', category: '행정', unit: '건', dataType: 'int' });
  });

  it('FR-STAT.1 지표 등록', () => {
    expect(() => svc.generateQuery('S001', '2026-04')).not.toThrow();
  });

  it('FR-STAT.2 쿼리 생성', () => {
    const q = svc.generateQuery('S001', '2026-04', ['region']);
    expect(q.indicatorCode).toBe('S001');
  });

  it('FR-STAT.3 보고서 템플릿', () => {
    const md = svc.buildReport([{ indicatorCode: 'S001', period: '2026-04', value: 12345 }]);
    expect(md).toContain('민원 건수');
    expect(md).toContain('12,345');
  });

  it('FR-STAT.4 품질 검증', () => {
    const issues = svc.validateQuality([
      { indicatorCode: 'S001', period: '2026-04', value: -5 },
      { indicatorCode: 'S001', period: '2026-04', value: 0 },
    ]);
    expect(issues.find((i) => i.severity === 'error')).toBeDefined();
  });

  it('FR-STAT.5 KOSIS 포맷', () => {
    const k = svc.toKosisFormat({ indicatorCode: 'S001', period: '2026-04', value: 100 }, 'ORG1', 'TBL1');
    expect(k.PRD_DE).toBe('202604');
    expect(k.DT).toBe('100');
  });
});
