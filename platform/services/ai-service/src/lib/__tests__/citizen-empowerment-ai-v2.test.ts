import { describe, it, expect, beforeEach } from 'vitest';
import { CitizenEmpowermentAIV2 } from '../citizen-empowerment-ai-v2';

describe('CitizenEmpowermentAIV2', () => {
  let svc: CitizenEmpowermentAIV2;

  beforeEach(() => {
    svc = new CitizenEmpowermentAIV2();
  });

  it('ADVANCED for high literacy', () => {
    const r = svc.assess({ citizenId: 'c1', deviceUsage: 1, onlineFreq: 1, errorRate: 0 });
    expect(r.tier).toBe('ADVANCED');
    expect(r.score).toBeGreaterThanOrEqual(80);
  });

  it('BEGINNER for low literacy', () => {
    const r = svc.assess({ citizenId: 'c2', deviceUsage: 0.1, onlineFreq: 0.1, errorRate: 0.9 });
    expect(r.tier).toBe('BEGINNER');
  });

  it('INTERMEDIATE in mid range', () => {
    const r = svc.assess({ citizenId: 'c3', deviceUsage: 0.7, onlineFreq: 0.6, errorRate: 0.3 });
    expect(r.tier).toBe('INTERMEDIATE');
  });

  it('masks citizenId', () => {
    const r = svc.assess({ citizenId: 'kim123', deviceUsage: 0.5, onlineFreq: 0.5, errorRate: 0.5 });
    expect(r.maskedCitizen).toMatch(/^[0-9a-f]{16}$/);
    expect(r.maskedCitizen).not.toContain('kim');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    const inp = { citizenId: 'c1', deviceUsage: 0.5, onlineFreq: 0.5, errorRate: 0.5 };
    expect(() => svc.assess(inp, 'C')).toThrow('BLOCKED');
    expect(() => svc.assess(inp, 'S')).toThrow('BLOCKED');
  });

  it('records audit log', () => {
    svc.assess({ citizenId: 'c1', deviceUsage: 0.5, onlineFreq: 0.5, errorRate: 0.5 });
    expect(svc.getAuditLog().some((e) => e.action === 'ASSESS_LITERACY')).toBe(true);
  });
});
