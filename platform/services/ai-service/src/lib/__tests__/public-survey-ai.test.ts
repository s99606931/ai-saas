import { describe, it, expect } from 'vitest';
import { PublicSurveyAI, type SurveyResponse } from '../public-survey-ai';

describe('PublicSurveyAI', () => {
  const ai = new PublicSurveyAI();

  it('generates questions from purpose', () => {
    const draft = ai.generateQuestions({ purpose: '민원 서비스', audience: '시민' });
    expect(draft.questions.length).toBeGreaterThanOrEqual(5);
    expect(draft.title).toContain('민원 서비스');
    expect(draft.estimatedMinutes).toBeGreaterThan(0);
  });

  it('aggregates completion rate', () => {
    const draft = ai.generateQuestions({ purpose: '테스트', audience: '공무원', maxQuestions: 6 });
    const responses: SurveyResponse[] = [
      {
        responseId: 'R1',
        surveyId: draft.surveyId,
        respondentHash: 'a',
        answers: { Q1: 5, Q2: 4, Q3: 3 },
        submittedAt: new Date().toISOString(),
      },
      {
        responseId: 'R2',
        surveyId: draft.surveyId,
        respondentHash: 'b',
        answers: { Q1: 2 },
        submittedAt: new Date().toISOString(),
      },
    ];
    const agg = ai.aggregate(draft, responses);
    expect(agg.totalResponses).toBe(2);
    expect(agg.completionRate).toBeCloseTo(0.5);
    const q1 = agg.perQuestion.find((q) => q.questionId === 'Q1');
    expect(q1?.mean).toBeDefined();
  });

  it('analyzes freetext sentiment', () => {
    const insight = ai.analyzeFreetext('Q6', [
      '서비스가 매우 편리하고 만족합니다',
      '속도가 느리고 오류가 많아 불만입니다',
      '보통입니다',
    ]);
    expect(insight.sentimentDistribution.positive).toBeGreaterThan(0);
    expect(insight.sentimentDistribution.negative).toBeGreaterThan(0);
    expect(insight.topTopics.length).toBeGreaterThan(0);
  });

  it('detects duplicate bias', () => {
    const responses: SurveyResponse[] = Array.from({ length: 4 }, (_, i) => ({
      responseId: `D${i}`,
      surveyId: 'SV',
      respondentHash: `h${i}`,
      ipHash: 'SAMEIP',
      answers: { Q1: 5, Q2: 5, Q3: 5 },
      submittedAt: new Date().toISOString(),
    }));
    const findings = ai.detectBias(responses);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.severity).toBe('high');
  });

  it('builds public report', () => {
    const draft = ai.generateQuestions({ purpose: '서비스', audience: '시민', maxQuestions: 4 });
    const responses: SurveyResponse[] = [
      {
        responseId: 'A',
        surveyId: draft.surveyId,
        respondentHash: 'a',
        answers: { Q1: 5, Q2: 4, Q3: 3, Q4: '매일' },
        submittedAt: new Date().toISOString(),
      },
    ];
    const agg = ai.aggregate(draft, responses);
    const report = ai.buildPublicReport(agg, []);
    expect(report).toContain('공개 리포트');
    expect(report).toContain('총 응답');
  });
});
