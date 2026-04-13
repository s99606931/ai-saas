import { describe, it, expect } from 'vitest';
import { PublicSectorAIReadiness } from '../public-sector-ai-readiness.js';

describe('SVC-AI-ADV-R458 PublicSectorAIReadiness', () => {
  const svc = new PublicSectorAIReadiness();

  it('FR-458.4: ADVANCED', () => {
    const r = svc.evaluate({ data: 5, infra: 5, talent: 5, governance: 5 });
    expect(r.score).toBe(1);
    expect(r.level).toBe('ADVANCED');
  });

  it('FR-458.4: PROGRESSING', () => {
    const r = svc.evaluate({ data: 4, infra: 3, talent: 3, governance: 3 });
    // (1.2+0.75+0.75+0.6)/5 = 0.66
    expect(r.level).toBe('PROGRESSING');
  });

  it('FR-458.4: EMERGING', () => {
    const r = svc.evaluate({ data: 2, infra: 2, talent: 2, governance: 2 });
    // 2/5 = 0.4
    expect(r.level).toBe('EMERGING');
  });

  it('FR-458.4: INITIAL', () => {
    const r = svc.evaluate({ data: 1, infra: 1, talent: 1, governance: 1 });
    expect(r.level).toBe('INITIAL');
  });

  it('FR-458.5: 최저 영역 식별', () => {
    const r = svc.evaluate({ data: 5, infra: 4, talent: 2, governance: 3 });
    expect(r.weakestArea).toBe('talent');
  });

  it('범위 오류', () => {
    expect(() =>
      svc.evaluate({ data: 6, infra: 3, talent: 3, governance: 3 }),
    ).toThrow('INVALID_DATA');
  });

  it('FR-458.6: C 차단', () => {
    expect(() =>
      svc.evaluate({ data: 3, infra: 3, talent: 3, governance: 3 }, 'C'),
    ).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.evaluate({ data: 3, infra: 3, talent: 3, governance: 3 });
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
