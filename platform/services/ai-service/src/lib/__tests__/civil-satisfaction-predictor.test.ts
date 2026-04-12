import { describe, it, expect } from 'vitest';
import { CivilSatisfactionPredictor, type ComplaintFeatures } from '../civil-satisfaction-predictor.js';

describe('CivilSatisfactionPredictor', () => {
  const predictor = new CivilSatisfactionPredictor();

  const good: ComplaintFeatures = {
    id: 'c1',
    category: 'permit',
    channel: 'online',
    responseHours: 4,
    reassignmentCount: 0,
    priorContactCount: 0,
    textLength: 100,
    sentimentScore: 0.5,
  };

  const bad: ComplaintFeatures = {
    id: 'c2',
    category: 'tax',
    channel: 'phone',
    responseHours: 72,
    reassignmentCount: 3,
    priorContactCount: 5,
    textLength: 800,
    sentimentScore: -0.7,
  };

  it('긍정 케이스 → high', () => {
    const r = predictor.predict(good);
    expect(r.level).toBe('high');
    expect(r.riskFlag).toBe(false);
  });

  it('부정 케이스 → 리스크', () => {
    const r = predictor.predict(bad);
    expect(r.riskFlag).toBe(true);
    expect(r.recommendations.length).toBeGreaterThan(0);
  });

  it('배치 예측', () => {
    const r = predictor.batchPredict([good, bad]);
    expect(r).toHaveLength(2);
  });

  it('피드백 학습', () => {
    const before = predictor.predict(good).probability;
    predictor.updateFromFeedback([{ id: 'c1', features: good, actualSatisfaction: 1.0 }]);
    const after = predictor.predict(good).probability;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it('빈 피드백 거부', () => {
    expect(() => predictor.updateFromFeedback([])).toThrow('FEEDBACK_EMPTY');
  });
});
