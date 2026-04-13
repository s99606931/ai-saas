import { describe, it, expect, beforeEach } from 'vitest';
import { AIPropertyAppraisalAssistant } from '../ai-property-appraisal-assistant';

describe('AIPropertyAppraisalAssistant', () => {
  let ai: AIPropertyAppraisalAssistant;

  beforeEach(() => {
    ai = new AIPropertyAppraisalAssistant();
  });

  it('비교거래 없을 시 공시지가 기반으로 산정한다', () => {
    const r = ai.appraise({
      propertyId: 'A1',
      type: 'apartment',
      areaSqm: 85,
      publicPriceKrw: 500000000,
      comparables: [],
    });
    expect(r.estimatedKrw).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThan(0.5);
    expect(r.notes.some((n) => n.includes('비교 거래 없음'))).toBe(true);
  });

  it('동일 유형 비교거래를 가중 평균한다', () => {
    const r = ai.appraise({
      propertyId: 'A2',
      type: 'apartment',
      areaSqm: 80,
      publicPriceKrw: 400000000,
      comparables: [
        { id: 'c1', type: 'apartment', areaSqm: 80, soldPriceKrw: 420000000, soldDaysAgo: 30, distanceKm: 0.5 },
        { id: 'c2', type: 'apartment', areaSqm: 82, soldPriceKrw: 440000000, soldDaysAgo: 60, distanceKm: 1 },
        { id: 'c3', type: 'apartment', areaSqm: 78, soldPriceKrw: 410000000, soldDaysAgo: 90, distanceKm: 2 },
      ],
    });
    expect(r.estimatedKrw).toBeGreaterThan(380000000);
    expect(r.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('pricePerSqmKrw를 반환한다', () => {
    const r = ai.appraise({
      propertyId: 'A3',
      type: 'land',
      areaSqm: 100,
      publicPriceKrw: 200000000,
      comparables: [{ id: 'c', type: 'land', areaSqm: 100, soldPriceKrw: 250000000, soldDaysAgo: 10, distanceKm: 0 }],
    });
    expect(r.pricePerSqmKrw).toBeGreaterThan(0);
  });

  it('비교거래 부족 시 주의 노트를 추가한다', () => {
    const r = ai.appraise({
      propertyId: 'A4',
      type: 'house',
      areaSqm: 120,
      publicPriceKrw: 300000000,
      comparables: [{ id: 'c', type: 'house', areaSqm: 120, soldPriceKrw: 310000000, soldDaysAgo: 10, distanceKm: 0.2 }],
    });
    expect(r.notes.some((n) => n.includes('비교 거래 부족'))).toBe(true);
  });

  it('areaSqm가 0이면 오류를 던진다', () => {
    expect(() =>
      ai.appraise({ propertyId: 'A5', type: 'house', areaSqm: 0, publicPriceKrw: 1, comparables: [] }),
    ).toThrow('areaSqm');
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() =>
      ai.appraise(
        { propertyId: 'A6', type: 'house', areaSqm: 50, publicPriceKrw: 1e8, comparables: [] },
        'S' as never,
      ),
    ).toThrow('BLOCKED');
  });
});
