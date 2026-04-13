import { describe, it, expect, beforeEach } from 'vitest';
import { IntegratedComplaintCenterAi } from '../integrated-complaint-center-ai';

describe('IntegratedComplaintCenterAi', () => {
  let ai: IntegratedComplaintCenterAi;

  beforeEach(() => {
    ai = new IntegratedComplaintCenterAi();
  });

  it('세금 키워드는 tax_dept로 라우팅한다', () => {
    const result = ai.route({
      ticketId: 't-1',
      channel: 'web',
      subject: '재산세 고지서 문의',
      receivedAt: '2026-04-13T00:00:00.000Z',
    });
    expect(result.assignedDepartment).toBe('tax_dept');
  });

  it('방문 채널은 P1 우선순위이다', () => {
    const result = ai.route({
      ticketId: 't-2',
      channel: 'visit',
      subject: '건축 인허가',
      receivedAt: '2026-04-13T00:00:00.000Z',
    });
    expect(result.priority).toBe('P1');
  });

  it('알 수 없는 주제는 general_dept이다', () => {
    const result = ai.route({
      ticketId: 't-3',
      channel: 'web',
      subject: '안녕하세요 일반 문의',
      receivedAt: '2026-04-13T00:00:00.000Z',
    });
    expect(result.assignedDepartment).toBe('general_dept');
  });

  it('부서 부하 설정 후 처리시간 증가한다', () => {
    ai.setLoad({ department: 'urban_dept', openTickets: 10, avgHandleMinutes: 60 });
    const result = ai.route({
      ticketId: 't-4',
      channel: 'web',
      subject: '도시계획 변경 요청',
      receivedAt: '2026-04-13T00:00:00.000Z',
    });
    expect(result.estimatedHandleMinutes).toBe(60 + 50);
  });

  it('총 대기 부하를 합산한다', () => {
    ai.setLoad({ department: 'tax_dept', openTickets: 5, avgHandleMinutes: 20 });
    ai.setLoad({ department: 'welfare_dept', openTickets: 7, avgHandleMinutes: 25 });
    expect(ai.totalQueueLoad()).toBe(12);
  });

  it('C등급 데이터는 차단된다', () => {
    expect(() =>
      ai.route(
        { ticketId: 't', channel: 'web', subject: 's', receivedAt: '2026-04-13T00:00:00.000Z' },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
