import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceTopologyOptimizerV3 } from '../service-topology-optimizer-v3';

describe('ServiceTopologyOptimizerV3', () => {
  let svc: ServiceTopologyOptimizerV3;

  beforeEach(() => {
    svc = new ServiceTopologyOptimizerV3();
  });

  it('FR-R684.3: marks highest-load edge as HOTSPOT with SCALE recommendation', () => {
    svc.addEdge({ from: 'a', to: 'b', avgLatencyMs: 1000, rpm: 1000 });
    svc.addEdge({ from: 'a', to: 'c', avgLatencyMs: 100, rpm: 100 });
    svc.addEdge({ from: 'b', to: 'c', avgLatencyMs: 50, rpm: 10 });
    svc.addEdge({ from: 'c', to: 'd', avgLatencyMs: 10, rpm: 5 });
    svc.addEdge({ from: 'c', to: 'e', avgLatencyMs: 20, rpm: 5 });
    const results = svc.analyze();
    const hotspots = results.filter((r) => r.status === 'HOTSPOT');
    expect(hotspots.length).toBeGreaterThan(0);
    expect(hotspots[0]!.recommendation).toBe('SCALE');
  });

  it('FR-R684.4: CACHE recommendation for high-latency non-hotspot edges', () => {
    svc.addEdge({ from: 'x', to: 'y', avgLatencyMs: 600, rpm: 1 });
    svc.addEdge({ from: 'p', to: 'q', avgLatencyMs: 10000, rpm: 10000 });
    const results = svc.analyze();
    const xy = results.find((r) => r.from === 'x' && r.to === 'y');
    expect(xy?.recommendation).toBe('CACHE');
  });

  it('MONITOR for normal low-latency edges', () => {
    svc.addEdge({ from: 'hot', to: 'x', avgLatencyMs: 2000, rpm: 5000 });
    svc.addEdge({ from: 'm', to: 'n', avgLatencyMs: 100, rpm: 10 });
    const results = svc.analyze();
    const mn = results.find((r) => r.from === 'm' && r.to === 'n');
    expect(mn?.recommendation).toBe('MONITOR');
  });

  it('FR-R684.2: C/S blocked', () => {
    svc.addEdge({ from: 'a', to: 'b', avgLatencyMs: 50, rpm: 100 });
    expect(() => svc.analyze('C')).toThrow('BLOCKED');
    expect(() => svc.analyze('S')).toThrow('BLOCKED');
  });

  it('rejects invalid edge metrics; empty analyze returns []', () => {
    expect(() => svc.addEdge({ from: 'a', to: 'b', avgLatencyMs: -1, rpm: 1 })).toThrow(
      'INVALID_EDGE_METRIC',
    );
    expect(svc.analyze()).toEqual([]);
  });

  it('FR-R684.5: audit log records ADD_EDGE and ANALYZE', () => {
    svc.addEdge({ from: 'a', to: 'b', avgLatencyMs: 10, rpm: 10 });
    svc.analyze();
    const audit = svc.getAuditLog();
    expect(audit.some((e) => e.action === 'ADD_EDGE')).toBe(true);
    expect(audit.some((e) => e.action === 'ANALYZE')).toBe(true);
  });
});
