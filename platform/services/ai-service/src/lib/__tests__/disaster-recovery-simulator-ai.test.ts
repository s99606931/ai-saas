import { describe, it, expect, beforeEach } from 'vitest';
import { DisasterRecoverySimulatorAI } from '../disaster-recovery-simulator-ai';

describe('DisasterRecoverySimulatorAI', () => {
  let simulator: DisasterRecoverySimulatorAI;

  beforeEach(() => {
    simulator = new DisasterRecoverySimulatorAI();
  });

  it('시나리오를 등록한다', () => {
    simulator.registerScenario('s1', 'DB_FAILURE', 'high', 60);
    expect(simulator.getAuditLog().some(l => l.action === 'REGISTER_SCENARIO')).toBe(true);
  });

  it('복구 단계를 추가한다', () => {
    simulator.registerScenario('s1', 'DB_FAILURE', 'high', 60);
    simulator.addRecoveryStep('s1', '백업 복원', 30);
    expect(simulator.getAuditLog().some(l => l.action === 'ADD_RECOVERY_STEP')).toBe(true);
  });

  it('시뮬레이션 결과에 총 RTO가 포함된다', () => {
    simulator.registerScenario('s1', 'DB_FAILURE', 'high', 120);
    simulator.addRecoveryStep('s1', '알림 발송', 5);
    simulator.addRecoveryStep('s1', '백업 복원', 30);
    const result = simulator.simulate('s1');
    expect(result.totalRTOMinutes).toBe(35);
    expect(result.steps.length).toBe(2);
  });

  it('RPO 달성 여부를 판단한다', () => {
    simulator.registerScenario('s1', 'NET_FAILURE', 'medium', 20);
    simulator.addRecoveryStep('s1', '복구', 10);
    const result = simulator.simulate('s1');
    expect(result.rpoAchieved).toBe(true);

    simulator.registerScenario('s2', 'DISK_FAILURE', 'critical', 5);
    simulator.addRecoveryStep('s2', '장기복구', 60);
    const result2 = simulator.simulate('s2');
    expect(result2.rpoAchieved).toBe(false);
  });

  it('시뮬레이션 이력을 조회한다', () => {
    simulator.registerScenario('s1', 'DB_FAILURE', 'high', 60);
    simulator.addRecoveryStep('s1', '복구', 10);
    simulator.simulate('s1');
    simulator.simulate('s1');
    expect(simulator.getSimulationHistory('s1').length).toBe(2);
  });

  it('C등급 시뮬레이션을 차단한다', () => {
    simulator.registerScenario('s1', 'DB_FAILURE', 'high', 60);
    expect(() => simulator.simulate('s1', 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 시나리오에 단계 추가 시 오류를 던진다', () => {
    expect(() => simulator.addRecoveryStep('unknown', '복구', 10)).toThrow('시나리오 미등록');
  });
});
