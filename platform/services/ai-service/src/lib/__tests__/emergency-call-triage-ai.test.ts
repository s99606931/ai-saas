import { describe, it, expect, beforeEach } from 'vitest';
import { EmergencyCallTriageAI } from '../emergency-call-triage-ai';

describe('EmergencyCallTriageAI', () => {
  let ai: EmergencyCallTriageAI;

  beforeEach(() => {
    ai = new EmergencyCallTriageAI();
  });

  it('심정지 키워드를 P0로 분류한다', () => {
    const r = ai.triage({
      callId: 'C1',
      serviceLine: '119',
      transcript: '환자 심정지 상태, 응급상황',
      locationKnown: true,
    });
    expect(r.priority).toBe('P0');
    expect(r.dispatch).toContain('ambulance');
  });

  it('화재 키워드는 119 소방 출동을 생성한다', () => {
    const r = ai.triage({
      callId: 'C2',
      serviceLine: '119',
      transcript: '건물에 화재 발생',
      locationKnown: true,
    });
    expect(r.dispatch).toContain('fire');
    expect(r.priority).toBe('P1');
  });

  it('112 흉기 키워드는 경찰 출동을 생성한다', () => {
    const r = ai.triage({
      callId: 'C3',
      serviceLine: '112',
      transcript: '흉기를 든 사람 발견',
      locationKnown: true,
    });
    expect(r.priority).toBe('P0');
    expect(r.dispatch).toContain('police');
  });

  it('위치 미확인 + 고위험은 우선순위가 P0로 상승한다', () => {
    const r = ai.triage({
      callId: 'C4',
      serviceLine: '119',
      transcript: '교통사고 출혈 환자',
      locationKnown: false,
    });
    expect(r.priority).toBe('P0');
  });

  it('경미한 사건은 P2 advisory로 분류한다', () => {
    const r = ai.triage({
      callId: 'C5',
      serviceLine: '112',
      transcript: '경미한 분실 신고',
      locationKnown: true,
    });
    expect(r.priority).toBe('P2');
  });

  it('빈 transcript는 오류를 던진다', () => {
    expect(() =>
      ai.triage({ callId: 'C6', serviceLine: '119', transcript: '', locationKnown: true }),
    ).toThrow();
  });
});
