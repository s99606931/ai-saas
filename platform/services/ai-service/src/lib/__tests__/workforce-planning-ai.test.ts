import { describe, it, expect } from 'vitest';
import { WorkforcePlanningAI } from '../workforce-planning-ai.js';

describe('SVC-AI-ADV-R426 WorkforcePlanningAI', () => {
  const svc = new WorkforcePlanningAI();

  it('FR-426.2: 과부하 → INCREASE', () => {
    const r = svc.plan([{ deptId: 'D1', workload: 1500, headcount: 10 }], 100);
    expect(r.advices[0]!.action).toBe('INCREASE'); // 150 > 120
  });

  it('FR-426.2: 저부하 → DECREASE', () => {
    const r = svc.plan([{ deptId: 'D2', workload: 400, headcount: 10 }], 100);
    expect(r.advices[0]!.action).toBe('DECREASE'); // 40 < 60
  });

  it('FR-426.2: 유지 → MAINTAIN', () => {
    const r = svc.plan([{ deptId: 'D3', workload: 1000, headcount: 10 }], 100);
    expect(r.advices[0]!.action).toBe('MAINTAIN');
  });

  it('FR-426.3: neededDelta 계산', () => {
    const r = svc.plan([{ deptId: 'D4', workload: 1500, headcount: 10 }], 100);
    expect(r.advices[0]!.neededDelta).toBe(5); // round(15)-10
  });

  it('FR-426.5: top3 증원 필요', () => {
    const r = svc.plan(
      [
        { deptId: 'D1', workload: 2000, headcount: 10 },
        { deptId: 'D2', workload: 1500, headcount: 10 },
        { deptId: 'D3', workload: 1400, headcount: 10 },
        { deptId: 'D4', workload: 1300, headcount: 10 },
      ],
      100,
    );
    expect(r.topIncreaseDepts).toEqual(['D1', 'D2', 'D3']);
  });

  it('FR-426.4: S 차단', () => {
    expect(() => svc.plan([], 100, 'S')).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.plan([{ deptId: 'D', workload: 100, headcount: 1 }], 100);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
