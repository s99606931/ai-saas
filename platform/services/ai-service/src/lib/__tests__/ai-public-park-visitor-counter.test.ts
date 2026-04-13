import { describe, it, expect, beforeEach } from 'vitest';
import { AIPublicParkVisitorCounter } from '../ai-public-park-visitor-counter';

describe('AIPublicParkVisitorCounter', () => {
  let ai: AIPublicParkVisitorCounter;

  beforeEach(() => {
    ai = new AIPublicParkVisitorCounter();
  });

  it('존을 등록한다', () => {
    ai.registerZone({ zoneId: 'Z1', parkName: '중앙공원', capacity: 1000, area: 5000 });
    const est = ai.estimate('Z1');
    expect(est.currentVisitors).toBe(0);
    expect(est.crowdLevel).toBe('empty');
  });

  it('입장 이벤트 후 방문자 수 계산', () => {
    ai.registerZone({ zoneId: 'Z2', parkName: '근린공원', capacity: 200, area: 1000 });
    ai.recordGate({ zoneId: 'Z2', timestamp: '2026-04-13T10:00:00Z', entries: 100, exits: 20 });
    const est = ai.estimate('Z2');
    expect(est.currentVisitors).toBe(80);
  });

  it('정원 초과 시 overflow', () => {
    ai.registerZone({ zoneId: 'Z3', parkName: '소공원', capacity: 50, area: 500 });
    ai.recordGate({ zoneId: 'Z3', timestamp: '2026-04-13T11:00:00Z', entries: 80, exits: 0 });
    const est = ai.estimate('Z3');
    expect(est.crowdLevel).toBe('overflow');
    expect(est.recommendation).toContain('입장');
  });

  it('50% 이용 시 busy', () => {
    ai.registerZone({ zoneId: 'Z4', parkName: '공원', capacity: 100, area: 800 });
    ai.recordGate({ zoneId: 'Z4', timestamp: '2026-04-13T12:00:00Z', entries: 60, exits: 0 });
    const est = ai.estimate('Z4');
    expect(est.crowdLevel).toBe('busy');
  });

  it('없는 존 조회 시 오류', () => {
    expect(() => ai.estimate('none')).toThrow();
  });

  it('감사 로그에 ESTIMATE 기록', () => {
    ai.registerZone({ zoneId: 'Z5', parkName: 'p', capacity: 100, area: 500 });
    ai.estimate('Z5');
    expect(ai.getAuditLog().some((a) => a.action === 'ESTIMATE')).toBe(true);
  });
});
