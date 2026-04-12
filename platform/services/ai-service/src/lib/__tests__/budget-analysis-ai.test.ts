// MTU-N297 예산 AI 분석 테스트
import { describe, it, expect } from 'vitest';
import { BudgetAnalysisAIService } from '../budget-analysis-ai.js';

describe('MTU-N297 BudgetAnalysisAI', () => {
  const svc = new BudgetAnalysisAIService('tenant-n297');

  const items = [
    { itemId: 'b1', category: '인건비', subCategory: '기본급', description: '직원 급여', currentAmount: 100_000_000, previousAmount: 95_000_000, executedAmount: 30_000_000, fiscalYear: 2026 },
    { itemId: 'b2', category: '운영비', subCategory: '소모품', description: '사무용품', currentAmount: 200_000_000, previousAmount: 50_000_000, executedAmount: 5_000_000, fiscalYear: 2026 },
  ];

  it('FR-N297.1: 이상 탐지', () => {
    const a = svc.detectAnomalies(items);
    expect(Array.isArray(a)).toBe(true);
  });

  it('FR-N297.2: 집행 예측', () => {
    const f = svc.forecast(items, 4);
    expect(Array.isArray(f)).toBe(true);
  });

  it('FR-N297.3: 벤치마크', () => {
    const b = svc.benchmark(items);
    expect(Array.isArray(b)).toBe(true);
  });

  it('FR-N297.4: 리포트', () => {
    const r = svc.generateReport(items, 2026, 4);
    expect(r.reportId).toBeDefined();
  });

  it('FR-N297.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
