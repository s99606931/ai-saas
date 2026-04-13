import { describe, it, expect } from 'vitest';
import { AISlaEnforcer } from '../ai-sla-enforcer.js';

describe('SVC-AI-ADV-R404 AISlaEnforcer', () => {
  const svc = new AISlaEnforcer();

  it('FR-394.1: 위반 없음', () => {
    const r = svc.enforce({ slaId: 's1', target: 99, actual: 99.5, basePenalty: 1000 });
    expect(r.violationRatio).toBe(0);
    expect(r.penalty).toBe(0);
    expect(r.level).toBe('none');
  });

  it('FR-394.2: L1 경미 위반', () => {
    // target=100, actual=95, ratio=0.05
    const r = svc.enforce({ slaId: 's2', target: 100, actual: 95, basePenalty: 1000 });
    expect(r.level).toBe('L1');
    expect(r.penalty).toBe(50);
  });

  it('FR-394.3: L2 중간 위반', () => {
    // ratio=0.2
    const r = svc.enforce({ slaId: 's3', target: 100, actual: 80, basePenalty: 1000 });
    expect(r.level).toBe('L2');
    expect(r.penalty).toBe(200);
  });

  it('FR-394.4: L3 심각 위반', () => {
    // ratio=0.5
    const r = svc.enforce({ slaId: 's4', target: 100, actual: 50, basePenalty: 1000 });
    expect(r.level).toBe('L3');
    expect(r.penalty).toBe(500);
  });

  it('FR-394.5: S등급 차단', () => {
    expect(() =>
      svc.enforce({ slaId: 's', target: 100, actual: 50, basePenalty: 100 }, 'S'),
    ).toThrow('N2SF_BLOCKED');
  });

  it('잘못된 target', () => {
    expect(() => svc.enforce({ slaId: 's', target: 0, actual: 0, basePenalty: 100 })).toThrow(
      'INVALID_TARGET',
    );
  });

  it('감사 로그', () => {
    svc.enforce({ slaId: 's6', target: 100, actual: 100, basePenalty: 0 });
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
