import { describe, it, expect, beforeEach } from 'vitest';
import { ElectionTurnoutPredictorAI } from '../election-turnout-predictor-ai';

describe('ElectionTurnoutPredictorAI', () => {
  let ai: ElectionTurnoutPredictorAI;

  const sample = (over = {}) => ({
    districtId: 'd1',
    electionType: 'presidential' as const,
    registeredVoters: 100000,
    historicalAvgTurnout: 0.77,
    under30Ratio: 0.25,
    over60Ratio: 0.30,
    weather: 'sunny' as const,
    isHoliday: false,
    ...over,
  });

  beforeEach(() => {
    ai = new ElectionTurnoutPredictorAI();
  });

  it('features를 검증한다', () => {
    ai.validateFeatures(sample());
    expect(ai.getAuditLog().some(l => l.action === 'VALIDATE_FEATURES')).toBe(true);
  });

  it('유권자수 0 이하는 거부', () => {
    expect(() => ai.validateFeatures(sample({ registeredVoters: 0 }))).toThrow(/유권자 수/);
  });

  it('대통령 선거 기준 투표율 예측', () => {
    const p = ai.predict(sample());
    expect(p.predictedTurnout).toBeGreaterThan(0.7);
    expect(p.predictedVoters).toBeGreaterThan(70000);
  });

  it('비 오는 날씨는 투표율을 낮춘다', () => {
    const sunny = ai.predict(sample({ districtId: 'd1' }));
    const rainy = ai.predict(sample({ districtId: 'd2', weather: 'rainy' }));
    expect(rainy.predictedTurnout).toBeLessThan(sunny.predictedTurnout);
  });

  it('재보궐 선거는 낮은 기준율', () => {
    const p = ai.predict(sample({ electionType: 'byelection', historicalAvgTurnout: 0.42 }));
    expect(p.predictedTurnout).toBeLessThan(0.6);
  });

  it('C등급 차단', () => {
    expect(() => ai.predict(sample(), 'C' as unknown as never)).toThrow(/BLOCKED/);
  });
});
