import { describe, it, expect, beforeEach } from 'vitest';
import { AIElderAbuseDetector } from '../ai-elder-abuse-detector';

describe('AIElderAbuseDetector', () => {
  let ai: AIElderAbuseDetector;

  beforeEach(() => {
    ai = new AIElderAbuseDetector();
  });

  const baseObs = {
    caseId: 'E1',
    observationDate: '2026-04-13',
    bruises: false,
    unexplainedInjury: false,
    malnutrition: false,
    hygieneIssue: false,
    withdrawn: false,
    fearOfCaregiver: false,
    unusualFinancialWithdrawals: false,
    isolationFromFamily: false,
    missedMedicalCare: false,
  };

  it('신호 없음은 low 수준', () => {
    const r = ai.evaluate({ ...baseObs });
    expect(r.level).toBe('low');
    expect(r.suspectedTypes).toHaveLength(0);
  });

  it('다수 신호는 severe 수준', () => {
    const r = ai.evaluate({
      ...baseObs,
      bruises: true,
      unexplainedInjury: true,
      fearOfCaregiver: true,
      malnutrition: true,
      unusualFinancialWithdrawals: true,
    });
    expect(['high', 'severe']).toContain(r.level);
    expect(r.suspectedTypes).toContain('physical');
    expect(r.suspectedTypes).toContain('financial');
  });

  it('재정 신호만 있으면 financial 타입', () => {
    const r = ai.evaluate({ ...baseObs, unusualFinancialWithdrawals: true });
    expect(r.suspectedTypes).toContain('financial');
  });

  it('방임 관련 신호 탐지', () => {
    const r = ai.evaluate({ ...baseObs, malnutrition: true, hygieneIssue: true, missedMedicalCare: true });
    expect(r.suspectedTypes).toContain('neglect');
  });

  it('severe 시 즉시 신고 액션', () => {
    const r = ai.evaluate({
      ...baseObs,
      bruises: true,
      unexplainedInjury: true,
      fearOfCaregiver: true,
      malnutrition: true,
      unusualFinancialWithdrawals: true,
      isolationFromFamily: true,
    });
    expect(r.nextAction).toContain('신고');
  });

  it('C등급 차단', () => {
    expect(() => ai.evaluate(baseObs, 'C' as never)).toThrow('BLOCKED');
  });
});
