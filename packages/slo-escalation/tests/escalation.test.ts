/**
 * SLO 에스컬레이션 컨트롤러 테스트
 * Design Ref: MTU-N178
 */

import {
  SLOEscalationController,
  determineEscalationLevel,
  EscalationLevel,
  NotificationChannel,
} from '../src/escalation-controller';

describe('SLO Escalation', () => {
  describe('determineEscalationLevel', () => {
    it('50% 이하 → Normal', () => {
      expect(determineEscalationLevel(30)).toBe(EscalationLevel.Normal);
      expect(determineEscalationLevel(50)).toBe(EscalationLevel.Normal);
    });

    it('50~75% → Warning', () => {
      expect(determineEscalationLevel(60)).toBe(EscalationLevel.Warning);
      expect(determineEscalationLevel(75)).toBe(EscalationLevel.Warning);
    });

    it('75~90% → Danger', () => {
      expect(determineEscalationLevel(80)).toBe(EscalationLevel.Danger);
    });

    it('90~100% → Critical', () => {
      expect(determineEscalationLevel(95)).toBe(EscalationLevel.Critical);
    });

    it('100% 초과 → Violated', () => {
      expect(determineEscalationLevel(110)).toBe(EscalationLevel.Violated);
    });
  });

  describe('SLOEscalationController', () => {
    let controller: SLOEscalationController;

    beforeEach(() => {
      controller = new SLOEscalationController();
      controller.registerPolicy({
        name: 'auth-service-slo',
        service: 'auth-service',
        levels: [
          {
            level: EscalationLevel.Warning,
            budgetBurnRateMin: 50,
            budgetBurnRateMax: 75,
            contacts: [{ name: 'L1 On-Call', channel: NotificationChannel.Slack, target: '#alerts' }],
            waitMinutes: 0,
            actions: ['run-diagnostics'],
          },
          {
            level: EscalationLevel.Critical,
            budgetBurnRateMin: 90,
            budgetBurnRateMax: 100,
            contacts: [
              { name: 'L1 On-Call', channel: NotificationChannel.Slack, target: '#alerts' },
              { name: 'L2 Team Lead', channel: NotificationChannel.Email, target: 'lead@example.go.kr' },
            ],
            waitMinutes: 30,
            actions: ['change-freeze', 'run-diagnostics'],
          },
        ],
      });
    });

    it('Warning 레벨 에스컬레이션', async () => {
      const event = await controller.escalate('auth-service', 'availability', 60, 40);
      expect(event.level).toBe(EscalationLevel.Warning);
      expect(event.notifiedContacts).toContain('L1 On-Call');
    });

    it('Critical 레벨 에스컬레이션', async () => {
      const event = await controller.escalate('auth-service', 'availability', 95, 5);
      expect(event.level).toBe(EscalationLevel.Critical);
      expect(event.notifiedContacts.length).toBe(2);
      expect(event.actionsTriggered).toContain('change-freeze');
    });

    it('미등록 서비스 처리', async () => {
      const event = await controller.escalate('unknown-service', 'latency', 80, 20);
      expect(event.level).toBe(EscalationLevel.Danger);
      expect(event.notifiedContacts.length).toBe(0);
    });

    it('이력 조회', async () => {
      await controller.escalate('auth-service', 'availability', 60, 40);
      await controller.escalate('auth-service', 'availability', 95, 5);

      const history = controller.getHistory('auth-service');
      expect(history.length).toBe(2);
    });
  });
});
