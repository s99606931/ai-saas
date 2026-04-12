import { describe, it, expect } from 'vitest';
import { DataResidencyPolicyEngine, type ResidencyPolicy, type ApprovalRecord } from '../data-residency-policy';

describe('DataResidencyPolicyEngine', () => {
  const svc = new DataResidencyPolicyEngine();

  const policy: ResidencyPolicy = {
    allowedRegions: ['kr-central', 'kr-south'],
    blockedCountries: ['XX', 'YY'],
    requireApprovalCountries: ['US'],
  };

  it('validates policy', () => {
    expect(svc.validatePolicy(policy)).toBe(true);
  });

  it('detects storage in blocked country', () => {
    const v = svc.verifyStorage(policy, {
      resourceId: 'R1',
      region: 'us-east',
      country: 'XX',
    });
    expect(v?.violationType).toBe('storage-forbidden');
  });

  it('detects storage outside allowed region', () => {
    const v = svc.verifyStorage(policy, {
      resourceId: 'R1',
      region: 'eu-west',
      country: 'DE',
    });
    expect(v?.violationType).toBe('storage-forbidden');
  });

  it('allows storage in allowed region', () => {
    const v = svc.verifyStorage(policy, {
      resourceId: 'R1',
      region: 'kr-central',
      country: 'KR',
    });
    expect(v).toBeNull();
  });

  it('blocks transfer to blocked country', () => {
    const v = svc.verifyTransfer(policy, { resourceId: 'R1', targetRegion: 'xx', targetCountry: 'XX' }, []);
    expect(v?.violationType).toBe('transfer-forbidden');
  });

  it('requires approval for US transfer', () => {
    const v = svc.verifyTransfer(policy, { resourceId: 'R1', targetRegion: 'us-east', targetCountry: 'US' }, []);
    expect(v?.violationType).toBe('approval-required');
  });

  it('allows transfer with valid approval', () => {
    const approvals: ApprovalRecord[] = [
      { approvalId: 'A1', approver: 'admin', targetCountry: 'US', expiresAt: '2099-01-01' },
    ];
    const v = svc.verifyTransfer(
      policy,
      { resourceId: 'R1', targetRegion: 'us-east', targetCountry: 'US', approvalId: 'A1' },
      approvals,
    );
    expect(v).toBeNull();
  });

  it('generates audit entry', () => {
    const audit = svc.audit('transfer', 'R1', 'block', '차단국가');
    expect(audit.result).toBe('block');
  });
});
