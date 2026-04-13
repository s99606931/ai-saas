import { describe, it, expect, beforeEach } from 'vitest';
import { RoadSafetyAnalyticsAI } from '../road-safety-analytics-ai';

describe('RoadSafetyAnalyticsAI', () => {
  let ai: RoadSafetyAnalyticsAI;

  beforeEach(() => {
    ai = new RoadSafetyAnalyticsAI();
    ai.registerRoad({ roadId: 'r1', name: '올림픽대로', lengthKm: 36, speedLimit: 80 });
    ai.registerRoad({ roadId: 'r2', name: '강변북로', lengthKm: 29, speedLimit: 70 });
  });

  it('도로와 사고를 등록한다', () => {
    ai.recordAccident({
      accidentId: 'a1',
      roadId: 'r1',
      occurredAt: 't',
      severity: 'minor',
      injured: 1,
      fatalities: 0,
      weather: 'clear',
    });
    expect(ai.listAccidents('r1').length).toBe(1);
  });

  it('블랙스팟을 탐지한다', () => {
    for (let i = 0; i < 4; i++) {
      ai.recordAccident({
        accidentId: `a${i}`,
        roadId: 'r1',
        occurredAt: 't',
        severity: i === 0 ? 'fatal' : 'serious',
        injured: 2,
        fatalities: i === 0 ? 1 : 0,
        weather: 'rain',
      });
    }
    const spots = ai.detectBlackSpots(3);
    expect(spots.length).toBe(1);
    expect(spots[0]!.roadId).toBe('r1');
    expect(spots[0]!.fatalityCount).toBe(1);
  });

  it('임계값 미만 도로는 블랙스팟에서 제외한다', () => {
    ai.recordAccident({
      accidentId: 'a1',
      roadId: 'r2',
      occurredAt: 't',
      severity: 'minor',
      injured: 0,
      fatalities: 0,
      weather: 'clear',
    });
    const spots = ai.detectBlackSpots(3);
    expect(spots.length).toBe(0);
  });

  it('도로 통계를 계산한다', () => {
    ai.recordAccident({
      accidentId: 'a1',
      roadId: 'r1',
      occurredAt: 't',
      severity: 'fatal',
      injured: 3,
      fatalities: 1,
      weather: 'fog',
    });
    const stats = ai.getRoadStats('r1');
    expect(stats.totalAccidents).toBe(1);
    expect(stats.fatalities).toBe(1);
    expect(stats.injured).toBe(3);
  });

  it('미등록 도로의 사고는 거부한다', () => {
    expect(() =>
      ai.recordAccident({
        accidentId: 'a1',
        roadId: 'unknown',
        occurredAt: 't',
        severity: 'minor',
        injured: 0,
        fatalities: 0,
        weather: 'clear',
      }),
    ).toThrow('도로 미등록');
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerRoad({ roadId: 'r3', name: 'x', lengthKm: 1, speedLimit: 50 }, 'S'),
    ).toThrow('BLOCKED');
  });
});
