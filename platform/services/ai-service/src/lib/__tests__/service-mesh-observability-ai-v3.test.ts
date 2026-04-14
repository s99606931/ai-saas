import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceMeshObservabilityAIV3 } from '../service-mesh-observability-ai-v3';

describe('ServiceMeshObservabilityAIV3', () => {
  let mesh: ServiceMeshObservabilityAIV3;

  beforeEach(() => {
    mesh = new ServiceMeshObservabilityAIV3();
    mesh.registerService({ serviceId: 's1', name: 'orders', sloMs: 100 });
  });

  it('classifies CRITICAL + PAGE for ratio >= 3.0', () => {
    const f = mesh.ingestMetric({ metricId: 'm', serviceId: 's1', latencyMs: 350, errorRate: 0 });
    expect(f.health).toBe('CRITICAL');
    expect(f.action).toBe('PAGE');
  });

  it('classifies WARNING + INVESTIGATE for ratio 1.5~3', () => {
    const f = mesh.ingestMetric({ metricId: 'm', serviceId: 's1', latencyMs: 200, errorRate: 0 });
    expect(f.health).toBe('WARNING');
    expect(f.action).toBe('INVESTIGATE');
  });

  it('classifies HEALTHY + OBSERVE for ratio < 1.5', () => {
    const f = mesh.ingestMetric({ metricId: 'm', serviceId: 's1', latencyMs: 80, errorRate: 0 });
    expect(f.health).toBe('HEALTHY');
    expect(f.action).toBe('OBSERVE');
  });

  it('escalates one rank when errorRate >= 0.05', () => {
    const f = mesh.ingestMetric({ metricId: 'm', serviceId: 's1', latencyMs: 80, errorRate: 0.1 });
    expect(f.action).toBe('INVESTIGATE');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() =>
      mesh.ingestMetric({ metricId: 'm', serviceId: 's1', latencyMs: 50, errorRate: 0 }, 'C'),
    ).toThrow('BLOCKED');
    expect(() =>
      mesh.ingestMetric({ metricId: 'm', serviceId: 's1', latencyMs: 50, errorRate: 0 }, 'S'),
    ).toThrow('BLOCKED');
  });

  it('rejects unknown service and invalid metric', () => {
    expect(() =>
      mesh.ingestMetric({ metricId: 'm', serviceId: 'unknown', latencyMs: 50, errorRate: 0 }),
    ).toThrow('UNKNOWN_SERVICE');
    expect(() =>
      mesh.ingestMetric({ metricId: 'm', serviceId: 's1', latencyMs: 50, errorRate: 2 }),
    ).toThrow('INVALID_METRIC');
    expect(() => mesh.registerService({ serviceId: 'x', name: 'x', sloMs: 0 })).toThrow(
      'INVALID_SLO',
    );
  });

  it('lists paging findings and maintains audit log', () => {
    mesh.ingestMetric({ metricId: 'm1', serviceId: 's1', latencyMs: 500, errorRate: 0 });
    mesh.ingestMetric({ metricId: 'm2', serviceId: 's1', latencyMs: 50, errorRate: 0 });
    expect(mesh.getPagingFindings().map((f) => f.metricId)).toEqual(['m1']);
    expect(mesh.getAuditLog().some((e) => e.action === 'INGEST_METRIC')).toBe(true);
  });
});
