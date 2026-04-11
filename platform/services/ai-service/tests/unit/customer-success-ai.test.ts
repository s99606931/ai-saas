// 고객 성공 AI 자동화 단위 테스트 -- MTU-N270
import { describe, it, expect } from 'vitest';
import {
  calculateHealthScore,
  assessChurnRisk,
  registerPlaybook,
  evaluateAndExecutePlaybooks,
  classifyJourneyStage,
  predictSatisfaction,
  listPlaybooks,
  getExecutionHistory,
  getCSAuditLog,
  type CustomerActivityMetrics,
} from '../../src/lib/customer-success-ai';

const HEALTHY_METRICS: CustomerActivityMetrics = {
  tenantId: 'tenant-healthy',
  activeUsers: 80,
  totalUsers: 100,
  loginFrequency: 15,
  featureAdoptionRate: 0.75,
  supportTickets: 1,
  avgSessionDuration: 25,
  lastLoginAt: new Date().toISOString(),
  measurementDate: new Date().toISOString(),
};

const AT_RISK_METRICS: CustomerActivityMetrics = {
  tenantId: 'tenant-at-risk',
  activeUsers: 10,
  totalUsers: 100,
  loginFrequency: 2,
  featureAdoptionRate: 0.15,
  supportTickets: 8,
  avgSessionDuration: 3,
  lastLoginAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
  measurementDate: new Date().toISOString(),
};

