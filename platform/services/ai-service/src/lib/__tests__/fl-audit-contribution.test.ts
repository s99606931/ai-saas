import { describe, it, expect, beforeEach } from 'vitest';
import { FlAuditContribution } from '../fl-audit-contribution';

describe('FlAuditContribution', () => {
  let svc: FlAuditContribution;

  beforeEach(() => {
    svc = new FlAuditContribution();
    svc.append({ round: 1, clientId: 'c1', updateHash: 'h1', sampleCount: 100, lossDelta: 0.2 });
    svc.append({ round: 1, clientId: 'c2', updateHash: 'h2', sampleCount: 100, lossDelta: 0.1 });
    svc.append({ round: 1, clientId: 'c3', updateHash: 'h3', sampleCount: 100, lossDelta: -0.15 });
  });

  it('FR-FLA.1 감사 엔트리', () => {
    expect(svc.getEntries().length).toBe(3);
  });

  it('FR-FLA.2 Shapley 근사', () => {
    const scores = svc.computeShapley(['c1', 'c2', 'c3']);
    expect(scores[0]!.clientId).toBe('c1');
    expect(scores[0]!.shapleyApprox).toBeGreaterThan(scores[1]!.shapleyApprox);
  });

  it('FR-FLA.3 ranking', () => {
    const scores = svc.computeShapley(['c1', 'c2', 'c3']);
    const ranked = svc.rankClients(scores);
    expect(ranked[0]!.rank).toBe(1);
  });

  it('FR-FLA.4 이상 탐지', () => {
    const anomalies = svc.detectAnomalies(-0.1);
    expect(anomalies.length).toBe(1);
    expect(anomalies[0]!.clientId).toBe('c3');
  });

  it('FR-FLA.5 보상 계산', () => {
    const scores = svc.computeShapley(['c1', 'c2', 'c3']);
    const rewards = svc.calculateRewards(scores, 10000);
    const total = rewards.reduce((s, r) => s + r.amount, 0);
    expect(total).toBeLessThanOrEqual(10000);
  });
});
