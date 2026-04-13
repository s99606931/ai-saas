import { describe, it, expect, beforeEach } from 'vitest';
import { VeteranServicePriorityAI } from '../veteran-service-priority-ai';

describe('VeteranServicePriorityAI', () => {
  let ai: VeteranServicePriorityAI;

  beforeEach(() => {
    ai = new VeteranServicePriorityAI();
  });

  it('보훈대상자와 요청을 등록한다', () => {
    ai.registerVeteran({
      veteranId: 'V1',
      category: 'independence',
      age: 90,
      disabilityRate: 80,
      hasSpouse: false,
      monthlyIncomeKRW: 1_000_000,
      registeredAt: '2026-04-13',
    });
    ai.submitRequest({
      requestId: 'R1',
      veteranId: 'V1',
      serviceType: 'medical',
      submittedAt: '2026-04-13T10:00:00Z',
    });
    expect(ai.computePriority('R1')).toBeGreaterThan(80);
  });

  it('독립유공자 의료 요청이 최상위 우선순위를 가진다', () => {
    ai.registerVeteran({
      veteranId: 'V1',
      category: 'independence',
      age: 95,
      disabilityRate: 90,
      hasSpouse: false,
      monthlyIncomeKRW: 800_000,
      registeredAt: '2026-04-13',
    });
    ai.registerVeteran({
      veteranId: 'V2',
      category: 'reserve',
      age: 45,
      disabilityRate: 0,
      hasSpouse: true,
      monthlyIncomeKRW: 4_000_000,
      registeredAt: '2026-04-13',
    });
    ai.submitRequest({
      requestId: 'R1',
      veteranId: 'V1',
      serviceType: 'medical',
      submittedAt: '2026-04-13T10:00:00Z',
    });
    ai.submitRequest({
      requestId: 'R2',
      veteranId: 'V2',
      serviceType: 'medical',
      submittedAt: '2026-04-13T10:00:00Z',
    });
    const queue = ai.getPrioritizedQueue();
    expect(queue[0]?.requestId).toBe('R1');
    expect(queue[0]?.rank).toBe(1);
  });

  it('서비스 유형별 필터링이 가능하다', () => {
    ai.registerVeteran({
      veteranId: 'V1',
      category: 'korean_war',
      age: 88,
      disabilityRate: 40,
      hasSpouse: false,
      monthlyIncomeKRW: 1_200_000,
      registeredAt: '2026-04-13',
    });
    ai.submitRequest({
      requestId: 'R1',
      veteranId: 'V1',
      serviceType: 'housing',
      submittedAt: '2026-04-13T10:00:00Z',
    });
    ai.submitRequest({
      requestId: 'R2',
      veteranId: 'V1',
      serviceType: 'medical',
      submittedAt: '2026-04-13T10:00:00Z',
    });
    const medical = ai.getPrioritizedQueue('medical');
    expect(medical.length).toBe(1);
    expect(medical[0]?.requestId).toBe('R2');
  });

  it('유형별 인원을 집계한다', () => {
    ai.registerVeteran({
      veteranId: 'V1',
      category: 'korean_war',
      age: 88,
      disabilityRate: 40,
      hasSpouse: false,
      monthlyIncomeKRW: 1_200_000,
      registeredAt: '2026-04-13',
    });
    ai.registerVeteran({
      veteranId: 'V2',
      category: 'korean_war',
      age: 85,
      disabilityRate: 30,
      hasSpouse: true,
      monthlyIncomeKRW: 1_400_000,
      registeredAt: '2026-04-13',
    });
    expect(ai.countByCategory().korean_war).toBe(2);
  });

  it('미등록 요청은 에러를 던진다', () => {
    expect(() => ai.computePriority('NONE')).toThrow('요청 미등록');
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerVeteran(
        {
          veteranId: 'X',
          category: 'reserve',
          age: 40,
          disabilityRate: 0,
          hasSpouse: false,
          monthlyIncomeKRW: 0,
          registeredAt: '2026-04-13',
        },
        'S',
      ),
    ).toThrow('BLOCKED');
  });
});
