import { describe, it, expect } from 'vitest';
import { PublicRealEstateAppraiserAI } from '../public-real-estate-appraiser-ai.js';

describe('SVC-AI-ADV-R444 PublicRealEstateAppraiserAI', () => {
  const svc = new PublicRealEstateAppraiserAI();

  it('FR-444.4: 기본 평가', () => {
    const r = svc.appraise(
      { area: 100, use: 'residential', year: 2026 },
      [
        { area: 100, use: 'residential', year: 2026, price: 500000 },
        { area: 120, use: 'residential', year: 2026, price: 600000 },
      ],
    );
    expect(r.unitPrice).toBe(5000);
    expect(r.estimatedPrice).toBe(500000);
  });

  it('FR-444.3: 유사사례 없음 → 오류', () => {
    expect(() =>
      svc.appraise({ area: 100, use: 'commercial', year: 2026 }, [
        { area: 100, use: 'residential', year: 2026, price: 500000 },
      ]),
    ).toThrow('NO_COMPARABLES');
  });

  it('FR-444.3: 3건 이상 → 높은 신뢰도', () => {
    const r = svc.appraise(
      { area: 100, use: 'land', year: 2026 },
      [
        { area: 100, use: 'land', year: 2026, price: 100000 },
        { area: 100, use: 'land', year: 2026, price: 110000 },
        { area: 100, use: 'land', year: 2026, price: 120000 },
      ],
    );
    expect(r.confidence).toBe(0.95);
    expect(r.usedCount).toBe(3);
  });

  it('area <= 0 → 오류', () => {
    expect(() => svc.appraise({ area: 0, use: 'land', year: 2026 }, [])).toThrow(
      'INVALID_AREA',
    );
  });

  it('오래된 사례 가중치 감소', () => {
    const r = svc.appraise(
      { area: 100, use: 'residential', year: 2026 },
      [
        { area: 100, use: 'residential', year: 2026, price: 1000000 },
        { area: 100, use: 'residential', year: 2016, price: 500000 },
      ],
    );
    expect(r.unitPrice).toBeGreaterThan(8000);
  });

  it('FR-444.5: C 차단', () => {
    expect(() =>
      svc.appraise({ area: 100, use: 'land', year: 2026 }, [], 'C'),
    ).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.appraise({ area: 100, use: 'land', year: 2026 }, [
      { area: 100, use: 'land', year: 2026, price: 100000 },
    ]);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
