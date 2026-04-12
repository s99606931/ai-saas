import { describe, it, expect } from 'vitest';
import { TechDebtQuantifier, type CodeMetrics } from '../tech-debt-quantifier';

describe('TechDebtQuantifier', () => {
  const svc = new TechDebtQuantifier();

  const metrics: CodeMetrics[] = [
    { file: 'a.ts', linesOfCode: 1000, cyclomaticComplexity: 15, duplicateLines: 30, testCoverage: 0.3, todoCount: 10 },
    { file: 'b.ts', linesOfCode: 100, cyclomaticComplexity: 5, duplicateLines: 0, testCoverage: 0.9, todoCount: 0 },
  ];

  it('FR-TD.1 메트릭 수집', () => {
    expect(svc.collectMetrics(metrics).length).toBe(2);
  });

  it('FR-TD.2 부채 스코어 (critical)', () => {
    const s = svc.scoreDebt(metrics[0]!);
    expect(s.level).toBe('critical');
  });

  it('FR-TD.2 부채 스코어 (low)', () => {
    const s = svc.scoreDebt(metrics[1]!);
    expect(s.level).toBe('low');
  });

  it('FR-TD.3 우선순위', () => {
    const ranked = svc.prioritize(metrics.map((m) => svc.scoreDebt(m)));
    expect(ranked[0]!.file).toBe('a.ts');
  });

  it('FR-TD.4 리팩토링 추천', () => {
    const recs = svc.recommend(svc.scoreDebt(metrics[0]!));
    expect(recs.length).toBeGreaterThan(2);
  });

  it('FR-TD.5 트렌드', () => {
    svc.recordTrend('2026-W15', 100);
    expect(svc.getTrend().length).toBeGreaterThanOrEqual(1);
  });
});
