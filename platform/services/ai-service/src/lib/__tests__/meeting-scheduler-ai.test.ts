import { describe, it, expect } from 'vitest';
import { MeetingSchedulerAI } from '../meeting-scheduler-ai.js';

describe('SVC-AI-ADV-R395 MeetingSchedulerAI', () => {
  it('FR-385.1: 가용성 + 선호도 기반 슬롯 점수 계산', () => {
    const svc = new MeetingSchedulerAI();
    const result = svc.recommend(
      [
        { id: 'a', availableSlots: [1, 2], preferredSlots: [1] },
        { id: 'b', availableSlots: [1, 3], preferredSlots: [1] },
      ],
      { capacity: 5 },
      [1, 2, 3],
    );
    expect(result[0]?.slot).toBe(1);
    // slot 1: avail=2/2=1, pref=2/2=1, fit=1 → 0.5+0.3+0.2=1.0
    expect(result[0]?.score).toBeCloseTo(1.0, 3);
  });

  it('FR-385.2: 상위 3개 반환', () => {
    const svc = new MeetingSchedulerAI();
    const result = svc.recommend(
      [{ id: 'a', availableSlots: [1, 2, 3, 4], preferredSlots: [] }],
      { capacity: 5 },
      [1, 2, 3, 4, 5],
    );
    expect(result.length).toBe(3);
  });

  it('FR-385.3: S등급 차단', () => {
    const svc = new MeetingSchedulerAI();
    expect(() =>
      svc.recommend([{ id: 'a', availableSlots: [1], preferredSlots: [] }], { capacity: 5 }, [1], 'S'),
    ).toThrow('N2SF_BLOCKED');
  });

  it('FR-385.4: 감사 로그', () => {
    const svc = new MeetingSchedulerAI();
    svc.recommend([{ id: 'a', availableSlots: [1], preferredSlots: [] }], { capacity: 5 }, [1]);
    expect(svc.getAuditLog().length).toBe(1);
  });

  it('회의실 초과 시 roomFit=0', () => {
    const svc = new MeetingSchedulerAI();
    const result = svc.recommend(
      [
        { id: 'a', availableSlots: [1], preferredSlots: [1] },
        { id: 'b', availableSlots: [1], preferredSlots: [1] },
      ],
      { capacity: 1 },
      [1],
    );
    expect(result[0]?.roomFit).toBe(0);
    expect(result[0]?.score).toBeCloseTo(1 * 0.5 + 1 * 0.3 + 0, 3);
  });

  it('빈 입력 처리', () => {
    const svc = new MeetingSchedulerAI();
    expect(svc.recommend([], { capacity: 5 }, [1])).toEqual([]);
  });
});
