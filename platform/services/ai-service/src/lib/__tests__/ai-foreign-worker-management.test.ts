import { describe, it, expect, beforeEach } from 'vitest';
import { ForeignWorkerManagementAI, type WorkerProfile } from '../ai-foreign-worker-management';

const sampleWorker = (id: string, overrides: Partial<WorkerProfile> = {}): WorkerProfile => ({
  workerId: id,
  visaType: 'E9',
  visaExpiryDate: '2026-12-31',
  insuranceEnrolled: true,
  industryCode: 'MFG',
  employerRegNo: 'EMP001',
  ...overrides,
});

describe('ForeignWorkerManagementAI', () => {
  let ai: ForeignWorkerManagementAI;

  beforeEach(() => {
    ai = new ForeignWorkerManagementAI();
  });

  it('근로자를 등록한다', () => {
    ai.registerWorker(sampleWorker('w1'));
    expect(ai.listByEmployer('EMP001').length).toBe(1);
  });

  it('비자 만료 임박 근로자에 critical 경보를 발생시킨다', () => {
    ai.registerWorker(sampleWorker('w1', { visaExpiryDate: '2026-04-20' }));
    const alerts = ai.checkAlerts('2026-04-10');
    const critical = alerts.filter(a => a.severity === 'critical');
    expect(critical.length).toBeGreaterThan(0);
  });

  it('보험 미가입 근로자에 warning 경보를 발생시킨다', () => {
    ai.registerWorker(sampleWorker('w1', { insuranceEnrolled: false }));
    const alerts = ai.checkAlerts('2026-04-10');
    const insurance = alerts.find(a => a.message.includes('보험'));
    expect(insurance).toBeDefined();
  });

  it('비자 종류별 카운트를 반환한다', () => {
    ai.registerWorker(sampleWorker('w1', { visaType: 'E9' }));
    ai.registerWorker(sampleWorker('w2', { visaType: 'E7' }));
    const counts = ai.countByVisa();
    expect(counts.E9).toBe(1);
    expect(counts.E7).toBe(1);
  });

  it('보험 가입률을 계산한다', () => {
    ai.registerWorker(sampleWorker('w1', { insuranceEnrolled: true }));
    ai.registerWorker(sampleWorker('w2', { insuranceEnrolled: false }));
    expect(ai.insuranceCoverageRate()).toBe(50);
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() => ai.registerWorker(sampleWorker('w1'), 'C')).toThrow('BLOCKED');
  });
});
