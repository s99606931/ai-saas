import { describe, it, expect, beforeEach } from 'vitest';
import { LifelongEducationMatcherAI } from '../lifelong-education-matcher-ai';

describe('LifelongEducationMatcherAI', () => {
  let ai: LifelongEducationMatcherAI;

  beforeEach(() => {
    ai = new LifelongEducationMatcherAI();
    ai.registerLearner({
      learnerId: 'L1',
      ageRange: '40s',
      interests: ['프로그래밍', '디자인'],
      region: 'seoul',
      level: 'beginner',
    });
    ai.registerCourse({
      courseId: 'C1',
      title: 'Python 입문',
      topics: ['프로그래밍'],
      region: 'seoul',
      level: 'beginner',
      capacity: 20,
      enrolled: 0,
    });
    ai.registerCourse({
      courseId: 'C2',
      title: '고급 UX 디자인',
      topics: ['디자인'],
      region: 'busan',
      level: 'advanced',
      capacity: 15,
      enrolled: 0,
    });
  });

  it('학습자와 강좌를 등록한다', () => {
    expect(ai.listCourses().length).toBe(2);
  });

  it('관심사 기반으로 강좌를 추천한다', () => {
    const recs = ai.recommend('L1');
    expect(recs.length).toBe(2);
    expect(recs[0]!.courseId).toBe('C1'); // region+level+interest 모두 일치
  });

  it('정원 초과 강좌는 제외한다', () => {
    ai.registerCourse({
      courseId: 'C3',
      title: '꽉찬 강좌',
      topics: ['프로그래밍'],
      region: 'seoul',
      level: 'beginner',
      capacity: 1,
      enrolled: 1,
    });
    const recs = ai.recommend('L1');
    expect(recs.find(r => r.courseId === 'C3')).toBeUndefined();
  });

  it('수강 신청 시 등록 인원이 증가한다', () => {
    ai.enroll('L1', 'C1');
    const courses = ai.listCourses();
    const c1 = courses.find(c => c.courseId === 'C1');
    expect(c1?.enrolled).toBe(1);
  });

  it('정원 초과 수강은 거부한다', () => {
    ai.registerCourse({
      courseId: 'C9',
      title: '풀강좌',
      topics: ['x'],
      region: 'r',
      level: 'beginner',
      capacity: 1,
      enrolled: 1,
    });
    expect(() => ai.enroll('L1', 'C9')).toThrow('정원 초과');
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerLearner(
        {
          learnerId: 'L9',
          ageRange: '20s',
          interests: ['x'],
          region: 'r',
          level: 'beginner',
        },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
