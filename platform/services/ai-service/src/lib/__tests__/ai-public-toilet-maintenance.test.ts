import { describe, it, expect, beforeEach } from 'vitest';
import { AIPublicToiletMaintenance } from '../ai-public-toilet-maintenance';

describe('AIPublicToiletMaintenance', () => {
  let ai: AIPublicToiletMaintenance;

  beforeEach(() => {
    ai = new AIPublicToiletMaintenance();
  });

  it('시설을 등록한다', () => {
    ai.register({
      facilityId: 'T1',
      name: '중앙공원',
      stallCount: 6,
      avgDailyUsers: 300,
      lastCleanedAt: '2026-04-13T08:00:00Z',
      openHours: 24,
    });
    expect(ai.listFacilities()).toHaveLength(1);
  });

  it('청결도 낮음 + 민원 다수 시 immediate 수준', () => {
    ai.register({
      facilityId: 'T2',
      name: '지하철역',
      stallCount: 8,
      avgDailyUsers: 500,
      lastCleanedAt: '2026-04-13T06:00:00Z',
      openHours: 20,
    });
    ai.recordSignal({
      facilityId: 'T2',
      timestamp: '2026-04-13T12:00:00Z',
      usersSinceClean: 400,
      complaintCount: 5,
      sensorCleanlinessScore: 30,
    });
    const tasks = ai.plan();
    const target = tasks.find((t) => t.facilityId === 'T2')!;
    expect(target.urgency).toBe('immediate');
  });

  it('센서 데이터 없으면 routine 수준', () => {
    ai.register({
      facilityId: 'T3',
      name: '시청',
      stallCount: 4,
      avgDailyUsers: 100,
      lastCleanedAt: '2026-04-13T08:00:00Z',
      openHours: 10,
    });
    const tasks = ai.plan();
    expect(tasks[0]?.urgency).toBe('routine');
  });

  it('stallCount 기반 작업 시간 산정', () => {
    ai.register({
      facilityId: 'T4',
      name: '대형공원',
      stallCount: 12,
      avgDailyUsers: 400,
      lastCleanedAt: '2026-04-13T08:00:00Z',
      openHours: 24,
    });
    const tasks = ai.plan();
    expect(tasks[0]?.estimatedMinutes).toBeGreaterThanOrEqual(60);
  });

  it('우선순위 정렬이 된다', () => {
    ai.register({ facilityId: 'A', name: 'A', stallCount: 4, avgDailyUsers: 100, lastCleanedAt: '', openHours: 10 });
    ai.register({ facilityId: 'B', name: 'B', stallCount: 4, avgDailyUsers: 100, lastCleanedAt: '', openHours: 10 });
    ai.recordSignal({ facilityId: 'B', timestamp: '2026-04-13T12:00:00Z', usersSinceClean: 300, complaintCount: 5, sensorCleanlinessScore: 20 });
    const tasks = ai.plan();
    expect(tasks[0]?.facilityId).toBe('B');
  });

  it('센서 점수 범위 초과 시 오류', () => {
    expect(() =>
      ai.recordSignal({
        facilityId: 'X',
        timestamp: '2026-04-13T12:00:00Z',
        usersSinceClean: 0,
        complaintCount: 0,
        sensorCleanlinessScore: 200,
      }),
    ).toThrow();
  });
});
