import { describe, it, expect, beforeEach } from 'vitest';
import { AgriculturalPricePredictorAI } from '../agricultural-price-predictor-ai';

describe('AgriculturalPricePredictorAI', () => {
  let ai: AgriculturalPricePredictorAI;

  beforeEach(() => {
    ai = new AgriculturalPricePredictorAI();
  });

  it('상품을 등록한다', () => {
    ai.registerProduct({ productId: 'p1', name: '배추', category: 'vegetable', peakSeason: 'winter' });
    expect(ai.listProducts().length).toBe(1);
  });

  it('가격 이력을 기록한다', () => {
    ai.registerProduct({ productId: 'p1', name: '사과', category: 'fruit', peakSeason: 'autumn' });
    ai.recordPrice({ productId: 'p1', recordedAt: '2026-04-01', pricePerKg: 3000 });
    ai.recordPrice({ productId: 'p1', recordedAt: '2026-04-02', pricePerKg: 3100 });
    expect(ai.getHistory('p1').length).toBe(2);
  });

  it('가격을 예측한다', () => {
    ai.registerProduct({ productId: 'p1', name: '쌀', category: 'grain', peakSeason: 'autumn' });
    for (let i = 0; i < 10; i++) {
      ai.recordPrice({ productId: 'p1', recordedAt: `2026-04-${i + 1}`, pricePerKg: 2500 + i * 10 });
    }
    const result = ai.predict('p1', 'spring');
    expect(result.predictedPrice).toBeGreaterThan(0);
    expect(['up', 'down', 'stable']).toContain(result.trend);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it('이력 부족 시 예측을 거부한다', () => {
    ai.registerProduct({ productId: 'p1', name: '굴', category: 'seafood', peakSeason: 'winter' });
    ai.recordPrice({ productId: 'p1', recordedAt: '2026-04-01', pricePerKg: 5000 });
    expect(() => ai.predict('p1', 'winter')).toThrow('가격 이력 부족');
  });

  it('카테고리별 상품을 조회한다', () => {
    ai.registerProduct({ productId: 'p1', name: '한우', category: 'livestock', peakSeason: 'winter' });
    ai.registerProduct({ productId: 'p2', name: '감자', category: 'vegetable', peakSeason: 'summer' });
    expect(ai.listProducts('livestock').length).toBe(1);
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerProduct({ productId: 'p1', name: '비밀', category: 'grain', peakSeason: 'autumn' }, 'C'),
    ).toThrow('BLOCKED');
  });
});
