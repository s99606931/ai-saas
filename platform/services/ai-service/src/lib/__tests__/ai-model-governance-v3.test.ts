import { describe, it, expect, beforeEach } from 'vitest';
import { AIModelGovernanceV3 } from '../ai-model-governance-v3';

describe('AIModelGovernanceV3', () => {
  let gov: AIModelGovernanceV3;

  beforeEach(() => {
    gov = new AIModelGovernanceV3();
  });

  const good = {
    modelId: 'm1',
    version: '1.0',
    owner: 'alice@agency.gov',
    fairness: 0.9,
    explainability: 0.85,
    robustness: 0.8,
    privacy: 0.9,
  };

  it('APPROVES high-score model', () => {
    const r = gov.submit(good);
    expect(r.status).toBe('APPROVED');
    expect(r.failures).toEqual([]);
  });

  it('CONDITIONAL for mid-score model', () => {
    const r = gov.submit({
      ...good,
      fairness: 0.65,
      explainability: 0.65,
      robustness: 0.65,
      privacy: 0.65,
    });
    expect(r.status).toBe('CONDITIONAL');
  });

  it('REJECTS when any metric below 0.5', () => {
    const r = gov.submit({ ...good, fairness: 0.4 });
    expect(r.status).toBe('REJECTED');
    expect(r.failures).toContain('fairness');
  });

  it('masks owner as SHA-256 16-hex', () => {
    const r = gov.submit(good);
    expect(r.maskedOwner).toHaveLength(16);
    expect(r.maskedOwner).toMatch(/^[0-9a-f]{16}$/);
    expect(r.maskedOwner).not.toContain('@');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() => gov.submit(good, 'C')).toThrow('BLOCKED');
    expect(() => gov.submit(good, 'S')).toThrow('BLOCKED');
  });

  it('records audit log', () => {
    gov.submit(good);
    expect(gov.getAuditLog().some((e) => e.action === 'SUBMIT_MODEL')).toBe(true);
  });
});
