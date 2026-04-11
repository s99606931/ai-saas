// AI 가격 최적화 엔진 단위 테스트 -- MTU-N269
import { describe, it, expect } from 'vitest';
import {
  calculateElasticity,
  simulatePriceChange,
  findOptimalPrice,
  analyzeCompetition,
  projectRevenue,
  getPricingAuditLog,
  type PriceDataPoint,
  type PriceConstraints,
  type CompetitorBenchmark,
} from '../../src/lib/pricing-optimizer';

const SAMPLE_DATA: PriceDataPoint[] = [
  { price: 100000, demand: 1000, revenue: 100000000, period: '2025-01' },
  { price: 110000, demand: 900, revenue: 99000000, period: '2025-02' },
  { price: 90000, demand: 1100, revenue: 99000000, period: '2025-03' },
  { price: 120000, demand: 800, revenue: 96000000, period: '2025-04' },
  { price: 95000, demand: 1050, revenue: 99750000, period: '2025-05' },
];

describe('AI 가격 최적화 엔진', () => {
  describe('calculateElasticity', () => {
    it('수요 탄력성을 계산해야 한다', () => {
      const result = calculateElasticity(SAMPLE_DATA, 'test-user');
      expect(result.coefficient).toBeDefined();
      expect(result.interpretation).toBeDefined();
      expect(['elastic', 'inelastic', 'unit_elastic']).toContain(result.interpretation);
    });

    it('가격 범위가 올바르게 설정되어야 한다', () => {
      const result = calculateElasticity(SAMPLE_DATA, 'test-user');
      expect(result.priceRange.min).toBeLessThanOrEqual(result.priceRange.max);
    });

    it('신뢰 구간이 포함되어야 한다', () => {
      const result = calculateElasticity(SAMPLE_DATA, 'test-user');
      expect(result.confidenceInterval.lower).toBeLessThanOrEqual(result.confidenceInterval.upper);
    });

    it('데이터 포인트 2개 미만 시 예외를 발생해야 한다', () => {
      expect(() => calculateElasticity([SAMPLE_DATA[0]], 'test-user')).toThrow();
    });
  });

  describe('simulatePriceChange', () => {
    it('가격 인상 시뮬레이션을 수행해야 한다', () => {
      const elasticity = calculateElasticity(SAMPLE_DATA, 'test-user');
      const result = simulatePriceChange({
        currentPrice: 100000,
        proposedPrice: 110000,
        elasticity,
        currentDemand: 1000,
      }, 'test-user');

      expect(result.priceChangePct).toBeGreaterThan(0);
      expect(result.recommendation).toBeDefined();
      expect(['proceed', 'caution', 'avoid']).toContain(result.recommendation);
    });

    it('가격 인하 시뮬레이션을 수행해야 한다', () => {
      const elasticity = calculateElasticity(SAMPLE_DATA, 'test-user');
      const result = simulatePriceChange({
        currentPrice: 100000,
        proposedPrice: 90000,
        elasticity,
        currentDemand: 1000,
      }, 'test-user');

      expect(result.priceChangePct).toBeLessThan(0);
      expect(result.estimatedNewDemand).toBeGreaterThanOrEqual(0);
    });
  });

  describe('findOptimalPrice', () => {
    it('수익 극대화 가격을 찾아야 한다', () => {
      const elasticity = calculateElasticity(SAMPLE_DATA, 'test-user');
      const constraints: PriceConstraints = {
        minPrice: 50000,
        maxPrice: 200000,
      };

      const result = findOptimalPrice(elasticity, 100000, 1000, constraints, 'test-user');
      expect(result.optimalPrice).toBeGreaterThanOrEqual(constraints.minPrice);
      expect(result.optimalPrice).toBeLessThanOrEqual(constraints.maxPrice);
      expect(result.estimatedMaxRevenue).toBeGreaterThan(0);
    });

    it('규제 한도를 준수해야 한다', () => {
      const elasticity = calculateElasticity(SAMPLE_DATA, 'test-user');
      const constraints: PriceConstraints = {
        minPrice: 50000,
        maxPrice: 200000,
        regulatoryLimit: 120000,
      };

      const result = findOptimalPrice(elasticity, 100000, 1000, constraints, 'test-user');
      expect(result.optimalPrice).toBeLessThanOrEqual(120000);
    });
  });

  describe('analyzeCompetition', () => {
    it('경쟁사 가격을 분석해야 한다', () => {
      const competitors: CompetitorBenchmark[] = [
        { competitorName: 'A사', price: 95000, features: ['기능1', '기능2'] },
        { competitorName: 'B사', price: 105000, features: ['기능1', '기능3'] },
        { competitorName: 'C사', price: 110000, features: ['기능1', '기능2', '기능4'] },
      ];

      const analysis = analyzeCompetition(100000, competitors, 'test-user');
      expect(analysis.marketAverage).toBeGreaterThan(0);
      expect(analysis.priceIndex).toBeGreaterThan(0);
      expect(analysis.recommendation).toBeDefined();
    });

    it('포지셔닝 점수가 산출되어야 한다', () => {
      const competitors: CompetitorBenchmark[] = [
        { competitorName: 'A사', price: 100000, features: [] },
      ];

      const analysis = analyzeCompetition(150000, competitors, 'test-user');
      expect(analysis.positioningScore).toBeGreaterThan(100); // 프리미엄
    });
  });

  describe('projectRevenue', () => {
    it('수익을 예측해야 한다', () => {
      const elasticity = calculateElasticity(SAMPLE_DATA, 'test-user');
      const projection = projectRevenue(
        elasticity,
        100000,
        110000,
        1000,
        6,
        0.02,
        'test-user'
      );

      expect(projection.months).toHaveLength(6);
      expect(projection.totalProjectedRevenue).toBeGreaterThan(0);
      expect(projection.totalCurrentRevenue).toBeGreaterThan(0);
    });

    it('월별 예측 데이터가 포함되어야 한다', () => {
      const elasticity = calculateElasticity(SAMPLE_DATA, 'test-user');
      const projection = projectRevenue(
        elasticity,
        100000,
        100000,
        1000,
        3,
        0,
        'test-user'
      );

      // 동일 가격이면 차이가 작아야 함
      for (const month of projection.months) {
        expect(Math.abs(month.difference)).toBeLessThan(1);
      }
    });
  });

  describe('감사 로그', () => {
    it('모든 활동이 기록되어야 한다', () => {
      const log = getPricingAuditLog();
      expect(log.length).toBeGreaterThan(0);
      expect(log.every((e) => e.timestamp)).toBe(true);
    });
  });
});
