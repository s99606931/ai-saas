import { describe, it, expect, beforeEach } from 'vitest';
import { AISeniorCareCoordinator } from '../ai-senior-care-coordinator';

describe('AISeniorCareCoordinator', () => {
  let ai: AISeniorCareCoordinator;

  beforeEach(() => {
    ai = new AISeniorCareCoordinator();
  });

  it('어르신 프로필을 등록한다', () => {
    ai.registerSenior({
      seniorId: 's1',
      age: 75,
      livingAlone: true,
      chronicDiseaseCount: 2,
      mobilityScore: 60,
      region: '서울-강남',
    });
    expect(ai.getAuditLog().some(l => l.action === 'REGISTER_SENIOR')).toBe(true);
  });

  it('공급자를 등록한다', () => {
    ai.registerProvider({
      providerId: 'v1',
      categories: ['medical', 'meal'],
      region: '서울-강남',
      capacity: 10,
      currentLoad: 3,
    });
    expect(ai.listProviders('서울-강남').length).toBe(1);
  });

  it('돌봄 계획을 생성한다', () => {
    ai.registerSenior({
      seniorId: 's1',
      age: 82,
      livingAlone: true,
      chronicDiseaseCount: 3,
      mobilityScore: 30,
      region: '부산',
    });
    ai.registerProvider({
      providerId: 'v1',
      categories: ['medical', 'mobility'],
      region: '부산',
      capacity: 5,
      currentLoad: 1,
    });
    const plan = ai.createPlan('s1');
    expect(plan.urgency).toBe('critical');
    expect(plan.recommendedCategories).toContain('medical');
    expect(plan.matchedProviders).toContain('v1');
  });

  it('공급자에 할당하여 부하를 증가시킨다', () => {
    ai.registerProvider({
      providerId: 'v1',
      categories: ['meal'],
      region: '인천',
      capacity: 2,
      currentLoad: 0,
    });
    ai.assignProvider('v1');
    expect(ai.listProviders('인천')[0]?.currentLoad).toBe(1);
  });

  it('용량 초과 시 할당을 거부한다', () => {
    ai.registerProvider({
      providerId: 'v1',
      categories: ['meal'],
      region: '대구',
      capacity: 1,
      currentLoad: 1,
    });
    expect(() => ai.assignProvider('v1')).toThrow('용량 초과');
  });

  it('60세 미만은 등록을 거부한다', () => {
    expect(() =>
      ai.registerSenior({
        seniorId: 's1',
        age: 50,
        livingAlone: false,
        chronicDiseaseCount: 0,
        mobilityScore: 90,
        region: '제주',
      }),
    ).toThrow('60세');
  });
});
