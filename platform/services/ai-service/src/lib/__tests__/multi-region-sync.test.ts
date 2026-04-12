import { describe, it, expect, beforeEach } from 'vitest';
import { MultiRegionSync } from '../multi-region-sync';

describe('MultiRegionSync', () => {
  let svc: MultiRegionSync;

  beforeEach(() => {
    svc = new MultiRegionSync();
    svc.registerRegion({ id: 'kr', name: 'Seoul', latitude: 37.5, longitude: 127 });
    svc.registerRegion({ id: 'jp', name: 'Tokyo', latitude: 35.7, longitude: 139.7 });
  });

  it('FR-MR.1 리전 등록', () => {
    svc.addLink({ fromRegion: 'kr', toRegion: 'jp', baseLatencyMs: 30 });
    expect(svc.predictLatency('kr', 'jp')).toBeGreaterThan(10);
  });

  it('FR-MR.2 지연 예측', () => {
    const l = svc.predictLatency('kr', 'jp');
    expect(l).toBeGreaterThan(10);
  });

  it('FR-MR.3 배치 크기', () => {
    expect(svc.recommendBatchSize(30, 50)).toBe(1000);
    expect(svc.recommendBatchSize(200, 50)).toBe(100);
  });

  it('FR-MR.4 충돌 해결 (LWW)', () => {
    const r = svc.resolveConflict('k1', [
      { regionId: 'kr', timestamp: '2026-04-11T00:00:00Z' },
      { regionId: 'jp', timestamp: '2026-04-11T01:00:00Z' },
    ]);
    expect(r.winner).toBe('jp');
  });

  it('FR-MR.5 스냅샷', () => {
    const m = svc.snapshot('kr', 'jp', 1000, 2);
    expect(m.throughput).toBe(1000);
  });
});
