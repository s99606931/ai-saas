import { describe, it, expect, beforeEach } from 'vitest';
import { PassportRenewalPriorityAI } from '../passport-renewal-priority-ai';

describe('PassportRenewalPriorityAI', () => {
  let ai: PassportRenewalPriorityAI;

  beforeEach(() => {
    ai = new PassportRenewalPriorityAI();
  });

  it('요청을 접수한다', () => {
    ai.submit({
      requestId: 'r1',
      daysUntilExpiry: 30,
      daysUntilDeparture: 60,
      purposeCategory: 'leisure',
      firstTimeApplicant: false,
    });
    expect(ai.count()).toBe(1);
  });

  it('긴급 요청을 가속 처리한다', () => {
    ai.submit({
      requestId: 'r1',
      daysUntilExpiry: -5,
      daysUntilDeparture: 3,
      purposeCategory: 'emergency',
      firstTimeApplicant: false,
    });
    const r = ai.score('r1');
    expect(r.tier).toBe('expedited');
    expect(r.etaBusinessDays).toBe(2);
  });

  it('여유 있는 요청을 일반 처리한다', () => {
    ai.submit({
      requestId: 'r1',
      daysUntilExpiry: 365,
      daysUntilDeparture: 180,
      purposeCategory: 'leisure',
      firstTimeApplicant: false,
    });
    expect(ai.score('r1').tier).toBe('low');
  });

  it('의료 목적에 가산점을 부여한다', () => {
    ai.submit({
      requestId: 'r1',
      daysUntilExpiry: 60,
      daysUntilDeparture: 20,
      purposeCategory: 'medical',
      firstTimeApplicant: false,
    });
    const r = ai.score('r1');
    expect(r.priorityScore).toBeGreaterThanOrEqual(25);
  });

  it('티어별로 필터링한다', () => {
    ai.submit({
      requestId: 'r1',
      daysUntilExpiry: -1,
      daysUntilDeparture: 3,
      purposeCategory: 'emergency',
      firstTimeApplicant: true,
    });
    expect(ai.listByTier('expedited')).toContain('r1');
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.submit(
        {
          requestId: 'r1',
          daysUntilExpiry: 30,
          daysUntilDeparture: null,
          purposeCategory: 'leisure',
          firstTimeApplicant: false,
        },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
