import { describe, it, expect, beforeEach } from 'vitest';
import { PublicSafetyPredictionAi, type IncidentRecord } from '../public-safety-prediction-ai';

describe('PublicSafetyPredictionAi', () => {
  let ai: PublicSafetyPredictionAi;

  beforeEach(() => {
    ai = new PublicSafetyPredictionAi();
  });

  const sample = (over: Partial<IncidentRecord> = {}): IncidentRecord => ({
    recordId: 'i-1',
    regionCode: 'KR-11',
    type: 'fire',
    occurredAt: '2026-04-01T00:00:00.000Z',
    casualties: 0,
    weatherCondition: 'clear',
    ...over,
  });

  it('데이터 없는 지역 예측은 normal이다', () => {
    const result = ai.forecast('KR-99');
    expect(result.emergencyResponseLevel).toBe('normal');
    expect(result.riskScore).toBe(0);
  });

  it('많은 사고 다수 사상자는 critical이다', () => {
    for (let i = 0; i < 20; i++) {
      ai.ingest(sample({ recordId: `i-${i}`, casualties: 2 }));
    }
    const result = ai.forecast('KR-11');
    expect(result.emergencyResponseLevel).toBe('critical');
    expect(result.recommendedPatrols).toBe(12);
  });

  it('사고 유형별 핫스팟이 정렬된다', () => {
    ai.ingest(sample({ recordId: 'a', type: 'fire' }));
    ai.ingest(sample({ recordId: 'b', type: 'fire' }));
    ai.ingest(sample({ recordId: 'c', type: 'crime' }));
    const result = ai.forecast('KR-11');
    expect(result.hotspots[0]!.type).toBe('fire');
    expect(result.hotspots[0]!.count).toBe(2);
  });

  it('음수 사상자 입력은 거부한다', () => {
    expect(() => ai.ingest(sample({ casualties: -1 }))).toThrow('VALIDATION');
  });

  it('총 사고 건수를 합산한다', () => {
    ai.ingest(sample({ recordId: '1' }));
    ai.ingest(sample({ recordId: '2' }));
    expect(ai.totalIncidents()).toBe(2);
  });

  it('S등급 데이터는 차단된다', () => {
    expect(() => ai.ingest(sample(), 'S')).toThrow('BLOCKED');
  });
});
