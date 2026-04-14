import { describe, it, expect, beforeEach } from 'vitest';
import { PublicInfrastructureMonitorAIV3 } from '../public-infrastructure-monitor-ai-v3';

describe('PublicInfrastructureMonitorAIV3', () => {
  let monitor: PublicInfrastructureMonitorAIV3;

  beforeEach(() => {
    monitor = new PublicInfrastructureMonitorAIV3();
    monitor.registerAsset({ assetId: 'a1', category: 'network', criticality: 2 });
  });

  it('returns HEALTHY for low utilization / errors', () => {
    const v = monitor.ingestMetric({
      assetId: 'a1',
      operatorId: '900101-1',
      utilization: 20,
      errorRate: 2,
    });
    expect(v.status).toBe('HEALTHY');
    expect(v.health).toBe(76);
    expect(v.maskedOperatorId).toHaveLength(16);
    expect(v.maskedOperatorId).not.toContain('900101');
  });

  it('returns DEGRADED for mid range', () => {
    const v = monitor.ingestMetric({
      assetId: 'a1',
      operatorId: 'op',
      utilization: 50,
      errorRate: 5,
    });
    expect(v.status).toBe('DEGRADED');
  });

  it('returns CRITICAL and lists critical assets', () => {
    const v = monitor.ingestMetric({
      assetId: 'a1',
      operatorId: 'op',
      utilization: 70,
      errorRate: 10,
    });
    expect(v.status).toBe('CRITICAL');
    expect(monitor.getCritical().map((x) => x.assetId)).toEqual(['a1']);
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() =>
      monitor.ingestMetric(
        { assetId: 'a1', operatorId: 'op', utilization: 10, errorRate: 1 },
        'C',
      ),
    ).toThrow('BLOCKED');
    expect(() =>
      monitor.ingestMetric(
        { assetId: 'a1', operatorId: 'op', utilization: 10, errorRate: 1 },
        'S',
      ),
    ).toThrow('BLOCKED');
  });

  it('rejects unknown asset, invalid criticality and invalid metric', () => {
    expect(() =>
      monitor.ingestMetric({ assetId: 'x', operatorId: 'o', utilization: 1, errorRate: 1 }),
    ).toThrow('UNKNOWN_ASSET');
    expect(() =>
      monitor.registerAsset({ assetId: 'y', category: 'n', criticality: 9 }),
    ).toThrow('INVALID_CRITICALITY');
    expect(() =>
      monitor.ingestMetric({ assetId: 'a1', operatorId: 'o', utilization: -1, errorRate: 1 }),
    ).toThrow('INVALID_METRIC');
  });

  it('audit log masks operator id', () => {
    monitor.ingestMetric({
      assetId: 'a1',
      operatorId: '900101-1234567',
      utilization: 10,
      errorRate: 1,
    });
    const log = monitor.getAuditLog();
    expect(log.some((e) => e.action === 'INGEST_METRIC')).toBe(true);
    for (const entry of log) {
      expect(JSON.stringify(entry.details ?? {})).not.toContain('900101');
    }
  });
});
