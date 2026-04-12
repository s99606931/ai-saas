// Test Ref: MTU-N457 §gdpr
import { describe, it, expect } from 'vitest';
import { GdprAnalyzer, GDPR_ARTICLES, kpipaFor } from '../src/index.js';

describe('GDPR — FR-GDPR.1/2', () => {
  it('핵심 조항 14개 이상', () => {
    expect(GDPR_ARTICLES.length).toBeGreaterThanOrEqual(14);
    expect(GDPR_ARTICLES.some((a) => a.id === 'Art.35')).toBe(true);
  });

  it('개보법 매핑 조회', () => {
    expect(kpipaFor('Art.15')).toContain('§35');
    expect(kpipaFor('Art.44')).toContain('§28-8');
    expect(kpipaFor('Art.99')).toBeUndefined();
  });
});

describe('GdprAnalyzer — FR-GDPR.3/5', () => {
  it('완전 준수 시 coverage 1.0', () => {
    const analyzer = new GdprAnalyzer();
    const inputs = GDPR_ARTICLES.map((a) => ({ articleId: a.id, compliant: true }));
    const r = analyzer.analyze(inputs);
    expect(r.coverage).toBe(1);
    expect(r.gaps.length).toBe(0);
    expect(r.internationalTransferChecked).toBe(true);
  });

  it('부분 준수 시 gap 수집', () => {
    const analyzer = new GdprAnalyzer();
    const r = analyzer.analyze([
      { articleId: 'Art.5', compliant: true },
      { articleId: 'Art.32', compliant: false, gap: '암호화 미적용' },
    ]);
    expect(r.compliantCount).toBe(1);
    expect(r.gaps.some((g) => g.articleId === 'Art.32' && g.gap === '암호화 미적용')).toBe(
      true,
    );
  });

  it('국외이전 미체크 플래그', () => {
    const analyzer = new GdprAnalyzer();
    const r = analyzer.analyze([{ articleId: 'Art.5', compliant: true }]);
    expect(r.internationalTransferChecked).toBe(false);
  });
});

describe('GdprAnalyzer.requiresDpia — FR-GDPR.4', () => {
  it('high 민감도 시 DPIA 필수', () => {
    const analyzer = new GdprAnalyzer();
    expect(analyzer.requiresDpia('high')).toBe(true);
    expect(analyzer.requiresDpia('medium')).toBe(false);
    expect(analyzer.requiresDpia('low')).toBe(false);
  });
});
