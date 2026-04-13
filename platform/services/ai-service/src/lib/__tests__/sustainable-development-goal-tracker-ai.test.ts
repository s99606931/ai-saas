import { describe, it, expect, beforeEach } from 'vitest';
import { SustainableDevelopmentGoalTrackerAI } from '../sustainable-development-goal-tracker-ai';

describe('SustainableDevelopmentGoalTrackerAI', () => {
  let sdg: SustainableDevelopmentGoalTrackerAI;

  beforeEach(() => {
    sdg = new SustainableDevelopmentGoalTrackerAI();
  });

  it('지표 보고서를 기록한다', () => {
    sdg.recordReport({
      goal: 'SDG01', indicatorCode: '1.1.1', year: 2025, value: 80, targetValue: 100, unit: '%',
    });
    expect(sdg.getAuditLog().some(l => l.action === 'RECORD_REPORT')).toBe(true);
  });

  it('목표 진행률을 계산한다', () => {
    sdg.recordReport({ goal: 'SDG03', indicatorCode: '3.1', year: 2025, value: 70, targetValue: 100, unit: '%' });
    sdg.recordReport({ goal: 'SDG03', indicatorCode: '3.2', year: 2025, value: 50, targetValue: 100, unit: '%' });
    const p = sdg.computeGoalProgress('SDG03');
    expect(p.achievementRatio).toBe(0.6);
    expect(p.indicatorCount).toBe(2);
  });

  it('최신 연도 기준으로 달성률 계산', () => {
    sdg.recordReport({ goal: 'SDG04', indicatorCode: '4.1', year: 2023, value: 50, targetValue: 100, unit: '%' });
    sdg.recordReport({ goal: 'SDG04', indicatorCode: '4.1', year: 2025, value: 90, targetValue: 100, unit: '%' });
    const p = sdg.computeGoalProgress('SDG04');
    expect(p.achievementRatio).toBe(0.9);
  });

  it('추세를 improving으로 판정', () => {
    sdg.recordReport({ goal: 'SDG07', indicatorCode: '7.1', year: 2023, value: 40, targetValue: 100, unit: '%' });
    sdg.recordReport({ goal: 'SDG07', indicatorCode: '7.1', year: 2025, value: 60, targetValue: 100, unit: '%' });
    const p = sdg.computeGoalProgress('SDG07');
    expect(p.trend).toBe('improving');
  });

  it('뒤쳐진 목표를 식별한다', () => {
    sdg.recordReport({ goal: 'SDG01', indicatorCode: '1.1', year: 2025, value: 30, targetValue: 100, unit: '%' });
    const lagging = sdg.listLaggingGoals(0.5);
    expect(lagging).toContain('SDG01');
  });

  it('C등급을 차단한다', () => {
    expect(() => sdg.recordReport({
      goal: 'SDG01', indicatorCode: '1.1', year: 2025, value: 10, targetValue: 100, unit: '%',
    }, 'C' as unknown as never)).toThrow(/BLOCKED/);
  });
});
