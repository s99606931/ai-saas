/**
 * 고급 보안 테스트 (제로데이/공급망/랜섬웨어/UEBA)
 */

import {
  BehaviorBaseline,
  ZeroDayDetector,
  SupplyChainMonitor,
  RansomwareDetector,
  UserBehaviorAnalytics,
} from '../src/index';

describe('BehaviorBaseline + ZeroDayDetector', () => {
  it('정상 샘플은 anomalyScore 낮음', () => {
    const b = new BehaviorBaseline();
    b.train([
      { entityId: 'e1', timestamp: '', features: { cpu: 10, mem: 20 } },
      { entityId: 'e1', timestamp: '', features: { cpu: 12, mem: 22 } },
    ]);
    const score = b.anomalyScore({ entityId: 'e1', timestamp: '', features: { cpu: 11, mem: 21 } });
    expect(score).toBeLessThan(0.5);
  });

  it('미학습 entity → score 0', () => {
    const b = new BehaviorBaseline();
    expect(b.anomalyScore({ entityId: 'unknown', timestamp: '', features: { x: 1 } })).toBe(0);
  });

  it('ZeroDayDetector: 큰 편차 → critical 위험 + 격리', () => {
    const b = new BehaviorBaseline();
    b.train([{ entityId: 'e1', timestamp: '', features: { cpu: 10 } }]);
    const d = new ZeroDayDetector(b);
    const incident = d.detect({ entityId: 'e1', timestamp: '', features: { cpu: 100 } });
    expect(incident).not.toBeNull();
    expect(incident?.severity).toBe('critical');
    expect(incident?.isolated).toBe(true);
  });

  it('낮은 편차 → null', () => {
    const b = new BehaviorBaseline();
    b.train([{ entityId: 'e1', timestamp: '', features: { cpu: 10 } }]);
    const d = new ZeroDayDetector(b);
    expect(d.detect({ entityId: 'e1', timestamp: '', features: { cpu: 11 } })).toBeNull();
  });
});

describe('SupplyChainMonitor', () => {
  it('발행자 변경 탐지', () => {
    const m = new SupplyChainMonitor();
    m.register({
      packageName: 'lib-a',
      version: '1.0.0',
      publisher: 'orig',
      trustScore: 90,
      lastUpdated: '',
    });
    m.register({
      packageName: 'lib-a',
      version: '1.1.0',
      publisher: 'attacker',
      trustScore: 90,
      lastUpdated: '',
    });
    const anomalies = m.detectAnomaly('lib-a');
    expect(anomalies.find((a) => a.includes('발행자 변경'))).toBeDefined();
  });

  it('신뢰도 급락 탐지', () => {
    const m = new SupplyChainMonitor();
    m.register({
      packageName: 'lib-b',
      version: '1.0.0',
      publisher: 'p',
      trustScore: 95,
      lastUpdated: '',
    });
    m.register({
      packageName: 'lib-b',
      version: '1.1.0',
      publisher: 'p',
      trustScore: 50,
      lastUpdated: '',
    });
    const anomalies = m.detectAnomaly('lib-b');
    expect(anomalies.find((a) => a.includes('신뢰도'))).toBeDefined();
  });

  it('1개 등록 시 빈 결과', () => {
    const m = new SupplyChainMonitor();
    m.register({
      packageName: 'x',
      version: '1.0.0',
      publisher: 'p',
      trustScore: 90,
      lastUpdated: '',
    });
    expect(m.detectAnomaly('x')).toEqual([]);
  });
});

describe('RansomwareDetector', () => {
  it('대량 쓰기 + rename 패턴 탐지', () => {
    const d = new RansomwareDetector();
    const now = new Date().toISOString();
    const events: Array<{
      path: string;
      operation: 'read' | 'write' | 'delete' | 'rename';
      processId: string;
      timestamp: string;
    }> = [];
    for (let i = 0; i < 60; i++) {
      events.push({ path: `/f${i}`, operation: 'write', processId: 'malicious', timestamp: now });
    }
    for (let i = 0; i < 15; i++) {
      events.push({ path: `/f${i}.locked`, operation: 'rename', processId: 'malicious', timestamp: now });
    }
    const result = d.analyze(events);
    expect(result.suspiciousProcesses).toContain('malicious');
  });

  it('정상 패턴은 의심 아님', () => {
    const d = new RansomwareDetector();
    const events = [
      { path: '/f1', operation: 'write' as const, processId: 'normal', timestamp: new Date().toISOString() },
    ];
    expect(d.analyze(events).suspiciousProcesses).toEqual([]);
  });
});

describe('UserBehaviorAnalytics', () => {
  it('알려진 액션 + 정상 시간 → 낮은 위험', () => {
    const u = new UserBehaviorAnalytics();
    u.train([
      { userId: 'u1', timestamp: '2026-04-12T10:00:00Z', action: 'read', resource: 'r1', bytesTransferred: 1000 },
    ]);
    const r = u.assessRisk({
      userId: 'u1',
      timestamp: '2026-04-12T10:00:00Z',
      action: 'read',
      resource: 'r1',
      bytesTransferred: 1000,
    });
    expect(r.riskScore).toBeLessThan(50);
  });

  it('베이스라인 없음 → 50점', () => {
    const u = new UserBehaviorAnalytics();
    expect(
      u.assessRisk({
        userId: 'unknown',
        timestamp: '2026-04-12T10:00:00Z',
        action: 'read',
        resource: 'r',
      }).riskScore,
    ).toBe(50);
  });

  it('대용량 전송 + 신규 액션 + 야간 → 높은 점수', () => {
    const u = new UserBehaviorAnalytics();
    u.train([
      { userId: 'u1', timestamp: '2026-04-12T10:00:00Z', action: 'read', resource: 'r', bytesTransferred: 100 },
    ]);
    const r = u.assessRisk({
      userId: 'u1',
      timestamp: '2026-04-12T02:00:00Z',
      action: 'export',
      resource: 'sensitive',
      bytesTransferred: 1_000_000,
    });
    expect(r.riskScore).toBeGreaterThanOrEqual(70);
    expect(r.reasons.length).toBeGreaterThanOrEqual(2);
  });
});
