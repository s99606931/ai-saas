import { describe, it, expect, beforeEach } from 'vitest';
import { ForestCarbonCreditAI } from '../forest-carbon-credit-ai';

describe('ForestCarbonCreditAI', () => {
  let ai: ForestCarbonCreditAI;

  beforeEach(() => {
    ai = new ForestCarbonCreditAI();
  });

  it('조림지를 등록한다', () => {
    ai.registerPlot({
      plotId: 'f1',
      areaHa: 100,
      species: 'pine',
      averageAgeYears: 25,
      treeCount: 5000,
    });
    expect(ai.listPlots().length).toBe(1);
  });

  it('성숙림의 크레딧을 계산한다', () => {
    ai.registerPlot({
      plotId: 'f1',
      areaHa: 10,
      species: 'oak',
      averageAgeYears: 30,
      treeCount: 1000,
    });
    const c = ai.calculateCredit('f1');
    expect(c.creditTons).toBeCloseTo(78, 1);
  });

  it('유령림의 크레딧을 낮게 계산한다', () => {
    ai.registerPlot({
      plotId: 'f1',
      areaHa: 10,
      species: 'larch',
      averageAgeYears: 5,
      treeCount: 500,
    });
    const c = ai.calculateCredit('f1');
    expect(c.creditTons).toBeCloseTo(32.8, 1);
  });

  it('가격을 변경하여 시장가치를 반영한다', () => {
    ai.setPricePerTon(50_000);
    ai.registerPlot({
      plotId: 'f1',
      areaHa: 1,
      species: 'cedar',
      averageAgeYears: 25,
      treeCount: 100,
    });
    const c = ai.calculateCredit('f1');
    expect(c.marketValueKRW).toBe(Math.round(c.creditTons * 50_000));
  });

  it('수종별 합계를 계산한다', () => {
    ai.registerPlot({
      plotId: 'f1',
      areaHa: 10,
      species: 'pine',
      averageAgeYears: 25,
      treeCount: 500,
    });
    ai.registerPlot({
      plotId: 'f2',
      areaHa: 5,
      species: 'pine',
      averageAgeYears: 25,
      treeCount: 300,
    });
    expect(ai.totalCreditsBySpecies('pine')).toBeCloseTo(97.5, 1);
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerPlot(
        {
          plotId: 'f1',
          areaHa: 1,
          species: 'pine',
          averageAgeYears: 10,
          treeCount: 10,
        },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
