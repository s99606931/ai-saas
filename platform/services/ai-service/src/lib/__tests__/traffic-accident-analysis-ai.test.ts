import { describe, it, expect, beforeEach } from 'vitest';
import { TrafficAccidentAnalysisAI } from '../traffic-accident-analysis-ai';

describe('TrafficAccidentAnalysisAI', () => {
  let ai: TrafficAccidentAnalysisAI;

  beforeEach(() => {
    ai = new TrafficAccidentAnalysisAI();
  });

  it('사고를 기록한다', () => {
    ai.recordAccident({
      recordId: 'r1',
      locationCode: 'SEOUL-001',
      roadType: 'urban',
      weather: 'clear',
      vehicleCount: 2,
      injuredCount: 1,
      fatalityCount: 0,
      nightTime: false,
      timestamp: '2026-04-13T10:00:00Z',
    });
    expect(ai.listRecords().length).toBe(1);
    expect(ai.getAuditLog().some(l => l.action === 'RECORD_ACCIDENT')).toBe(true);
  });

  it('사망 사고는 fatal로 분류된다', () => {
    ai.recordAccident({
      recordId: 'r1',
      locationCode: 'HWY-1',
      roadType: 'highway',
      weather: 'rain',
      vehicleCount: 3,
      injuredCount: 2,
      fatalityCount: 1,
      nightTime: true,
      timestamp: '2026-04-13T22:00:00Z',
    });
    const risk = ai.assessRisk('r1');
    expect(risk.severity).toBe('fatal');
    expect(risk.riskScore).toBeGreaterThan(60);
  });

  it('경미한 사고는 minor로 분류된다', () => {
    ai.recordAccident({
      recordId: 'r1',
      locationCode: 'URB-1',
      roadType: 'urban',
      weather: 'clear',
      vehicleCount: 1,
      injuredCount: 0,
      fatalityCount: 0,
      nightTime: false,
      timestamp: '2026-04-13T12:00:00Z',
    });
    const risk = ai.assessRisk('r1');
    expect(risk.severity).toBe('minor');
  });

  it('위치 통계를 집계한다', () => {
    ai.recordAccident({
      recordId: 'r1',
      locationCode: 'X',
      roadType: 'urban',
      weather: 'clear',
      vehicleCount: 2,
      injuredCount: 1,
      fatalityCount: 0,
      nightTime: false,
      timestamp: '2026-04-13T10:00:00Z',
    });
    ai.recordAccident({
      recordId: 'r2',
      locationCode: 'X',
      roadType: 'urban',
      weather: 'rain',
      vehicleCount: 2,
      injuredCount: 2,
      fatalityCount: 0,
      nightTime: true,
      timestamp: '2026-04-13T20:00:00Z',
    });
    const stat = ai.getLocationStats('X');
    expect(stat.totalAccidents).toBe(2);
    expect(stat.totalInjured).toBe(3);
  });

  it('위험 집중 지점을 식별한다', () => {
    ai.recordAccident({
      recordId: 'r1',
      locationCode: 'HOT',
      roadType: 'school_zone',
      weather: 'snow',
      vehicleCount: 3,
      injuredCount: 4,
      fatalityCount: 1,
      nightTime: true,
      timestamp: '2026-04-13T07:30:00Z',
    });
    const hotspots = ai.identifyHotspots(40);
    expect(hotspots.length).toBeGreaterThan(0);
    expect(hotspots[0]?.locationCode).toBe('HOT');
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() =>
      ai.recordAccident(
        {
          recordId: 'r1',
          locationCode: 'X',
          roadType: 'urban',
          weather: 'clear',
          vehicleCount: 1,
          injuredCount: 0,
          fatalityCount: 0,
          nightTime: false,
          timestamp: '2026-04-13T10:00:00Z',
        },
        'S',
      ),
    ).toThrow('BLOCKED');
  });
});
