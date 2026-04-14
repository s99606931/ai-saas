import { describe, it, expect, beforeEach } from 'vitest';
import { RegulatorySandboxAIV2 } from '../regulatory-sandbox-ai-v2';

describe('RegulatorySandboxAIV2', () => {
  let svc: RegulatorySandboxAIV2;

  beforeEach(() => {
    svc = new RegulatorySandboxAIV2();
  });

  it('FR-R686.3/4: HIGH risk → REJECT', () => {
    const r = svc.submitApplication({
      applicationId: 'app1',
      sponsorEmail: 'sp@example.com',
      consumerImpact: 0.9,
      legalRisk: 0.9,
      dataSensitivity: 0.9,
    });
    expect(r.riskLevel).toBe('HIGH');
    expect(r.verdict).toBe('REJECT');
    expect(r.maskedSponsor).toHaveLength(16);
    expect(r.maskedSponsor).not.toContain('sp@');
  });

  it('MEDIUM risk → CONDITIONAL', () => {
    const r = svc.submitApplication({
      applicationId: 'app2',
      sponsorEmail: 'x',
      consumerImpact: 0.5,
      legalRisk: 0.5,
      dataSensitivity: 0.5,
    });
    expect(r.riskLevel).toBe('MEDIUM');
    expect(r.verdict).toBe('CONDITIONAL');
  });

  it('LOW risk → APPROVE', () => {
    const r = svc.submitApplication({
      applicationId: 'app3',
      sponsorEmail: 'x',
      consumerImpact: 0.1,
      legalRisk: 0.1,
      dataSensitivity: 0.1,
    });
    expect(r.riskLevel).toBe('LOW');
    expect(r.verdict).toBe('APPROVE');
  });

  it('FR-R686.1: C/S blocked', () => {
    expect(() =>
      svc.submitApplication(
        {
          applicationId: 'app',
          sponsorEmail: 'x',
          consumerImpact: 0.1,
          legalRisk: 0.1,
          dataSensitivity: 0.1,
        },
        'S',
      ),
    ).toThrow('BLOCKED');
  });

  it('rejects invalid inputs', () => {
    expect(() =>
      svc.submitApplication({
        applicationId: 'a',
        sponsorEmail: 'x',
        consumerImpact: 2,
        legalRisk: 0.1,
        dataSensitivity: 0.1,
      }),
    ).toThrow('INVALID_CONSUMER_IMPACT');
  });

  it('FR-R686.5: audit log masks sponsorEmail', () => {
    svc.submitApplication({
      applicationId: 'a9',
      sponsorEmail: 'leak@example.com',
      consumerImpact: 0.2,
      legalRisk: 0.2,
      dataSensitivity: 0.2,
    });
    const audit = svc.getAuditLog();
    expect(audit.some((e) => e.action === 'SUBMIT_APPLICATION')).toBe(true);
    for (const e of audit) {
      expect(JSON.stringify(e.details ?? {})).not.toContain('leak@example.com');
    }
  });
});
