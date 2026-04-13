import { describe, it, expect, beforeEach } from 'vitest';
import { YouthCounselingAIAdvisor } from '../youth-counseling-ai-advisor';

describe('YouthCounselingAIAdvisor', () => {
  let ai: YouthCounselingAIAdvisor;

  beforeEach(() => {
    ai = new YouthCounselingAIAdvisor();
  });

  it('세션을 등록한다', () => {
    ai.createSession({
      sessionId: 'S1',
      counseleeCode: 'ANON-001',
      ageGroup: '14-16',
      topics: ['school'],
      suicidalIdeation: false,
      selfHarmHistory: false,
      supportNetwork: 'strong',
      createdAt: '2026-04-13T10:00:00Z',
    });
    expect(ai.getSessionCount()).toBe(1);
  });

  it('자살 사고 세션은 critical로 분류한다', () => {
    ai.createSession({
      sessionId: 'S2',
      counseleeCode: 'ANON-002',
      ageGroup: '17-19',
      topics: ['mental_health'],
      suicidalIdeation: true,
      selfHarmHistory: true,
      supportNetwork: 'weak',
      createdAt: '2026-04-13T10:00:00Z',
    });
    const result = ai.triage('S2');
    expect(result.riskLevel).toBe('critical');
    expect(result.referralRequired).toBe(true);
    expect(result.recommendedActions.some(a => a.includes('1393'))).toBe(true);
  });

  it('실명이 포함된 익명 코드는 거부한다', () => {
    expect(() =>
      ai.createSession({
        sessionId: 'S3',
        counseleeCode: '홍길동',
        ageGroup: '14-16',
        topics: [],
        suicidalIdeation: false,
        selfHarmHistory: false,
        supportNetwork: 'strong',
        createdAt: '2026-04-13T10:00:00Z',
      }),
    ).toThrow('실명');
  });

  it('주제별 세션을 조회한다', () => {
    ai.createSession({
      sessionId: 'S4',
      counseleeCode: 'X1',
      ageGroup: '10-13',
      topics: ['bullying', 'school'],
      suicidalIdeation: false,
      selfHarmHistory: false,
      supportNetwork: 'moderate',
      createdAt: '2026-04-13T10:00:00Z',
    });
    expect(ai.getSessionsByTopic('bullying').length).toBe(1);
  });

  it('위기 세션 목록을 반환한다', () => {
    ai.createSession({
      sessionId: 'S5',
      counseleeCode: 'X2',
      ageGroup: '14-16',
      topics: ['mental_health', 'bullying'],
      suicidalIdeation: true,
      selfHarmHistory: false,
      supportNetwork: 'none',
      createdAt: '2026-04-13T10:00:00Z',
    });
    const critical = ai.listCriticalSessions();
    expect(critical.length).toBe(1);
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.createSession(
        {
          sessionId: 'X',
          counseleeCode: 'A1',
          ageGroup: '14-16',
          topics: [],
          suicidalIdeation: false,
          selfHarmHistory: false,
          supportNetwork: 'strong',
          createdAt: '2026-04-13T10:00:00Z',
        },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
