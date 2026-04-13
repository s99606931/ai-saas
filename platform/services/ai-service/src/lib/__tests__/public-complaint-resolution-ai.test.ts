import { describe, it, expect, beforeEach } from 'vitest';
import { PublicComplaintResolutionAI } from '../public-complaint-resolution-ai';

describe('PublicComplaintResolutionAI', () => {
  let ai: PublicComplaintResolutionAI;

  beforeEach(() => {
    ai = new PublicComplaintResolutionAI();
  });

  const sample = (over: Partial<Parameters<typeof ai.registerComplaint>[0]> = {}) => ({
    id: 'c1',
    citizenId: 'u1',
    category: 'road' as const,
    description: '포트홀',
    submittedAt: '2026-04-13',
    urgencyScore: 50,
    ...over,
  });

  it('민원을 등록한다', () => {
    ai.registerComplaint(sample());
    expect(ai.getAuditLog().some(l => l.action === 'REGISTER_COMPLAINT')).toBe(true);
  });

  it('긴급도 80+는 critical 우선순위', () => {
    ai.registerComplaint(sample({ urgencyScore: 90 }));
    const plan = ai.buildPlan('c1');
    expect(plan.priority).toBe('critical');
    expect(plan.expectedDays).toBe(1);
  });

  it('카테고리에 맞는 부서가 배정된다', () => {
    ai.registerComplaint(sample({ category: 'welfare' }));
    const plan = ai.buildPlan('c1');
    expect(plan.assignedDept).toBe('복지지원과');
    expect(plan.recommendedActions).toContain('복지 상담사 연계');
  });

  it('normal 우선순위는 7일 내 해결', () => {
    ai.registerComplaint(sample({ urgencyScore: 40 }));
    const plan = ai.buildPlan('c1');
    expect(plan.priority).toBe('normal');
    expect(plan.expectedDays).toBe(7);
  });

  it('getPlan으로 계획을 조회한다', () => {
    ai.registerComplaint(sample());
    ai.buildPlan('c1');
    expect(ai.getPlan('c1')).toBeDefined();
  });

  it('S등급을 차단한다', () => {
    expect(() => ai.registerComplaint(sample(), 'S' as unknown as never)).toThrow(/BLOCKED/);
  });
});
