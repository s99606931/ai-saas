import { describe, it, expect, beforeEach } from 'vitest';
import { MentalHealthTriageAI, type TriageInput } from '../ai-mental-health-triage';

const input = (ref: string, over: Partial<TriageInput> = {}): TriageInput => ({
  caseRef: ref,
  depressionScore: 5,
  anxietyScore: 4,
  sleepIssueScore: 2,
  suicidalIdeation: 0,
  functionalImpairment: 1,
  supportSystemScore: 7,
  ...over,
});

describe('MentalHealthTriageAI', () => {
  let ai: MentalHealthTriageAI;

  beforeEach(() => {
    ai = new MentalHealthTriageAI();
  });

  it('경증은 routine 분류', () => {
    const r = ai.submit(input('c001'));
    expect(r.urgency).toBe('routine');
    expect(r.referralLevel).toBe('self-help');
  });

  it('자살 계획은 emergency 분류', () => {
    const r = ai.submit(
      input('c002', { suicidalIdeation: 3, depressionScore: 20, anxietyScore: 15 }),
    );
    expect(r.urgency).toBe('emergency');
    expect(r.referralLevel).toBe('hospitalization');
  });

  it('중등도 우울은 priority', () => {
    const r = ai.submit(
      input('c003', { depressionScore: 15, anxietyScore: 10, functionalImpairment: 2 }),
    );
    expect(['priority', 'urgent']).toContain(r.urgency);
  });

  it('입력 검증 실패', () => {
    expect(() => ai.submit(input('c004', { depressionScore: 99 }))).toThrow();
  });

  it('긴급도 집계', () => {
    ai.submit(input('c100'));
    ai.submit(input('c101', { suicidalIdeation: 3 }));
    const s = ai.summarize();
    expect(s.routine + s.emergency + s.urgent + s.priority).toBe(2);
  });

  it('C등급 차단', () => {
    expect(() => ai.submit(input('c005'), 'C')).toThrow('BLOCKED');
  });
});
