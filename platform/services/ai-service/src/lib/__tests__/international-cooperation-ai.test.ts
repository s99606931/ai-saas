/**
 * 국제 협력 AI 단위 테스트 — SVC-AI-ADV-R482
 * Plan SC: FR-482.1~6
 */

import { describe, it, expect } from 'vitest';
import { InternationalCooperationAi } from '../international-cooperation-ai';
import type { CooperationProject } from '../international-cooperation-ai';

const mk = (over: Partial<CooperationProject> = {}): CooperationProject => ({
  projectId: 'P1',
  partnerCountry: 'KR',
  domain: 'ICT',
  budgetUsd: 1_000_000,
  durationMonths: 12,
  expectedBeneficiaries: 100_000,
  ...over,
});

describe('InternationalCooperationAi — R482', () => {
  it('FR-482.1: ICT 도메인 우선 추천', () => {
    const ai = new InternationalCooperationAi();
    const r = ai.evaluate(mk());
    expect(r.recommendation).toBe('APPROVE');
  });

  it('FR-482.2: 고위험국 REJECT', () => {
    const ai = new InternationalCooperationAi();
    const r = ai.evaluate(mk({ partnerCountry: 'XX' }));
    expect(r.recommendation).toBe('REJECT');
    expect(r.riskLevel).toBe('HIGH');
  });

  it('FR-482.3: 수익자당 비용 반영', () => {
    const ai = new InternationalCooperationAi();
    const r = ai.evaluate(mk({ budgetUsd: 500_000_000, expectedBeneficiaries: 100 }));
    expect(r.costEffectiveness).toBeLessThan(50);
  });

  it('FR-482.4: 포트폴리오 랭킹', () => {
    const ai = new InternationalCooperationAi();
    const ranked = ai.rankPortfolio([
      mk({ projectId: 'A', domain: 'INFRASTRUCTURE' }),
      mk({ projectId: 'B', domain: 'ICT' }),
    ]);
    expect(ranked).toHaveLength(2);
    expect(ranked[0]!.projectId).toBe('B');
  });

  it('FR-482.5: audit 로그 누적', () => {
    const ai = new InternationalCooperationAi();
    ai.evaluate(mk());
    expect(ai.getAuditLog().length).toBeGreaterThan(0);
  });

  it('FR-482.6: C/S 차단', () => {
    const ai = new InternationalCooperationAi();
    expect(() => ai.evaluate(mk(), 'C')).toThrow(/N2SF_BLOCKED/);
    expect(() => ai.evaluate(mk(), 'S')).toThrow(/N2SF_BLOCKED/);
  });
});
