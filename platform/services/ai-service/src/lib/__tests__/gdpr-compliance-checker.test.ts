import { describe, it, expect, beforeEach } from 'vitest';
import { GdprComplianceChecker } from '../gdpr-compliance-checker';

describe('GdprComplianceChecker', () => {
  let svc: GdprComplianceChecker;

  beforeEach(() => {
    svc = new GdprComplianceChecker();
    svc.registerArticle({ code: 'Art.5', title: '처리 원칙', summary: '적법·공정·투명', mapsTo: '개보법 §3' });
    svc.registerArticle({ code: 'Art.6', title: '처리 근거', summary: '법적 근거', mapsTo: '개보법 §15' });
    svc.registerArticle({ code: 'Art.35', title: 'DPIA', summary: '영향평가', mapsTo: '개보법 §33' });
  });

  it('FR-GDPR.1~2 조항 등록 및 매핑', () => {
    const maps = svc.getMappings();
    expect(maps.length).toBe(3);
    expect(maps.find((m) => m.gdpr === 'Art.35')?.domestic).toBe('개보법 §33');
  });

  it('FR-GDPR.3 갭 분석', () => {
    const report = svc.analyzeGap([
      { articleCode: 'Art.5', status: 'compliant' },
      { articleCode: 'Art.6', status: 'partial' },
      { articleCode: 'Art.35', status: 'non-compliant' },
    ]);
    expect(report.gdprGaps).toContain('Art.35');
    expect(report.domesticGaps).toContain('개보법 §33');
    expect(report.compliantCount).toBe(1);
  });

  it('FR-GDPR.4 DPIA 필요성', () => {
    expect(svc.requiresDpia({ largeScale: true, specialCategories: true, systematicMonitoring: false })).toBe(true);
    expect(svc.requiresDpia({ largeScale: true, specialCategories: false, systematicMonitoring: false })).toBe(false);
  });

  it('FR-GDPR.5 국외이전 (SCC 승인)', () => {
    const r = svc.checkTransfer({ destCountry: 'US', mechanism: 'scc' });
    expect(r.approved).toBe(true);
  });

  it('FR-GDPR.5 국외이전 (미흡)', () => {
    const r = svc.checkTransfer({ destCountry: 'US', mechanism: 'none' });
    expect(r.approved).toBe(false);
  });
});
