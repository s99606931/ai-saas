import { describe, it, expect } from 'vitest';
import { AiCodeQualityGate } from '../ai-code-quality-gate.js';

describe('SVC-AI-ADV-R361 AiCodeQualityGate', () => {
  const svc = new AiCodeQualityGate();

  it('FR-361.1: 고품질 → 통과', () => {
    const r = svc.evaluate('pr1', {
      complexity: 3,
      coverage: 0.9,
      duplication: 0.05,
      securityIssues: 0,
    });
    expect(r.block).toBe(false);
    expect(r.score).toBeGreaterThan(0.7);
  });

  it('FR-361.2: 저품질 → 차단', () => {
    const r = svc.evaluate('pr2', {
      complexity: 9,
      coverage: 0.3,
      duplication: 0.5,
      securityIssues: 5,
    });
    expect(r.block).toBe(true);
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it('FR-361.3: C등급 차단', () => {
    expect(() =>
      svc.evaluate(
        'pr3',
        { complexity: 3, coverage: 0.9, duplication: 0.05, securityIssues: 0 },
        0.7,
        'C',
      ),
    ).toThrow('N2SF_BLOCKED');
  });

  it('FR-361.4: 감사 로그', () => {
    svc.evaluate('pr4', { complexity: 3, coverage: 0.9, duplication: 0.05, securityIssues: 0 });
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });

  it('threshold 경계', () => {
    expect(() =>
      svc.evaluate('pr5', { complexity: 3, coverage: 0.9, duplication: 0.05, securityIssues: 0 }, 1.5),
    ).toThrow('INVALID_PARAMS');
  });
});
