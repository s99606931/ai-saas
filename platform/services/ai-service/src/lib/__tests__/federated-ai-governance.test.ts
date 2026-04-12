import { describe, it, expect } from 'vitest';
import { FederatedAiGovernance, type NodeUpdate } from '../federated-ai-governance';

describe('FederatedAiGovernance', () => {
  const svc = new FederatedAiGovernance();

  it('registers nodes uniquely', () => {
    const nodes = svc.registerNode([], { nodeId: 'n1', agencyName: '기관1', publicKeyFingerprint: 'abc' }, '2026-04-12');
    expect(nodes.length).toBe(1);
    expect(() =>
      svc.registerNode(nodes, { nodeId: 'n1', agencyName: '중복', publicKeyFingerprint: 'xyz' }, '2026-04-12'),
    ).toThrow();
  });

  it('aggregates federated average', () => {
    const updates: NodeUpdate[] = [
      { nodeId: 'n1', weights: [1.0, 2.0], sampleCount: 100 },
      { nodeId: 'n2', weights: [3.0, 4.0], sampleCount: 100 },
    ];
    const avg = svc.aggregateFedAvg(updates);
    expect(avg[0]).toBe(2.0);
    expect(avg[1]).toBe(3.0);
  });

  it('computes normalized contributions summing to 1', () => {
    const updates: NodeUpdate[] = [
      { nodeId: 'n1', weights: [1], sampleCount: 100 },
      { nodeId: 'n2', weights: [1], sampleCount: 300 },
    ];
    const contribs = svc.computeContributions(updates);
    const sum = contribs.reduce((a, c) => a + c.score, 0);
    expect(sum).toBeCloseTo(1, 2);
    const n2 = contribs.find((c) => c.nodeId === 'n2');
    expect(n2?.score).toBeGreaterThan(0.7);
  });

  it('publishes model version', () => {
    const versions = svc.publishVersion([], {
      modelId: 'm1',
      version: '1.0',
      weights: [0.1, 0.2],
      round: 1,
      contributingNodes: ['n1'],
    });
    expect(versions.length).toBe(1);
  });

  it('creates audit events', () => {
    const audit = svc.audit('aggregate', '2026-04-12T00:00:00Z', { round: 5 });
    expect(audit.eventType).toBe('aggregate');
    expect(audit.round).toBe(5);
  });

  it('rejects dimension mismatch', () => {
    const updates: NodeUpdate[] = [
      { nodeId: 'n1', weights: [1, 2], sampleCount: 100 },
      { nodeId: 'n2', weights: [1], sampleCount: 100 },
    ];
    expect(() => svc.aggregateFedAvg(updates)).toThrow();
  });
});
