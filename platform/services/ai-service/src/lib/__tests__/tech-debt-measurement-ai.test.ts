import { describe, it, expect, beforeEach } from 'vitest';
import { TechDebtMeasurementAI } from '../tech-debt-measurement-ai';

describe('TechDebtMeasurementAI', () => {
  let debt: TechDebtMeasurementAI;

  beforeEach(() => {
    debt = new TechDebtMeasurementAI();
  });

  it('컴포넌트를 등록한다', () => {
    debt.registerComponent('comp-1', 'AuthService', 'TypeScript', 500);
    expect(debt.getAuditLog().some(l => l.action === 'REGISTER_COMPONENT')).toBe(true);
  });

  it('지표를 기록한다', () => {
    debt.registerComponent('comp-1', 'AuthService', 'TypeScript', 500);
    debt.recordMetrics('comp-1', 5, 10, 2);
    expect(debt.getAuditLog().some(l => l.action === 'RECORD_METRICS')).toBe(true);
  });

  it('높은 복잡도에서 높은 부채 점수를 반환한다', () => {
    debt.registerComponent('comp-1', 'AuthService', 'TypeScript', 500);
    debt.recordMetrics('comp-1', 10, 50, 5);
    const score = debt.calculateDebt('comp-1');
    expect(score.totalDebt).toBeGreaterThan(50);
    expect(['critical', 'high']).toContain(score.severity);
  });

  it('지표 없으면 totalDebt=0이다', () => {
    debt.registerComponent('comp-1', 'AuthService', 'TypeScript', 500);
    const score = debt.calculateDebt('comp-1');
    expect(score.totalDebt).toBe(0);
    expect(score.severity).toBe('low');
  });

  it('우선순위 정렬된 부채 목록을 반환한다', () => {
    debt.registerComponent('comp-1', 'A', 'TS', 100);
    debt.registerComponent('comp-2', 'B', 'TS', 100);
    debt.recordMetrics('comp-1', 10, 50, 5);
    debt.recordMetrics('comp-2', 2, 5, 1);
    const items = debt.getPrioritizedDebt();
    expect(items[0]!.componentId).toBe('comp-1');
    expect(items[0]!.totalDebt).toBeGreaterThan(items[1]!.totalDebt);
  });

  it('C등급 지표 기록을 차단한다', () => {
    debt.registerComponent('comp-1', 'A', 'TS', 100);
    expect(() => debt.recordMetrics('comp-1', 5, 10, 2, 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 컴포넌트 지표 기록 시 오류를 던진다', () => {
    expect(() => debt.recordMetrics('unknown', 5, 10, 2)).toThrow('컴포넌트 미등록');
  });

  it('topIssue가 최대 점수 항목을 가리킨다', () => {
    debt.registerComponent('comp-1', 'A', 'TS', 100);
    debt.recordMetrics('comp-1', 10, 5, 1); // complexityScore 높음
    const items = debt.getPrioritizedDebt();
    expect(items[0]!.topIssue).toBe('복잡도');
  });
});
