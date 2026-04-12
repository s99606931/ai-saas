import { describe, it, expect } from 'vitest';
import { ServiceTopologyAi, type TraceCall } from '../service-topology-ai';

describe('ServiceTopologyAi', () => {
  const svc = new ServiceTopologyAi();

  const calls: TraceCall[] = [
    { fromService: 'gateway', toService: 'user-svc', latencyMs: 50, errorCount: 0, callCount: 1000 },
    { fromService: 'gateway', toService: 'order-svc', latencyMs: 80, errorCount: 5, callCount: 500 },
    { fromService: 'order-svc', toService: 'payment-svc', latencyMs: 200, errorCount: 10, callCount: 500 },
    { fromService: 'payment-svc', toService: 'gateway', latencyMs: 30, errorCount: 0, callCount: 100 },
  ];

  it('builds topology graph', () => {
    const graph = svc.buildGraph(calls);
    expect(graph.nodes.length).toBe(4);
    expect(graph.edges.length).toBe(4);
    expect(graph.edges[0]?.strength).toBeGreaterThan(0);
  });

  it('detects cycles', () => {
    const graph = svc.buildGraph(calls);
    const cycles = svc.detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('computes blast radius for payment failure', () => {
    const graph = svc.buildGraph(calls);
    const blast = svc.computeBlastRadius(graph, 'payment-svc');
    expect(blast.affectedServices).toContain('order-svc');
    expect(blast.downstreamCount).toBeGreaterThanOrEqual(1);
  });

  it('generates Mermaid diagram', () => {
    const graph = svc.buildGraph(calls);
    const mermaid = svc.toMermaid(graph);
    expect(mermaid).toContain('graph LR');
    expect(mermaid).toContain('gateway');
  });
});
