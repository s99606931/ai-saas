import { describe, it, expect, beforeEach } from 'vitest';
import { SchoolViolencePreventionAI } from '../school-violence-prevention-ai';

describe('SchoolViolencePreventionAI', () => {
  let ai: SchoolViolencePreventionAI;

  beforeEach(() => {
    ai = new SchoolViolencePreventionAI();
  });

  it('학급을 등록한다', () => {
    ai.registerClass({ classId: 'c1', schoolName: '한빛중', studentCount: 28 });
    expect(ai.listClasses().length).toBe(1);
  });

  it('신호를 보고한다', () => {
    ai.registerClass({ classId: 'c1', schoolName: 'A', studentCount: 25 });
    ai.reportSignal({ classId: 'c1', signal: 'peer_report', weight: 5, recordedAt: 'now' });
    expect(ai.getSignals('c1').length).toBe(1);
  });

  it('자해 언급이 있으면 즉시 urgent로 분류한다', () => {
    ai.registerClass({ classId: 'c1', schoolName: 'A', studentCount: 25 });
    ai.reportSignal({ classId: 'c1', signal: 'self_harm_mention', weight: 3, recordedAt: 'now' });
    const result = ai.assess('c1');
    expect(result.tier).toBe('urgent');
    expect(result.criticalSignalPresent).toBe(true);
    expect(result.recommendedActions.length).toBeGreaterThan(0);
  });

  it('신호가 없으면 none 등급을 반환한다', () => {
    ai.registerClass({ classId: 'c1', schoolName: 'A', studentCount: 25 });
    const result = ai.assess('c1');
    expect(result.tier).toBe('none');
    expect(result.riskScore).toBe(0);
  });

  it('미등록 학급 보고는 거부한다', () => {
    expect(() =>
      ai.reportSignal({ classId: 'unknown', signal: 'absenteeism', weight: 3, recordedAt: 'now' }),
    ).toThrow('학급 미등록');
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() => ai.registerClass({ classId: 'c1', schoolName: 'X', studentCount: 20 }, 'S')).toThrow('BLOCKED');
  });
});
