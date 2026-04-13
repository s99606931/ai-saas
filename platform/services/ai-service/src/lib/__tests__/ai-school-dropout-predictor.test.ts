import { describe, it, expect, beforeEach } from 'vitest';
import { AISchoolDropoutPredictor } from '../ai-school-dropout-predictor';

describe('AISchoolDropoutPredictor', () => {
  let ai: AISchoolDropoutPredictor;

  beforeEach(() => {
    ai = new AISchoolDropoutPredictor();
  });

  it('학생을 등록한다', () => {
    ai.registerStudent({
      studentId: 's1',
      schoolLevel: 'middle',
      attendanceRate: 95,
      avgGrade: 80,
      disciplinaryEvents: 0,
      familySupportScore: 8,
    });
    expect(ai.getStudent('s1')?.avgGrade).toBe(80);
  });

  it('위험도를 예측한다', () => {
    ai.registerStudent({
      studentId: 's1',
      schoolLevel: 'high',
      attendanceRate: 40,
      avgGrade: 30,
      disciplinaryEvents: 3,
      familySupportScore: 2,
    });
    const p = ai.predict('s1');
    expect(p.riskScore).toBeGreaterThan(50);
    expect(['high', 'critical']).toContain(p.riskLevel);
    expect(p.topFactors.length).toBe(2);
  });

  it('저위험 학생도 식별한다', () => {
    ai.registerStudent({
      studentId: 's1',
      schoolLevel: 'elementary',
      attendanceRate: 99,
      avgGrade: 95,
      disciplinaryEvents: 0,
      familySupportScore: 10,
    });
    const p = ai.predict('s1');
    expect(p.riskLevel).toBe('low');
  });

  it('위험 학생 목록을 필터링한다', () => {
    ai.registerStudent({
      studentId: 's1',
      schoolLevel: 'high',
      attendanceRate: 30,
      avgGrade: 20,
      disciplinaryEvents: 5,
      familySupportScore: 1,
    });
    ai.registerStudent({
      studentId: 's2',
      schoolLevel: 'high',
      attendanceRate: 98,
      avgGrade: 95,
      disciplinaryEvents: 0,
      familySupportScore: 9,
    });
    expect(ai.listAtRisk('high').length).toBe(1);
  });

  it('학교급별 카운트를 반환한다', () => {
    ai.registerStudent({
      studentId: 's1',
      schoolLevel: 'elementary',
      attendanceRate: 90,
      avgGrade: 80,
      disciplinaryEvents: 0,
      familySupportScore: 7,
    });
    ai.registerStudent({
      studentId: 's2',
      schoolLevel: 'middle',
      attendanceRate: 90,
      avgGrade: 80,
      disciplinaryEvents: 0,
      familySupportScore: 7,
    });
    const counts = ai.countByLevel();
    expect(counts.elementary).toBe(1);
    expect(counts.middle).toBe(1);
    expect(counts.high).toBe(0);
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerStudent(
        {
          studentId: 's1',
          schoolLevel: 'middle',
          attendanceRate: 90,
          avgGrade: 80,
          disciplinaryEvents: 0,
          familySupportScore: 7,
        },
        'S',
      ),
    ).toThrow('BLOCKED');
  });
});
