import { describe, it, expect, beforeEach } from 'vitest';
import { CivilDefenseTrainingAI } from '../civil-defense-training-ai';

describe('CivilDefenseTrainingAI', () => {
  let ai: CivilDefenseTrainingAI;

  beforeEach(() => {
    ai = new CivilDefenseTrainingAI();
  });

  it('훈련 기록을 추가한다', () => {
    ai.addRecord({
      traineeId: 't1',
      scenario: 'air_raid',
      completedMinutes: 30,
      requiredMinutes: 30,
      scoreOutOf100: 90,
      year: 2026,
    });
    expect(ai.listRecords('t1').length).toBe(1);
  });

  it('이수율을 계산한다', () => {
    ai.addRecord({
      traineeId: 't1',
      scenario: 'fire',
      completedMinutes: 20,
      requiredMinutes: 40,
      scoreOutOf100: 80,
      year: 2026,
    });
    expect(ai.completionRate('t1')).toBe(50);
  });

  it('평균 점수를 계산한다', () => {
    ai.addRecord({
      traineeId: 't1',
      scenario: 'flood',
      completedMinutes: 30,
      requiredMinutes: 30,
      scoreOutOf100: 80,
      year: 2026,
    });
    ai.addRecord({
      traineeId: 't1',
      scenario: 'earthquake',
      completedMinutes: 30,
      requiredMinutes: 30,
      scoreOutOf100: 90,
      year: 2026,
    });
    expect(ai.averageScore('t1')).toBe(85);
  });

  it('코칭 계획을 생성한다', () => {
    ai.addRecord({
      traineeId: 't1',
      scenario: 'chemical',
      completedMinutes: 30,
      requiredMinutes: 30,
      scoreOutOf100: 95,
      year: 2026,
    });
    const plan = ai.generatePlan('t1');
    expect(plan.overallLevel).toBe('advanced');
  });

  it('훈련 기록 없는 대상은 거부한다', () => {
    expect(() => ai.generatePlan('nobody')).toThrow('훈련 기록');
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() =>
      ai.addRecord(
        {
          traineeId: 't1',
          scenario: 'air_raid',
          completedMinutes: 10,
          requiredMinutes: 30,
          scoreOutOf100: 50,
          year: 2026,
        },
        'S',
      ),
    ).toThrow('BLOCKED');
  });
});
