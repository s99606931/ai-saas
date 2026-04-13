import { describe, it, expect, beforeEach } from 'vitest';
import { UrbanHeatIslandDetector, type GridCell } from '../ai-urban-heat-island-detector';

const sampleCell = (id: string, overrides: Partial<GridCell> = {}): GridCell => ({
  cellId: id,
  landUse: 'residential',
  surfaceTempC: 40,
  ambientTempC: 33,
  greenCoverageRate: 0.15,
  impervioussRate: 0.8,
  populationDensity: 12000,
  ...overrides,
});

describe('UrbanHeatIslandDetector', () => {
  let ai: UrbanHeatIslandDetector;

  beforeEach(() => {
    ai = new UrbanHeatIslandDetector();
  });

  it('격자 셀을 등록한다', () => {
    ai.registerCell(sampleCell('c1'));
    expect(ai.listCells().length).toBe(1);
  });

  it('열섬 강도를 계산한다', () => {
    ai.registerCell(sampleCell('c1'));
    expect(ai.computeIntensity('c1')).toBeCloseTo(7, 2);
  });

  it('위험 수준과 권고사항을 산출한다', () => {
    ai.registerCell(sampleCell('c1'));
    const report = ai.analyze('c1');
    expect(report.riskLevel).toBe('critical');
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it('핫스팟 상위 N개를 정렬 반환한다', () => {
    ai.registerCell(sampleCell('c1', { surfaceTempC: 42, ambientTempC: 30 }));
    ai.registerCell(sampleCell('c2', { surfaceTempC: 34, ambientTempC: 33 }));
    const top = ai.rankHotspots(1);
    expect(top.length).toBe(1);
    expect(top[0]!.cellId).toBe('c1');
  });

  it('잘못된 녹지 비율은 거부한다', () => {
    expect(() => ai.registerCell(sampleCell('c1', { greenCoverageRate: 1.5 }))).toThrow('녹지');
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() => ai.registerCell(sampleCell('c1'), 'C')).toThrow('BLOCKED');
  });
});
