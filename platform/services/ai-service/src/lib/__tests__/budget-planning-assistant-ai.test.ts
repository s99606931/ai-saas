import { describe, it, expect, beforeEach } from 'vitest';
import { BudgetPlanningAssistantAI } from '../budget-planning-assistant-ai';

describe('BudgetPlanningAssistantAI', () => {
  let assistant: BudgetPlanningAssistantAI;

  beforeEach(() => {
    assistant = new BudgetPlanningAssistantAI();
  });

  it('예산 항목을 등록한다', () => {
    assistant.registerBudgetItem('b1', 'IT 인프라', 1000000, 2026);
    expect(assistant.getAuditLog().some(l => l.action === 'REGISTER_BUDGET_ITEM')).toBe(true);
  });

  it('집행을 기록한다', () => {
    assistant.registerBudgetItem('b1', 'IT 인프라', 1000000, 2026);
    assistant.recordExpenditure('b1', 500000, '2026-04-01');
    expect(assistant.getAuditLog().some(l => l.action === 'RECORD_EXPENDITURE')).toBe(true);
  });

  it('집행률과 정상 상태를 반환한다', () => {
    assistant.registerBudgetItem('b1', 'IT 인프라', 1000000, 2026);
    assistant.recordExpenditure('b1', 900000, '2026-04-01');
    const result = assistant.getExecutionRate('b1');
    expect(result.executionRate).toBe(90);
    expect(result.status).toBe('on_track');
  });

  it('과집행 상태를 탐지한다', () => {
    assistant.registerBudgetItem('b1', 'IT 인프라', 1000000, 2026);
    assistant.recordExpenditure('b1', 1200000, '2026-04-01');
    const result = assistant.getExecutionRate('b1');
    expect(result.status).toBe('over');
  });

  it('차기 예산을 추천한다', () => {
    assistant.registerBudgetItem('b1', 'IT 인프라', 1000000, 2026);
    assistant.recordExpenditure('b1', 1200000, '2026-04-01');
    const rec = assistant.recommendNextBudget('b1');
    expect(rec.recommendedAmount).toBeGreaterThan(1200000);
    expect(rec.basis).toContain('110%');
  });

  it('C등급 집행 기록을 차단한다', () => {
    assistant.registerBudgetItem('b1', 'IT 인프라', 1000000, 2026);
    expect(() => assistant.recordExpenditure('b1', 500000, '2026-04-01', 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 항목 집행 기록 시 오류를 던진다', () => {
    expect(() => assistant.recordExpenditure('unknown', 500000, '2026-04-01')).toThrow('예산 항목 미등록');
  });
});
