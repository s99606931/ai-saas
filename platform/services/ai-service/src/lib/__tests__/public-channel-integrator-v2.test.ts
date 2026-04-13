import { describe, it, expect, beforeEach } from 'vitest';
import { TrafficCongestionPredictor, type TrafficInput } from '../public-channel-integrator-v2';

describe('TrafficCongestionPredictor', () => {
  let predictor: TrafficCongestionPredictor;

  beforeEach(() => {
    predictor = new TrafficCongestionPredictor();
  });

  it('applies peak hour factor 1.6 for morning rush (hour=8)', () => {
    const inputs: TrafficInput[] = [
      { roadId: 'R1', baseVolume: 1000, hour: 8, weather: 'clear', event: false },
    ];
    const preds = predictor.predict(inputs);
    expect(preds[0]!.predicted).toBe(1600);
    expect(preds[0]!.ratio).toBeCloseTo(1.6, 1);
  });

  it('applies snow weather factor 1.5', () => {
    const inputs: TrafficInput[] = [
      { roadId: 'R2', baseVolume: 1000, hour: 12, weather: 'snow', event: false },
    ];
    const preds = predictor.predict(inputs);
    // day=1.0 * snow=1.5 = 1.5
    expect(preds[0]!.predicted).toBe(1500);
  });

  it('adds +0.3 for event', () => {
    const inputs: TrafficInput[] = [
      { roadId: 'R3', baseVolume: 1000, hour: 12, weather: 'clear', event: true },
    ];
    const preds = predictor.predict(inputs);
    // day=1.0 + event=0.3 = 1.3
    expect(preds[0]!.ratio).toBeCloseTo(1.3, 1);
    expect(preds[0]!.level).toBe('MED');
  });

  it('returns HIGH level when ratio >= 2.0', () => {
    const inputs: TrafficInput[] = [
      { roadId: 'R4', baseVolume: 1000, hour: 8, weather: 'snow', event: false },
    ];
    const preds = predictor.predict(inputs);
    // peak=1.6 * snow=1.5 = 2.4
    expect(preds[0]!.level).toBe('HIGH');
  });

  it('returns LOW level for night clear no event', () => {
    const inputs: TrafficInput[] = [
      { roadId: 'R5', baseVolume: 1000, hour: 2, weather: 'clear', event: false },
    ];
    const preds = predictor.predict(inputs);
    expect(preds[0]!.level).toBe('LOW');
  });

  it('records audit log', () => {
    predictor.predict([
      { roadId: 'R6', baseVolume: 500, hour: 9, weather: 'rain', event: false },
    ]);
    const log = predictor.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0]!.action).toBe('traffic.predict');
  });
});
