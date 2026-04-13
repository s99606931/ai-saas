import { describe, it, expect, beforeEach } from 'vitest';
import {
  GovernmentStaffWellnessAI,
  type WellnessSnapshot,
} from '../government-staff-wellness-ai';

const snap = (ref: string, over: Partial<WellnessSnapshot> = {}): WellnessSnapshot => ({
  staffRef: ref,
  weeklyOvertimeHours: 5,
  stressSelfReport: 2,
  sleepHours: 7.5,
  exerciseDaysPerWeek: 3,
  recentSickDays: 0,
  burnoutRisk: 2,
  ...over,
});

describe('GovernmentStaffWellnessAI', () => {
  let ai: GovernmentStaffWellnessAI;

  beforeEach(() => {
    ai = new GovernmentStaffWellnessAI();
  });

  it('건강한 직원 healthy 판정', () => {
    ai.recordSnapshot(snap('ref001'));
    const r = ai.assess('ref001');
    expect(r.status).toBe('healthy');
  });

  it('과로 직원 개입 권고', () => {
    ai.recordSnapshot(
      snap('ref002', {
        weeklyOvertimeHours: 25,
        stressSelfReport: 5,
        sleepHours: 5,
        burnoutRisk: 5,
      }),
    );
    const r = ai.assess('ref002');
    expect(['at-risk', 'critical']).toContain(r.status);
    expect(r.interventions.length).toBeGreaterThan(0);
  });

  it('상태별 집계', () => {
    ai.recordSnapshot(snap('ref001'));
    ai.recordSnapshot(
      snap('ref002', { weeklyOvertimeHours: 30, stressSelfReport: 5, burnoutRisk: 5, sleepHours: 4 }),
    );
    const agg = ai.aggregateByStatus();
    expect(agg.healthy + agg.watch + agg['at-risk'] + agg.critical).toBe(2);
  });

  it('위험군 조회', () => {
    ai.recordSnapshot(
      snap('ref003', { weeklyOvertimeHours: 30, stressSelfReport: 5, burnoutRisk: 5, sleepHours: 4, recentSickDays: 6 }),
    );
    const critical = ai.listCritical();
    expect(critical.length).toBe(1);
  });

  it('잘못된 참조 거부', () => {
    expect(() => ai.recordSnapshot(snap('ab'))).toThrow();
  });

  it('C등급 차단', () => {
    expect(() => ai.recordSnapshot(snap('ref999'), 'C')).toThrow('BLOCKED');
  });
});
