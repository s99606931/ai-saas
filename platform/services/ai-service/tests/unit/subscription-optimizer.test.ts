// SaaS 구독 AI 최적화 단위 테스트 -- MTU-N268
import { describe, it, expect } from 'vitest';
import {
  analyzeUsage,
  classifyPattern,
  recommendPlan,
  detectBillingAnomalies,
  simulateCosts,
  getSubscriptionAuditLog,
  type UsageDataPoint,
  type SubscriptionPlan,
} from '../../src/lib/subscription-optimizer';

function generateUsageData(
  tenantId: string,
  count: number,
  baseValue: number,
  trend: number = 0,
  noise: number = 0.1
): UsageDataPoint[] {
  const data: UsageDataPoint[] = [];
  for (let i = 0; i < count; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (count - i));
    data.push({
      timestamp: date.toISOString(),
      tenantId,
      metricName: 'api_calls',
      value: baseValue + trend * i + (Math.random() - 0.5) * baseValue * noise,
    });
  }
  return data;
}

const PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: '스타터',
    tier: 'starter',
    monthlyPrice: 100000,
    includedUsage: { api_calls: 1000 },
    overageRate: { api_calls: 100 },
  },
  {
    id: 'pro',
    name: '프로페셔널',
    tier: 'professional',
    monthlyPrice: 300000,
    includedUsage: { api_calls: 5000 },
    overageRate: { api_calls: 50 },
  },
  {
    id: 'enterprise',
    name: '엔터프라이즈',
    tier: 'enterprise',
    monthlyPrice: 1000000,
    includedUsage: { api_calls: 50000 },
    overageRate: { api_calls: 10 },
  },
];

describe('SaaS 구독 AI 최적화', () => {
  describe('analyzeUsage', () => {
    it('사용량을 분석해야 한다', () => {
      const data = generateUsageData('tenant-1', 30, 1000);
      const analysis = analyzeUsage(data, 'tenant-1', 'test-user');

      expect(analysis.tenantId).toBe('tenant-1');
      expect(analysis.metrics.length).toBeGreaterThan(0);
      expect(analysis.pattern).toBeDefined();
    });

    it('메트릭 요약을 올바르게 계산해야 한다', () => {
      const data = generateUsageData('tenant-2', 30, 500, 0, 0.01);
      const analysis = analyzeUsage(data, 'tenant-2', 'test-user');

      const metric = analysis.metrics[0];
      expect(metric.average).toBeGreaterThan(0);
      expect(metric.peak).toBeGreaterThanOrEqual(metric.average);
      expect(metric.dataPoints).toBe(30);
    });
  });

  describe('classifyPattern', () => {
    it('성장 패턴을 분류해야 한다', () => {
      expect(classifyPattern(0.1, 0.1)).toBe('growing');
    });

    it('감소 패턴을 분류해야 한다', () => {
      expect(classifyPattern(-0.1, 0.1)).toBe('declining');
    });

    it('안정 패턴을 분류해야 한다', () => {
      expect(classifyPattern(0.01, 0.1)).toBe('stable');
    });

    it('버스트 패턴을 분류해야 한다', () => {
      expect(classifyPattern(0.01, 0.6)).toBe('burst');
    });

    it('계절 패턴을 분류해야 한다', () => {
      expect(classifyPattern(0.01, 0.35)).toBe('seasonal');
    });
  });

  describe('recommendPlan', () => {
    it('최적 플랜을 추천해야 한다', () => {
      const data = generateUsageData('tenant-3', 30, 800);
      const analysis = analyzeUsage(data, 'tenant-3', 'test-user');
      const recommendation = recommendPlan(analysis, PLANS[0], PLANS, 'test-user');

      expect(recommendation.tenantId).toBe('tenant-3');
      expect(recommendation.action).toBeDefined();
      expect(recommendation.reason).toBeDefined();
      expect(recommendation.confidence).toBeGreaterThan(0);
    });

    it('절감 금액이 음수가 아니어야 한다', () => {
      const data = generateUsageData('tenant-4', 30, 500);
      const analysis = analyzeUsage(data, 'tenant-4', 'test-user');
      const recommendation = recommendPlan(analysis, PLANS[1], PLANS, 'test-user');

      expect(recommendation.estimatedMonthlySaving).toBeGreaterThanOrEqual(0);
      expect(recommendation.estimatedAnnualSaving).toBeGreaterThanOrEqual(0);
    });
  });

  describe('detectBillingAnomalies', () => {
    it('정상 사용에서 이상치를 감지하지 않아야 한다', () => {
      const data = generateUsageData('tenant-5', 30, 1000, 0, 0.05);
      const anomalies = detectBillingAnomalies(data, 'tenant-5', 'test-user');
      // 낮은 노이즈에서는 이상치 거의 없음
      expect(anomalies.length).toBeLessThanOrEqual(1);
    });

    it('극단적 이상치를 감지해야 한다', () => {
      const data = generateUsageData('tenant-6', 30, 100, 0, 0.01);
      // 마지막 값을 극단적으로 변경
      data[data.length - 1].value = 10000;
      const anomalies = detectBillingAnomalies(data, 'tenant-6', 'test-user');

      expect(anomalies.length).toBeGreaterThan(0);
      if (anomalies.length > 0) {
        expect(anomalies[0].severity).toBe('critical');
        expect(anomalies[0].zScore).toBeGreaterThan(2);
      }
    });
  });

  describe('simulateCosts', () => {
    it('모든 플랜에 대해 비용을 시뮬레이션해야 한다', () => {
      const data = generateUsageData('tenant-7', 30, 2000);
      const analysis = analyzeUsage(data, 'tenant-7', 'test-user');
      const simulation = simulateCosts(analysis, PLANS, 'test-user');

      expect(simulation.scenarios).toHaveLength(PLANS.length);
      for (const scenario of simulation.scenarios) {
        expect(scenario.estimatedMonthlyCost).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('감사 로그', () => {
    it('모든 분석 활동이 기록되어야 한다', () => {
      const log = getSubscriptionAuditLog();
      expect(log.length).toBeGreaterThan(0);
      expect(log.every((e) => e.timestamp)).toBe(true);
    });
  });
});
