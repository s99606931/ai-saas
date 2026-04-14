import { describe, it, expect, beforeEach } from 'vitest';
import { PublicGrantEligibilityAIV2 } from '../public-grant-eligibility-ai-v2';

describe('PublicGrantEligibilityAIV2', () => {
  let svc: PublicGrantEligibilityAIV2;

  beforeEach(() => {
    svc = new PublicGrantEligibilityAIV2();
    svc.defineProgram({ programId: 'p1', minScore: 0.7, incomeCap: 30000000 });
  });

  it('FR-R683.3/4: ELIGIBLE when score>=minScore', () => {
    const r = svc.assess({
      applicationId: 'a1',
      programId: 'p1',
      applicantId: '900101-1234567',
      needIndex: 0.8,
      impactScore: 0.8,
      income: 20000000,
    });
    expect(r.verdict).toBe('ELIGIBLE');
    expect(r.maskedApplicantId).toHaveLength(16);
    expect(r.maskedApplicantId).not.toContain('900101');
  });

  it('REVIEW when score within margin', () => {
    const r = svc.assess({
      applicationId: 'a2',
      programId: 'p1',
      applicantId: 'x',
      needIndex: 0.6,
      impactScore: 0.55,
      income: 20000000,
    });
    expect(r.verdict).toBe('REVIEW');
  });

  it('REJECTED when income > cap', () => {
    const r = svc.assess({
      applicationId: 'a3',
      programId: 'p1',
      applicantId: 'x',
      needIndex: 0.9,
      impactScore: 0.9,
      income: 50000000,
    });
    expect(r.verdict).toBe('REJECTED');
    expect(r.reason).toContain('income');
  });

  it('FR-R683.2: C/S grade blocked', () => {
    expect(() =>
      svc.assess(
        {
          applicationId: 'a',
          programId: 'p1',
          applicantId: 'x',
          needIndex: 0.5,
          impactScore: 0.5,
          income: 0,
        },
        'C',
      ),
    ).toThrow('BLOCKED');
  });

  it('rejects unknown program / invalid inputs', () => {
    expect(() =>
      svc.assess({
        applicationId: 'a',
        programId: 'ghost',
        applicantId: 'x',
        needIndex: 0.5,
        impactScore: 0.5,
        income: 0,
      }),
    ).toThrow('UNKNOWN_PROGRAM');
    expect(() =>
      svc.defineProgram({ programId: 'bad', minScore: 2, incomeCap: 0 }),
    ).toThrow('INVALID_MIN_SCORE');
  });

  it('FR-R683.5: audit log uses masked applicantId', () => {
    svc.assess({
      applicationId: 'a9',
      programId: 'p1',
      applicantId: '900101-9999999',
      needIndex: 0.5,
      impactScore: 0.5,
      income: 0,
    });
    const audit = svc.getAuditLog();
    expect(audit.some((e) => e.action === 'ASSESS')).toBe(true);
    for (const e of audit) {
      expect(JSON.stringify(e.details ?? {})).not.toContain('900101');
    }
  });
});
