import { describe, it, expect, beforeEach } from 'vitest';
import { GovernmentInnovationLabAI } from '../government-innovation-lab-ai';

describe('GovernmentInnovationLabAI', () => {
  let ai: GovernmentInnovationLabAI;

  beforeEach(() => {
    ai = new GovernmentInnovationLabAI();
  });

  it('아이디어를 제출한다', () => {
    ai.submitIdea({
      ideaId: 'i1',
      title: 'AI 민원 분류',
      category: 'citizen_service',
      feasibility: 8,
      impact: 9,
      cost: 3,
      stakeholderSupport: 8,
    });
    expect(ai.listByCategory('citizen_service').length).toBe(1);
  });

  it('우선순위를 평가한다', () => {
    ai.submitIdea({
      ideaId: 'i1',
      title: 'A',
      category: 'policy_design',
      feasibility: 9,
      impact: 9,
      cost: 2,
      stakeholderSupport: 9,
    });
    const p = ai.prioritize('i1');
    expect(p.recommendation).toBe('pilot');
    expect(p.priorityScore).toBeGreaterThan(80);
  });

  it('낮은 점수는 reject로 분류한다', () => {
    ai.submitIdea({
      ideaId: 'i2',
      title: 'B',
      category: 'digital_transformation',
      feasibility: 2,
      impact: 2,
      cost: 9,
      stakeholderSupport: 2,
    });
    const p = ai.prioritize('i2');
    expect(p.recommendation).toBe('reject');
  });

  it('상위 아이디어를 반환한다', () => {
    ai.submitIdea({
      ideaId: 'a',
      title: 'A',
      category: 'policy_design',
      feasibility: 9,
      impact: 9,
      cost: 2,
      stakeholderSupport: 9,
    });
    ai.submitIdea({
      ideaId: 'b',
      title: 'B',
      category: 'policy_design',
      feasibility: 3,
      impact: 3,
      cost: 8,
      stakeholderSupport: 3,
    });
    const top = ai.topIdeas(2);
    expect(top[0]?.ideaId).toBe('a');
  });

  it('추천별 분포를 집계한다', () => {
    ai.submitIdea({
      ideaId: 'a',
      title: 'A',
      category: 'participation',
      feasibility: 9,
      impact: 9,
      cost: 2,
      stakeholderSupport: 9,
    });
    const counts = ai.countByRecommendation();
    expect(counts.pilot).toBe(1);
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() =>
      ai.submitIdea(
        {
          ideaId: 'x',
          title: 'x',
          category: 'administrative_efficiency',
          feasibility: 5,
          impact: 5,
          cost: 5,
          stakeholderSupport: 5,
        },
        'S',
      ),
    ).toThrow('BLOCKED');
  });
});
