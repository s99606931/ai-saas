/**
 * 정부 조달 AI 어드바이저 단위 테스트 — SVC-AI-ADV-R477
 * Plan SC: FR-477.1~6
 */

import { describe, it, expect } from 'vitest';
import { GovProcurementAiAdvisor } from '../gov-procurement-ai-advisor';
import type { Bid } from '../gov-procurement-ai-advisor';

const mk = (id: string, o: Partial<Bid> = {}): Bid => ({
  bidderId: id,
  priceKrw: 100_000_000,
  technicalScore: 80,
  deliveryDays: 60,
  pastPerformance: 75,
  smallBusiness: false,
  ...o,
});

describe('GovProcurementAiAdvisor — R477', () => {
  it('FR-477.1: 1위 입찰자 추천', () => {
    const a = new GovProcurementAiAdvisor();
    const r = a.evaluateBids(
      [
        mk('B1', { priceKrw: 150_000_000, technicalScore: 70 }),
        mk('B2', { priceKrw: 100_000_000, technicalScore: 90 }),
        mk('B3', { priceKrw: 130_000_000, technicalScore: 85 }),
      ],
      120_000_000,
    );
    expect(r[0]!.rank).toBe(1);
    expect(r[0]!.recommended).toBe(true);
  });

  it('FR-477.2: 중소기업 가산점', () => {
    const a = new GovProcurementAiAdvisor();
    const r = a.evaluateBids(
      [mk('Big', { smallBusiness: false }), mk('Small', { smallBusiness: true })],
      120_000_000,
    );
    const small = r.find((x) => x.bidderId === 'Small')!;
    const big = r.find((x) => x.bidderId === 'Big')!;
    expect(small.totalScore).toBeGreaterThan(big.totalScore);
  });

  it('FR-477.3: 가격 낮을수록 priceScore 높음', () => {
    const a = new GovProcurementAiAdvisor();
    const r = a.evaluateBids(
      [mk('Low', { priceKrw: 50_000_000 }), mk('High', { priceKrw: 200_000_000 })],
      100_000_000,
    );
    const low = r.find((x) => x.bidderId === 'Low')!;
    const high = r.find((x) => x.bidderId === 'High')!;
    expect(low.priceScore).toBeGreaterThan(high.priceScore);
  });

  it('FR-477.4: 규정 준수 검사 — 기술점수 부족', () => {
    const a = new GovProcurementAiAdvisor();
    const issues = a.checkCompliance(mk('X', { technicalScore: 40 }));
    expect(issues).toContain('technical_below_threshold');
  });

  it('FR-477.5: audit 로그', () => {
    const a = new GovProcurementAiAdvisor();
    a.evaluateBids([mk('A')], 1);
    expect(a.getAuditLog().length).toBeGreaterThan(0);
  });

  it('FR-477.6: C/S 차단', () => {
    const a = new GovProcurementAiAdvisor();
    expect(() => a.evaluateBids([mk('A')], 1, 'C')).toThrow(/N2SF_BLOCKED/);
  });
});
