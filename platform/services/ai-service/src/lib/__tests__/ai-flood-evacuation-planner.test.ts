import { describe, it, expect, beforeEach } from 'vitest';
import { AIFloodEvacuationPlanner } from '../ai-flood-evacuation-planner';

describe('AIFloodEvacuationPlanner', () => {
  let ai: AIFloodEvacuationPlanner;

  beforeEach(() => {
    ai = new AIFloodEvacuationPlanner();
    ai.registerZone({
      zoneId: 'Z1',
      name: '한강변1',
      population: 1000,
      elevationM: 10,
      nearestShelterId: 'S1',
    });
    ai.registerShelter({
      shelterId: 'S1',
      name: '공립체육관',
      capacity: 2000,
      elevationM: 20,
      availableSlots: 1500,
    });
  });

  it('정상 수위는 normal로 분류한다', () => {
    ai.updateWaterLevel({
      zoneId: 'Z1',
      currentLevelM: 9.5,
      riverLevelM: 8,
      rainfallMmPerHour: 5,
      readingTime: '2026-04-13T08:00:00Z',
    });
    expect(ai.classifyLevel('Z1')).toBe('normal');
  });

  it('긴급 수준에서 전 주민 대피 계획을 수립한다', () => {
    ai.updateWaterLevel({
      zoneId: 'Z1',
      currentLevelM: 12.0,
      riverLevelM: 11,
      rainfallMmPerHour: 100,
      readingTime: '2026-04-13T09:00:00Z',
    });
    const plan = ai.planEvacuation('Z1');
    expect(plan.level).toBe('emergency');
    expect(plan.peopleToEvacuate).toBe(1000);
    expect(plan.recommendedShelterId).toBe('S1');
  });

  it('경계 수준에서 60% 주민 대피 계획을 수립한다', () => {
    ai.updateWaterLevel({
      zoneId: 'Z1',
      currentLevelM: 10.9,
      riverLevelM: 10,
      rainfallMmPerHour: 55,
      readingTime: '2026-04-13T10:00:00Z',
    });
    const plan = ai.planEvacuation('Z1');
    expect(plan.level).toBe('warning');
    expect(plan.peopleToEvacuate).toBe(600);
  });

  it('대피소 포화 시 경고 메시지를 포함한다', () => {
    const ai2 = new AIFloodEvacuationPlanner();
    ai2.registerZone({
      zoneId: 'Z2',
      name: '저지대',
      population: 500,
      elevationM: 5,
      nearestShelterId: 'FULL',
    });
    ai2.registerShelter({
      shelterId: 'FULL',
      name: '포화대피소',
      capacity: 100,
      elevationM: 6,
      availableSlots: 0,
    });
    ai2.updateWaterLevel({
      zoneId: 'Z2',
      currentLevelM: 7.0,
      riverLevelM: 6,
      rainfallMmPerHour: 100,
      readingTime: '2026-04-13T11:00:00Z',
    });
    const plan = ai2.planEvacuation('Z2');
    expect(plan.recommendedShelterId).toBeNull();
    expect(plan.instructions.some(i => i.includes('포화'))).toBe(true);
  });

  it('감사 로그를 기록한다', () => {
    ai.updateWaterLevel({
      zoneId: 'Z1',
      currentLevelM: 10.5,
      riverLevelM: 10,
      rainfallMmPerHour: 35,
      readingTime: '2026-04-13T12:00:00Z',
    });
    ai.planEvacuation('Z1');
    expect(ai.getAuditLog().some(l => l.action === 'PLAN_EVACUATION')).toBe(true);
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.updateWaterLevel(
        {
          zoneId: 'Z1',
          currentLevelM: 5,
          riverLevelM: 4,
          rainfallMmPerHour: 1,
          readingTime: '2026-04-13T12:00:00Z',
        },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
