import { describe, it, expect, beforeEach } from 'vitest';
import { AICrimeHotspotAnalyzer } from '../ai-crime-hotspot-analyzer';

describe('AICrimeHotspotAnalyzer', () => {
  let ai: AICrimeHotspotAnalyzer;

  beforeEach(() => {
    ai = new AICrimeHotspotAnalyzer();
  });

  it('사건을 기록한다', () => {
    ai.recordIncident({ incidentId: 'i1', category: 'theft', gridX: 1, gridY: 2, severity: 5, timestamp: 't' });
    expect(ai.totalIncidents()).toBe(1);
  });

  it('핫스팟을 분석한다', () => {
    for (let i = 0; i < 4; i++) {
      ai.recordIncident({
        incidentId: `i${i}`,
        category: 'theft',
        gridX: 10,
        gridY: 20,
        severity: 7,
        timestamp: 't',
      });
    }
    const hs = ai.analyzeHotspots(3);
    expect(hs.length).toBe(1);
    expect(hs[0]?.dominantCategory).toBe('theft');
    expect(hs[0]?.incidentCount).toBe(4);
  });

  it('카테고리별 집계한다', () => {
    ai.recordIncident({ incidentId: 'a', category: 'theft', gridX: 0, gridY: 0, severity: 3, timestamp: 't' });
    ai.recordIncident({ incidentId: 'b', category: 'assault', gridX: 0, gridY: 0, severity: 8, timestamp: 't' });
    const c = ai.countByCategory();
    expect(c.theft).toBe(1);
    expect(c.assault).toBe(1);
  });

  it('지역별 사건을 조회한다', () => {
    ai.recordIncident({ incidentId: 'a', category: 'theft', gridX: 5, gridY: 5, severity: 3, timestamp: 't' });
    ai.recordIncident({ incidentId: 'b', category: 'theft', gridX: 6, gridY: 6, severity: 3, timestamp: 't' });
    expect(ai.incidentsInArea(5, 5).length).toBe(1);
  });

  it('유효하지 않은 심각도는 거부한다', () => {
    expect(() =>
      ai.recordIncident({ incidentId: 'x', category: 'theft', gridX: 0, gridY: 0, severity: 15, timestamp: 't' }),
    ).toThrow('심각도');
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.recordIncident(
        { incidentId: 'x', category: 'theft', gridX: 0, gridY: 0, severity: 5, timestamp: 't' },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
