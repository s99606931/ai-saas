import { describe, it, expect, beforeEach } from 'vitest';
import { AIDisasterVolunteerCoordinator } from '../ai-disaster-volunteer-coordinator';

describe('AIDisasterVolunteerCoordinator', () => {
  let ai: AIDisasterVolunteerCoordinator;

  beforeEach(() => {
    ai = new AIDisasterVolunteerCoordinator();
  });

  it('봉사자와 업무를 등록한다', () => {
    ai.registerVolunteer({ volunteerId: 'v1', skills: ['medical'], regionCode: 'R1', availableHours: 8 });
    ai.registerTask({
      taskId: 't1',
      disasterType: 'flood',
      regionCode: 'R1',
      requiredSkills: ['medical'],
      requiredVolunteers: 1,
      estimatedHours: 4,
    });
    expect(ai.listTasks().length).toBe(1);
  });

  it('업무에 봉사자를 할당한다', () => {
    ai.registerVolunteer({ volunteerId: 'v1', skills: ['medical', 'logistics'], regionCode: 'R1', availableHours: 10 });
    ai.registerVolunteer({ volunteerId: 'v2', skills: ['medical'], regionCode: 'R2', availableHours: 10 });
    ai.registerTask({
      taskId: 't1',
      disasterType: 'earthquake',
      regionCode: 'R1',
      requiredSkills: ['medical'],
      requiredVolunteers: 1,
      estimatedHours: 5,
    });
    const a = ai.assign('t1');
    expect(a.volunteerIds[0]).toBe('v1');
    expect(a.coverageRate).toBe(100);
  });

  it('가용 시간 부족 봉사자는 제외한다', () => {
    ai.registerVolunteer({ volunteerId: 'v1', skills: ['medical'], regionCode: 'R1', availableHours: 2 });
    ai.registerTask({
      taskId: 't1',
      disasterType: 'fire',
      regionCode: 'R1',
      requiredSkills: ['medical'],
      requiredVolunteers: 1,
      estimatedHours: 8,
    });
    const a = ai.assign('t1');
    expect(a.coverageRate).toBe(0);
  });

  it('스킬별 봉사자 수를 집계한다', () => {
    ai.registerVolunteer({ volunteerId: 'v1', skills: ['medical', 'logistics'], regionCode: 'R1', availableHours: 5 });
    ai.registerVolunteer({ volunteerId: 'v2', skills: ['search_rescue'], regionCode: 'R1', availableHours: 5 });
    const c = ai.countBySkill();
    expect(c.medical).toBe(1);
    expect(c.logistics).toBe(1);
    expect(c.search_rescue).toBe(1);
  });

  it('재난 타입별 업무를 필터링한다', () => {
    ai.registerTask({
      taskId: 't1',
      disasterType: 'typhoon',
      regionCode: 'R1',
      requiredSkills: ['logistics'],
      requiredVolunteers: 2,
      estimatedHours: 4,
    });
    expect(ai.listTasks('typhoon').length).toBe(1);
    expect(ai.listTasks('snow').length).toBe(0);
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerVolunteer(
        { volunteerId: 'v1', skills: ['medical'], regionCode: 'R1', availableHours: 5 },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
