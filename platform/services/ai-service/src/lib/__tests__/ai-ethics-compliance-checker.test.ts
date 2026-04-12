import { describe, it, expect } from 'vitest';
import {
  AiEthicsComplianceChecker,
  type AiSystem,
  type KcaChecklist,
} from '../ai-ethics-compliance-checker.js';

const fullYes: KcaChecklist = {
  humanCentered: true,
  fairness: true,
  transparency: true,
  accountability: true,
  privacy: true,
  safety: true,
  dataGovernance: true,
  publicInterest: true,
  sustainability: true,
  continuousImprovement: true,
};

describe('SVC-AI-ADV-R358 AiEthicsComplianceChecker', () => {
  const svc = new AiEthicsComplianceChecker();

  it('FR-358.1: unacceptable 분류', () => {
    const sys: AiSystem = {
      id: 's1',
      purpose: 'social_scoring for citizens',
      grade: 'O',
      checklist: fullYes,
    };
    const r = svc.check(sys);
    expect(r.euRisk).toBe('unacceptable');
    expect(r.compliant).toBe(false);
  });

  it('high 분류', () => {
    const sys: AiSystem = {
      id: 's2',
      purpose: 'recruitment screening',
      grade: 'O',
      checklist: fullYes,
    };
    expect(svc.check(sys).euRisk).toBe('high');
  });

  it('FR-358.2: 체크리스트 점수', () => {
    const half: KcaChecklist = { ...fullYes, fairness: false, privacy: false, safety: false };
    const sys: AiSystem = { id: 's3', purpose: 'chatbot', grade: 'O', checklist: half };
    const r = svc.check(sys);
    expect(r.kcaScore).toBeLessThan(1);
    expect(r.violations.length).toBe(3);
  });

  it('FR-358.3: C/S 차단', () => {
    const sys: AiSystem = { id: 's4', purpose: 'chatbot', grade: 'S', checklist: fullYes };
    expect(() => svc.check(sys)).toThrow('N2SF_BLOCKED');
  });

  it('FR-358.4: 감사 로그', () => {
    svc.check({ id: 's5', purpose: 'demo', grade: 'O', checklist: fullYes });
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });

  it('minimal risk compliant', () => {
    const sys: AiSystem = { id: 's6', purpose: 'news summary', grade: 'O', checklist: fullYes };
    const r = svc.check(sys);
    expect(r.euRisk).toBe('minimal');
    expect(r.compliant).toBe(true);
  });
});
