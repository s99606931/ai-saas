import { describe, it, expect, beforeEach } from 'vitest';
import { ZerodayDetector, type BehaviorSample } from '../zeroday-detector';

describe('ZerodayDetector', () => {
  let svc: ZerodayDetector;

  beforeEach(() => {
    svc = new ZerodayDetector();
    const training: BehaviorSample[] = Array.from({ length: 50 }, (_, i) => ({
      entityId: 'host-1',
      metric: 'cpu',
      value: 40 + (i % 5),
      timestamp: `2026-04-11T${String(i).padStart(2, '0')}:00:00Z`,
    }));
    svc.learnBaseline(training);
  });

  it('FR-0D.1 베이스라인 학습', () => {
    const b = svc.learnBaseline([{ entityId: 'h', metric: 'net', value: 100, timestamp: '' }]);
    expect(b[0]!.mean).toBe(100);
  });

  it('FR-0D.2 이상 탐지 (Z-score 높음)', () => {
    const anom = svc.detect({ entityId: 'host-1', metric: 'cpu', value: 99, timestamp: '' });
    expect(anom).toBeDefined();
  });

  it('FR-0D.2 정상 (탐지 없음)', () => {
    const anom = svc.detect({ entityId: 'host-1', metric: 'cpu', value: 42, timestamp: '' });
    expect(anom).toBeUndefined();
  });

  it('FR-0D.3 심각도 분류', () => {
    const anom = svc.detect({ entityId: 'host-1', metric: 'cpu', value: 500, timestamp: '' });
    expect(anom?.severity).toBe('critical');
  });

  it('FR-0D.4/5 격리 + 인시던트', () => {
    const anom = svc.detect({ entityId: 'host-1', metric: 'cpu', value: 500, timestamp: '' });
    if (anom) {
      const incident = svc.createIncident([anom]);
      expect(incident.status).toBe('isolated');
      expect(svc.isIsolated('host-1')).toBe(true);
    }
  });
});
