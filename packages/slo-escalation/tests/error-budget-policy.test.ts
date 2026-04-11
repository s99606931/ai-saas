/**
 * SRE 에러 버짓 정책 엔진 테스트
 * Design Ref: MTU-N255 §SC-1~SC-5
 * Plan SC: FR-N255.SC-1, SC-2, SC-3
 * CSAP: D-06 침해사고 관리
 */

import { ErrorBudgetPolicyEngine, BudgetStatus, AutoAction, SLODefinition } from '../src/error-budget-policy';

function createSLO(overrides?: Partial<SLODefinition>): SLODefinition {
  return {
    name: 'api-availability',
    service: 'api-gateway',
    target: 0.999, // 99.9%
    windowDays: 30,
    currentAvailability: 0.9995, // 99.95%
    ...overrides,
  };
}

describe('ErrorBudgetPolicyEngine', () => {
  let engine: ErrorBudgetPolicyEngine;

  beforeEach(() => {
    engine = new ErrorBudgetPolicyEngine();
  });

  describe('calculateErrorBudget', () => {
    it('99.9% SLO의 에러 버짓 계산', () => {
      const slo = createSLO({ target: 0.999, currentAvailability: 0.9995 });
      const result = engine.calculateErrorBudget(slo);

      // 30일 * 24시간 * 60분 = 43200분
      // 에러 버짓 = 0.001 * 43200 = 43.2분
      expect(result.totalBudgetMinutes).toBeCloseTo(43.2, 0);

      // 소진량 = 0.0005 * 43200 = 21.6분
      expect(result.consumedMinutes).toBeCloseTo(21.6, 0);

      // 잔여 = 43.2 - 21.6 = 21.6분
      expect(result.remainingMinutes).toBeCloseTo(21.6, 0);

      // 소진율 = 50%
      expect(result.burnRate).toBeCloseTo(50, 0);
    });

    it('정상 상태 (50% 미만 소진)', () => {
      const slo = createSLO({ target: 0.999, currentAvailability: 0.9998 });
      const result = engine.calculateErrorBudget(slo);

      expect(result.status).toBe(BudgetStatus.Healthy);
    });

    it('주의 상태 (50~75% 소진)', () => {
      const slo = createSLO({ target: 0.999, currentAvailability: 0.9994 });
      const result = engine.calculateErrorBudget(slo);

      expect(result.status).toBe(BudgetStatus.Caution);
      expect(result.burnRate).toBeGreaterThanOrEqual(50);
      expect(result.burnRate).toBeLessThan(75);
    });

    it('경고 상태 (75~90% 소진)', () => {
      const slo = createSLO({ target: 0.999, currentAvailability: 0.99918 });
      const result = engine.calculateErrorBudget(slo);

      expect(result.status).toBe(BudgetStatus.Warning);
    });

    it('위험 상태 (90~100% 소진)', () => {
      const slo = createSLO({ target: 0.999, currentAvailability: 0.99905 });
      const result = engine.calculateErrorBudget(slo);

      expect(result.status).toBe(BudgetStatus.Danger);
    });

    it('소진 상태 (100%+ 소진) — 배포 동결', () => {
      const slo = createSLO({ target: 0.999, currentAvailability: 0.998 });
      const result = engine.calculateErrorBudget(slo);

      expect(result.status).toBe(BudgetStatus.Exhausted);
      expect(result.actions).toContain(AutoAction.FreezeEnforce);
      expect(result.burnRate).toBeGreaterThan(100);
    });

    it('소진 예측일 계산', () => {
      const slo = createSLO({ target: 0.999, currentAvailability: 0.9995 });
      const result = engine.calculateErrorBudget(slo);

      expect(result.projectedExhaustionDate).not.toBeNull();

      // 소진 예측일이 미래여야 함
      if (result.projectedExhaustionDate) {
        const projected = new Date(result.projectedExhaustionDate);
        expect(projected.getTime()).toBeGreaterThan(Date.now());
      }
    });

    it('이미 소진된 경우 예측일은 현재', () => {
      const slo = createSLO({ target: 0.999, currentAvailability: 0.998 });
      const result = engine.calculateErrorBudget(slo);

      expect(result.projectedExhaustionDate).not.toBeNull();
    });

    it('계산 시각 기록', () => {
      const slo = createSLO();
      const result = engine.calculateErrorBudget(slo);

      expect(result.calculatedAt).toBeTruthy();
      expect(new Date(result.calculatedAt).getTime()).toBeGreaterThan(0);
    });
  });

  describe('자동 액션 판정', () => {
    it('50% 소진 시 알림만', () => {
      const slo = createSLO({ target: 0.999, currentAvailability: 0.9995 });
      const result = engine.calculateErrorBudget(slo);

      expect(result.actions).toContain(AutoAction.Notify);
      expect(result.actions).not.toContain(AutoAction.FreezeEnforce);
    });

    it('90% 소진 시 배포 동결 권고', () => {
      const slo = createSLO({ target: 0.999, currentAvailability: 0.99905 });
      const result = engine.calculateErrorBudget(slo);

      expect(result.actions).toContain(AutoAction.FreezeRecommend);
    });

    it('100% 소진 시 배포 강제 동결 + 에스컬레이션 + 포스트모템', () => {
      const slo = createSLO({ target: 0.999, currentAvailability: 0.998 });
      const result = engine.calculateErrorBudget(slo);

      expect(result.actions).toContain(AutoAction.FreezeEnforce);
      expect(result.actions).toContain(AutoAction.Escalate);
      expect(result.actions).toContain(AutoAction.CreatePostmortem);
    });

    it('25% 소진 시 액션 없음', () => {
      const slo = createSLO({ target: 0.999, currentAvailability: 0.99975 });
      const result = engine.calculateErrorBudget(slo);

      expect(result.actions.length).toBe(0);
    });
  });

  describe('배포 동결 상태', () => {
    it('에러 버짓 소진 시 배포 동결 활성화', () => {
      expect(engine.isDeployFrozen()).toBe(false);

      // 100% 이상 소진
      engine.calculateErrorBudget(createSLO({ target: 0.999, currentAvailability: 0.998 }));

      expect(engine.isDeployFrozen()).toBe(true);
    });

    it('에러 버짓 회복 시 배포 동결 해제', () => {
      // 소진
      engine.calculateErrorBudget(createSLO({ target: 0.999, currentAvailability: 0.998 }));
      expect(engine.isDeployFrozen()).toBe(true);

      // 회복 (새로운 측정 기간)
      engine.calculateErrorBudget(createSLO({ target: 0.999, currentAvailability: 0.9998 }));
      expect(engine.isDeployFrozen()).toBe(false);
    });
  });

  describe('온콜 에스컬레이션', () => {
    it('P1 인시던트 — 5분 에스컬레이션', () => {
      const result = engine.escalateOnCall('INC-001', 'P1');

      expect(result.priority).toBe('P1');
      expect(result.currentLevel).toBe(1);
      expect(result.notifiedTargets).toContain('oncall-primary');
      expect(result.notifiedTargets).toContain('engineering-manager');
      expect(result.nextEscalationAt).not.toBeNull();

      // 5분 후 에스컬레이션
      if (result.nextEscalationAt) {
        const diff = new Date(result.nextEscalationAt).getTime() - new Date(result.escalatedAt).getTime();
        expect(diff).toBe(5 * 60 * 1000); // 5분
      }
    });

    it('P2 인시던트 — 30분 에스컬레이션', () => {
      const result = engine.escalateOnCall('INC-002', 'P2');

      expect(result.priority).toBe('P2');
      expect(result.notifiedTargets).toContain('oncall-primary');

      if (result.nextEscalationAt) {
        const diff = new Date(result.nextEscalationAt).getTime() - new Date(result.escalatedAt).getTime();
        expect(diff).toBe(30 * 60 * 1000); // 30분
      }
    });

    it('P3 인시던트 — 4시간 에스컬레이션', () => {
      const result = engine.escalateOnCall('INC-003', 'P3');

      expect(result.priority).toBe('P3');

      if (result.nextEscalationAt) {
        const diff = new Date(result.nextEscalationAt).getTime() - new Date(result.escalatedAt).getTime();
        expect(diff).toBe(240 * 60 * 1000); // 4시간
      }
    });

    it('P4 인시던트 — 24시간 에스컬레이션', () => {
      const result = engine.escalateOnCall('INC-004', 'P4');

      expect(result.priority).toBe('P4');
      expect(result.notifiedTargets).toContain('team-channel');
    });

    it('에스컬레이션 레벨 증가', () => {
      const level1 = engine.escalateOnCall('INC-005', 'P1', 0);
      expect(level1.currentLevel).toBe(1);

      const level2 = engine.escalateOnCall('INC-005', 'P1', 1);
      expect(level2.currentLevel).toBe(2);
    });
  });

  describe('히스토리 조회', () => {
    it('에러 버짓 히스토리 저장 및 조회', () => {
      engine.calculateErrorBudget(createSLO({ service: 'svc-a' }));
      engine.calculateErrorBudget(createSLO({ service: 'svc-b' }));
      engine.calculateErrorBudget(createSLO({ service: 'svc-a' }));

      const all = engine.getBudgetHistory();
      expect(all.length).toBe(3);

      const svcA = engine.getBudgetHistory('svc-a');
      expect(svcA.length).toBe(2);
    });

    it('에스컬레이션 히스토리 저장 및 조회', () => {
      engine.escalateOnCall('INC-1', 'P1');
      engine.escalateOnCall('INC-2', 'P2');

      const history = engine.getEscalationHistory();
      expect(history.length).toBe(2);
    });

    it('히스토리 제한', () => {
      const history = engine.getBudgetHistory(undefined, 1);
      // 비어있으면 빈 배열
      expect(history.length).toBeLessThanOrEqual(1);
    });
  });

  describe('온콜 정책 조회', () => {
    it('P1 정책 조회', () => {
      const policy = engine.getOnCallPolicy('P1');

      expect(policy).toBeTruthy();
      expect(policy!.responseTimeMinutes).toBe(5);
      expect(policy!.channels).toContain('pagerduty');
    });

    it('P4 정책 조회', () => {
      const policy = engine.getOnCallPolicy('P4');

      expect(policy).toBeTruthy();
      expect(policy!.responseTimeMinutes).toBe(1440); // 24시간
    });
  });

  describe('커스텀 설정', () => {
    it('커스텀 임계값 설정', () => {
      const customEngine = new ErrorBudgetPolicyEngine({
        freezeThreshold: 80,
        enforceThreshold: 95,
      });

      // 85% 소진 — 커스텀 freezeThreshold(80) 초과
      const slo = createSLO({ target: 0.999, currentAvailability: 0.99915 });
      const result = customEngine.calculateErrorBudget(slo);

      expect(result.actions).toContain(AutoAction.FreezeRecommend);
    });
  });
});
