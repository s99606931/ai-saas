import { describe, it, expect, beforeEach } from 'vitest';
import { GrantFraudDetectionAI } from '../grant-fraud-detection-ai';

describe('GrantFraudDetectionAI', () => {
  let ai: GrantFraudDetectionAI;

  const app = (over = {}) => ({
    applicationId: 'a1',
    applicantHash: 'h1',
    amountKrw: 3_000_000,
    programCode: 'welfare',
    submittedAt: '2026-04-13T10:00:00Z',
    incomeReported: 20_000_000,
    addressHash: 'addr1',
    ...over,
  });

  beforeEach(() => {
    ai = new GrantFraudDetectionAI();
  });

  it('정상 신청은 low 리스크', () => {
    ai.registerApplication(app());
    const a = ai.assess('a1');
    expect(a.riskBand).toBe('low');
    expect(a.recommendedAction).toBe('approve');
  });

  it('한도 초과는 overclaimed_amount 플래그', () => {
    ai.registerApplication(app({ amountKrw: 10_000_000 }));
    const a = ai.assess('a1');
    expect(a.flags).toContain('overclaimed_amount');
  });

  it('동일 신청자 3회 이상은 duplicate 플래그', () => {
    ai.registerApplication(app({ applicationId: 'a1' }));
    ai.registerApplication(app({ applicationId: 'a2' }));
    ai.registerApplication(app({ applicationId: 'a3' }));
    const a = ai.assess('a3');
    expect(a.flags).toContain('duplicate_applicant');
  });

  it('소득 0 + 고액은 ghost_beneficiary', () => {
    ai.registerApplication(app({ incomeReported: 0, amountKrw: 2_000_000 }));
    const a = ai.assess('a1');
    expect(a.flags).toContain('ghost_beneficiary');
  });

  it('critical 리스크는 reject', () => {
    ai.registerApplication(app({ applicationId: 'a1', incomeReported: 0, amountKrw: 10_000_000 }));
    ai.registerApplication(app({ applicationId: 'a2', incomeReported: 0, amountKrw: 10_000_000 }));
    ai.registerApplication(app({ applicationId: 'a3', incomeReported: 0, amountKrw: 10_000_000 }));
    const a = ai.assess('a3');
    expect(['high', 'critical']).toContain(a.riskBand);
  });

  it('S등급 차단', () => {
    expect(() => ai.registerApplication(app(), 'S' as unknown as never)).toThrow(/BLOCKED/);
  });
});
