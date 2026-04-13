/**
 * AI 정책 영향도 분석기 단위 테스트 — SVC-AI-ADV-R471
 * Plan SC: FR-471.1~6
 */

import { describe, it, expect } from 'vitest';
import { AiPolicyImpactAnalyzer } from '../ai-policy-impact-analyzer';
import type { PolicyProposal } from '../ai-policy-impact-analyzer';

const mk = (id: string, budget: number, pop: number, sectors: string[]): PolicyProposal => ({
  id,
  title: `P-${id}`,
  budgetKrw: budget,
  affectedPopulation: pop,
  sectors,
  durationMonths: 12,
});

describe('AiPolicyImpactAnalyzer — R471', () => {
  it('FR-471.1: 대규모 예산 정책 overall 점수 ≥ 60', () => {
    const a = new AiPolicyImpactAnalyzer();
    const score = a.analyze(mk('P1', 1_000_000_000_000, 10_000_000, ['economy', 'welfare']));
    expect(score.overall).toBeGreaterThanOrEqual(60);
    expect(['A', 'B', 'C', 'D']).toContain(score.grade);
  });

  it('FR-471.2: 환경 섹터 포함 시 environmental ≥ 80', () => {
    const a = new AiPolicyImpactAnalyzer();
    const score = a.analyze(mk('P2', 10_000_000_000, 100_000, ['environment']));
    expect(score.environmental).toBeGreaterThanOrEqual(80);
  });

  it('FR-471.3: 비교 분석 시 내림차순 정렬', () => {
    const a = new AiPolicyImpactAnalyzer();
    const list = [
      mk('A', 1_000_000_000, 1000, []),
      mk('B', 1_000_000_000_000, 10_000_000, ['welfare', 'economy']),
      mk('C', 100_000_000, 500, []),
    ];
    const ranked = a.compareProposals(list);
    expect(ranked[0]!.score.overall).toBeGreaterThanOrEqual(ranked[1]!.score.overall);
    expect(ranked[1]!.score.overall).toBeGreaterThanOrEqual(ranked[2]!.score.overall);
  });

  it('FR-471.4: 음수 예산/인구도 안전 처리', () => {
    const a = new AiPolicyImpactAnalyzer();
    const score = a.analyze({
      id: 'X',
      title: 'neg',
      budgetKrw: -100,
      affectedPopulation: -5,
      sectors: [],
      durationMonths: -1,
    });
    expect(Number.isFinite(score.overall)).toBe(true);
  });

  it('FR-471.5: audit 로그 기록', () => {
    const a = new AiPolicyImpactAnalyzer();
    a.analyze(mk('P', 1_000_000, 100, []));
    expect(a.getAuditLog().length).toBeGreaterThan(0);
    expect(a.getAuditLog()[0]!.action).toBe('POLICY_IMPACT_ANALYZE');
  });

  it('FR-471.6: C/S 등급 차단', () => {
    const a = new AiPolicyImpactAnalyzer();
    expect(() => a.analyze(mk('P', 1, 1, []), 'C')).toThrow(/N2SF_BLOCKED/);
    expect(() => a.analyze(mk('P', 1, 1, []), 'S')).toThrow(/N2SF_BLOCKED/);
  });
});
