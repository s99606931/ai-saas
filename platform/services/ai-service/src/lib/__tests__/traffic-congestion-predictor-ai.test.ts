import { describe, it, expect } from 'vitest';
import { TrafficCongestionPredictorAI } from '../traffic-congestion-predictor-ai.js';

describe('SVC-AI-ADV-R451 TrafficCongestionPredictorAI', () => {
  const svc = new TrafficCongestionPredictorAI();

  it('FR-451.2: 피크 시간 HIGH', () => {
    const r = svc.predict([
      { roadId: 'r1', baseVolume: 1000, hour: 8, weather: 'clear', event: false },
    ]);
    // 1.6 * 1.0 * 1.0 = 1.6 → MED
    expect(r[0]!.level).toBe('MED');
  });

  it('FR-451.3: 눈 날씨 보정', () => {
    const r = svc.predict([
      { roadId: 'r1', baseVolume: 1000, hour: 8, weather: 'snow', event: false },
    ]);
    // 1.6 * 1.5 = 2.4 → HIGH
    expect(r[0]!.level).toBe('HIGH');
  });

  it('FR-451.4: 이벤트 추가', () => {
    const r = svc.predict([
      { roadId: 'r1', baseVolume: 1000, hour: 8, weather: 'rain', event: true },
    ]);
    // 1.6 * 1.2 * 1.3 = 2.496 → HIGH
    expect(r[0]!.level).toBe('HIGH');
  });

  it('FR-451.6: 야간 LOW', () => {
    const r = svc.predict([
      { roadId: 'r1', baseVolume: 1000, hour: 2, weather: 'clear', event: false },
    ]);
    // 0.5 * 1.0 = 0.5 → LOW
    expect(r[0]!.level).toBe('LOW');
  });

  it('hour 범위 오류', () => {
    expect(() =>
      svc.predict([
        { roadId: 'r1', baseVolume: 100, hour: 25, weather: 'clear', event: false },
      ]),
    ).toThrow('INVALID_HOUR');
  });

  it('baseVolume 음수 → 오류', () => {
    expect(() =>
      svc.predict([
        { roadId: 'r1', baseVolume: -1, hour: 8, weather: 'clear', event: false },
      ]),
    ).toThrow('INVALID_BASE');
  });

  it('FR-451.7: C 차단', () => {
    expect(() => svc.predict([], 'C')).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.predict([]);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
