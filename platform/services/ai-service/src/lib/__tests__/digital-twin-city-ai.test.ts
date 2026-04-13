/**
 * 디지털 트윈 도시 AI 단위 테스트 — SVC-AI-ADV-R475
 * Plan SC: FR-475.1~6
 */

import { describe, it, expect } from 'vitest';
import { DigitalTwinCityAi } from '../digital-twin-city-ai';
import type { CityZone } from '../digital-twin-city-ai';

const zone: CityZone = {
  id: 'Z1',
  populationDensity: 10_000,
  trafficVolume: 5_000,
  greenCoverage: 0.3,
  airQualityIdx: 60,
  buildings: 200,
};

describe('DigitalTwinCityAi — R475', () => {
  it('FR-475.1: NORMAL 시나리오 기본값', () => {
    const ai = new DigitalTwinCityAi();
    const r = ai.simulate(zone, 'NORMAL');
    expect(r.scenario).toBe('NORMAL');
    expect(r.predictedCongestion).toBeGreaterThanOrEqual(0);
    expect(r.predictedCongestion).toBeLessThanOrEqual(100);
  });

  it('FR-475.2: EMERGENCY 시 congestion/AQI 상승', () => {
    const ai = new DigitalTwinCityAi();
    const n = ai.simulate(zone, 'NORMAL');
    const e = ai.simulate(zone, 'EMERGENCY');
    expect(e.predictedCongestion).toBeGreaterThan(n.predictedCongestion);
    expect(e.predictedAQI).toBeGreaterThan(n.predictedAQI);
  });

  it('FR-475.3: 녹지 많을수록 sustainability 상승', () => {
    const ai = new DigitalTwinCityAi();
    const low = ai.simulate({ ...zone, greenCoverage: 0.05 }, 'NORMAL');
    const high = ai.simulate({ ...zone, greenCoverage: 0.9 }, 'NORMAL');
    expect(high.sustainabilityScore).toBeGreaterThan(low.sustainabilityScore);
  });

  it('FR-475.4: compareScenarios 모두 반환', () => {
    const ai = new DigitalTwinCityAi();
    const r = ai.compareScenarios(zone, ['NORMAL', 'EVENT', 'EMERGENCY']);
    expect(r).toHaveLength(3);
  });

  it('FR-475.5: audit 로그', () => {
    const ai = new DigitalTwinCityAi();
    ai.simulate(zone, 'NORMAL');
    expect(ai.getAuditLog().length).toBeGreaterThan(0);
  });

  it('FR-475.6: C/S 차단', () => {
    const ai = new DigitalTwinCityAi();
    expect(() => ai.simulate(zone, 'NORMAL', 'S')).toThrow(/N2SF_BLOCKED/);
  });
});
