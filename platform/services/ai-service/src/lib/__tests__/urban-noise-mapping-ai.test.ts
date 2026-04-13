import { describe, it, expect, beforeEach } from 'vitest';
import { UrbanNoiseMappingAI } from '../urban-noise-mapping-ai';

describe('UrbanNoiseMappingAI', () => {
  let ai: UrbanNoiseMappingAI;

  beforeEach(() => {
    ai = new UrbanNoiseMappingAI();
  });

  it('소음 측정값을 기록한다', () => {
    ai.recordReading({
      sensorId: 's1',
      zoneType: 'residential',
      timeBand: 'day',
      decibel: 50,
      timestamp: 't',
    });
    expect(ai.peakReading('s1')?.decibel).toBe(50);
  });

  it('위반을 감지한다', () => {
    ai.recordReading({
      sensorId: 's1',
      zoneType: 'residential',
      timeBand: 'night',
      decibel: 60,
      timestamp: 't',
    });
    const v = ai.detectViolations();
    expect(v.length).toBe(1);
    expect(v[0]?.excessDb).toBe(15);
  });

  it('허용 범위는 위반이 아니다', () => {
    ai.recordReading({
      sensorId: 's1',
      zoneType: 'industrial',
      timeBand: 'day',
      decibel: 65,
      timestamp: 't',
    });
    expect(ai.detectViolations().length).toBe(0);
  });

  it('구역별 평균을 계산한다', () => {
    ai.recordReading({ sensorId: 's1', zoneType: 'commercial', timeBand: 'day', decibel: 60, timestamp: 't' });
    ai.recordReading({ sensorId: 's2', zoneType: 'commercial', timeBand: 'day', decibel: 70, timestamp: 't' });
    expect(ai.avgByZone().commercial).toBe(65);
  });

  it('제한 데시벨을 반환한다', () => {
    expect(ai.getLimit('school_hospital', 'night')).toBe(40);
    expect(ai.getLimit('residential', 'day')).toBe(55);
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() =>
      ai.recordReading(
        { sensorId: 's1', zoneType: 'residential', timeBand: 'day', decibel: 50, timestamp: 't' },
        'S',
      ),
    ).toThrow('BLOCKED');
  });
});
