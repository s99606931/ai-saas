import { describe, it, expect } from 'vitest';
import { PublicHealthTrendAnalyzer } from '../public-health-trend-analyzer.js';

describe('SVC-AI-ADV-R442 PublicHealthTrendAnalyzer', () => {
  const svc = new PublicHealthTrendAnalyzer();

  it('FR-442.3: 스파이크 감지', () => {
    const r = svc.analyze({
      category: 'flu',
      weeks: [10, 10, 10, 10, 30],
    });
    expect(r.status).toBe('SPIKE');
    expect(r.spikes).toContain(4);
  });

  it('FR-442.4: 증가율 계산', () => {
    const r = svc.analyze({ category: 'covid', weeks: [100, 150] });
    expect(r.growthPct).toBe(50);
  });

  it('안정 패턴', () => {
    const r = svc.analyze({
      category: 'flu',
      weeks: [10, 10, 10, 10, 11],
    });
    expect(r.status).toBe('STABLE');
  });

  it('첫 값 0 → growth 0', () => {
    const r = svc.analyze({ category: 'x', weeks: [0, 5] });
    expect(r.growthPct).toBe(0);
  });

  it('주차 부족 → 오류', () => {
    expect(() => svc.analyze({ category: 'x', weeks: [1] })).toThrow('INSUFFICIENT_WEEKS');
  });

  it('음수 → 오류', () => {
    expect(() => svc.analyze({ category: 'x', weeks: [1, -1] })).toThrow('NEGATIVE_VALUE');
  });

  it('FR-442.5: S 차단', () => {
    expect(() =>
      svc.analyze({ category: 'x', weeks: [1, 2] }, 'S'),
    ).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.analyze({ category: 'x', weeks: [1, 2] });
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
