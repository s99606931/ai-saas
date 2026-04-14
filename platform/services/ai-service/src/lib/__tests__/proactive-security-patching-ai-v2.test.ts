import { describe, it, expect, beforeEach } from 'vitest';
import { ProactiveSecurityPatchingAIV2 } from '../proactive-security-patching-ai-v2';

describe('ProactiveSecurityPatchingAIV2', () => {
  let patch: ProactiveSecurityPatchingAIV2;

  beforeEach(() => {
    patch = new ProactiveSecurityPatchingAIV2();
    patch.registerAsset({ assetId: 'a1', component: 'nginx', version: '1.20' });
  });

  it('classifies CRITICAL + IMMEDIATE for cvss >= 9.0', () => {
    const r = patch.reportVulnerability({
      vulnId: 'v1',
      assetId: 'a1',
      cvss: 9.5,
      exploitAvailable: false,
    });
    expect(r.severity).toBe('CRITICAL');
    expect(r.action).toBe('IMMEDIATE');
  });

  it('classifies HIGH + IMMEDIATE for cvss 7~9', () => {
    const r = patch.reportVulnerability({
      vulnId: 'v1',
      assetId: 'a1',
      cvss: 7.5,
      exploitAvailable: false,
    });
    expect(r.severity).toBe('HIGH');
    expect(r.action).toBe('IMMEDIATE');
  });

  it('classifies MEDIUM + SCHEDULED for cvss 4~7', () => {
    const r = patch.reportVulnerability({
      vulnId: 'v1',
      assetId: 'a1',
      cvss: 5.0,
      exploitAvailable: false,
    });
    expect(r.severity).toBe('MEDIUM');
    expect(r.action).toBe('SCHEDULED');
  });

  it('classifies LOW + MONITOR for cvss < 4', () => {
    const r = patch.reportVulnerability({
      vulnId: 'v1',
      assetId: 'a1',
      cvss: 2.0,
      exploitAvailable: false,
    });
    expect(r.severity).toBe('LOW');
    expect(r.action).toBe('MONITOR');
  });

  it('escalates action one rank when exploitAvailable', () => {
    const r = patch.reportVulnerability({
      vulnId: 'v1',
      assetId: 'a1',
      cvss: 5.0,
      exploitAvailable: true,
    });
    expect(r.action).toBe('IMMEDIATE');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() =>
      patch.reportVulnerability(
        { vulnId: 'v', assetId: 'a1', cvss: 5, exploitAvailable: false },
        'C',
      ),
    ).toThrow('BLOCKED');
    expect(() =>
      patch.reportVulnerability(
        { vulnId: 'v', assetId: 'a1', cvss: 5, exploitAvailable: false },
        'S',
      ),
    ).toThrow('BLOCKED');
  });

  it('rejects unknown asset and invalid cvss', () => {
    expect(() =>
      patch.reportVulnerability({
        vulnId: 'v',
        assetId: 'unknown',
        cvss: 5,
        exploitAvailable: false,
      }),
    ).toThrow('UNKNOWN_ASSET');
    expect(() =>
      patch.reportVulnerability({ vulnId: 'v', assetId: 'a1', cvss: 11, exploitAvailable: false }),
    ).toThrow('INVALID_CVSS');
  });

  it('lists immediate patches and maintains audit log', () => {
    patch.reportVulnerability({ vulnId: 'v1', assetId: 'a1', cvss: 9.5, exploitAvailable: false });
    patch.reportVulnerability({ vulnId: 'v2', assetId: 'a1', cvss: 3, exploitAvailable: false });
    expect(patch.getImmediatePatches().map((p) => p.vulnId)).toEqual(['v1']);
    expect(patch.getAuditLog().some((e) => e.action === 'REPORT_VULN')).toBe(true);
  });
});