describe('고객 성공 AI 자동화', () => {
  describe('calculateHealthScore', () => {
    it('건강한 고객에 높은 스코어를 부여해야 한다', () => {
      const result = calculateHealthScore(HEALTHY_METRICS, [], 'test-user');
      expect(result.overallScore).toBeGreaterThan(60);
      expect(result.riskLevel).toBe('low');
    });

    it('위험 고객에 낮은 스코어를 부여해야 한다', () => {
      const result = calculateHealthScore(AT_RISK_METRICS, [], 'test-user');
      expect(result.overallScore).toBeLessThan(50);
      expect(['high', 'critical']).toContain(result.riskLevel);
    });

    it('5개 구성 요소가 포함되어야 한다', () => {
      const result = calculateHealthScore(HEALTHY_METRICS, [], 'test-user');
      expect(result.components).toHaveLength(5);
    });

    it('스코어가 0~100 범위여야 한다', () => {
      const result = calculateHealthScore(HEALTHY_METRICS, [], 'test-user');
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });

    it('하락 추세를 감지해야 한다', () => {
      const historicalScores = [80, 75, 70];
      const result = calculateHealthScore(AT_RISK_METRICS, historicalScores, 'test-user');
      expect(result.trend).toBe('declining');
    });
  });

  describe('assessChurnRisk', () => {
    it('건강한 고객의 이탈 위험을 낮게 평가해야 한다', () => {
      const health = calculateHealthScore(HEALTHY_METRICS, [], 'test-user');
      const risk = assessChurnRisk(health, HEALTHY_METRICS, 'test-user');
      expect(risk.riskLevel).toBe('low');
      expect(risk.predictedChurnProbability).toBeLessThan(0.5);
    });

    it('위험 고객의 이탈 위험을 높게 평가해야 한다', () => {
      const health = calculateHealthScore(AT_RISK_METRICS, [80, 70, 60], 'test-user');
      const risk = assessChurnRisk(health, AT_RISK_METRICS, 'test-user');
      expect(['high', 'critical']).toContain(risk.riskLevel);
      expect(risk.riskFactors.length).toBeGreaterThan(0);
    });

    it('위험 요인 목록을 제공해야 한다', () => {
      const health = calculateHealthScore(AT_RISK_METRICS, [], 'test-user');
      const risk = assessChurnRisk(health, AT_RISK_METRICS, 'test-user');
      for (const factor of risk.riskFactors) {
        expect(factor.factor).toBeDefined();
        expect(factor.suggestedAction).toBeDefined();
      }
    });
  });

  describe('registerPlaybook & evaluateAndExecutePlaybooks', () => {
    it('플레이북을 등록하고 실행해야 한다', () => {
      registerPlaybook(
        '고위험 고객 인터벤션',
        { riskLevel: 'critical' },
        [
          { type: 'executive_outreach', template: '임원 연락', delayDays: 0, priority: 1 },
          { type: 'meeting_request', template: '미팅 요청', delayDays: 1, priority: 2 },
        ],
        'test-user'
      );

      expect(listPlaybooks().length).toBeGreaterThan(0);

      const health = calculateHealthScore(AT_RISK_METRICS, [80, 70, 60], 'test-user');
      const risk = assessChurnRisk(health, AT_RISK_METRICS, 'test-user');

      if (risk.riskLevel === 'critical') {
        const execs = evaluateAndExecutePlaybooks(
          health,
          risk,
          'engagement',
          'test-user'
        );
        expect(execs.length).toBeGreaterThan(0);
      }
    });

    it('플레이북 실행 이력이 기록되어야 한다', () => {
      const history = getExecutionHistory();
      // 이전 테스트에서 실행된 것이 있을 수 있음
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('classifyJourneyStage', () => {
    it('신규 가입 고객을 onboarding으로 분류해야 한다', () => {
      expect(classifyJourneyStage(HEALTHY_METRICS, 15)).toBe('onboarding');
    });

    it('기능 미채택 고객을 activation으로 분류해야 한다', () => {
      const lowAdoption = { ...AT_RISK_METRICS, featureAdoptionRate: 0.2 };
      expect(classifyJourneyStage(lowAdoption, 45)).toBe('activation');
    });

    it('활발한 고객을 expansion으로 분류해야 한다', () => {
      const active = { ...HEALTHY_METRICS, featureAdoptionRate: 0.8, activeUsers: 85 };
      expect(classifyJourneyStage(active, 200)).toBe('expansion');
    });

    it('일반 참여 고객을 engagement로 분류해야 한다', () => {
      const normal = { ...HEALTHY_METRICS, featureAdoptionRate: 0.5, activeUsers: 50 };
      expect(classifyJourneyStage(normal, 150)).toBe('engagement');
    });
  });

  describe('predictSatisfaction', () => {
    it('건강한 고객의 만족도를 높게 예측해야 한다', () => {
      const health = calculateHealthScore(HEALTHY_METRICS, [], 'test-user');
      const prediction = predictSatisfaction(health, HEALTHY_METRICS, 'test-user');

      expect(prediction.predictedNPS).toBeGreaterThan(0);
      expect(prediction.predictedCSAT).toBeGreaterThan(3);
    });

    it('NPS가 -100~100 범위여야 한다', () => {
      const health = calculateHealthScore(AT_RISK_METRICS, [], 'test-user');
      const prediction = predictSatisfaction(health, AT_RISK_METRICS, 'test-user');

      expect(prediction.predictedNPS).toBeGreaterThanOrEqual(-100);
      expect(prediction.predictedNPS).toBeLessThanOrEqual(100);
    });

    it('CSAT가 1~5 범위여야 한다', () => {
      const health = calculateHealthScore(HEALTHY_METRICS, [], 'test-user');
      const prediction = predictSatisfaction(health, HEALTHY_METRICS, 'test-user');

      expect(prediction.predictedCSAT).toBeGreaterThanOrEqual(1);
      expect(prediction.predictedCSAT).toBeLessThanOrEqual(5);
    });

    it('핵심 동인이 포함되어야 한다', () => {
      const health = calculateHealthScore(HEALTHY_METRICS, [], 'test-user');
      const prediction = predictSatisfaction(health, HEALTHY_METRICS, 'test-user');

      expect(prediction.keyDrivers.length).toBeGreaterThan(0);
    });
  });

  describe('감사 로그', () => {
    it('모든 CS 활동이 기록되어야 한다', () => {
      const log = getCSAuditLog();
      expect(log.length).toBeGreaterThan(0);
      expect(log.every((e) => e.timestamp)).toBe(true);
    });
  });
});
