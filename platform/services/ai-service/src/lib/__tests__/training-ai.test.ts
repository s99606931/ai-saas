import { describe, it, expect } from 'vitest';
import { TrainingAI, type CompetencyDomain, type Assessment, type LearningCourse } from '../training-ai';

describe('TrainingAI', () => {
  const ai = new TrainingAI();
  const domains: CompetencyDomain[] = [
    { id: 'sec', name: '정보보안', targetLevel: 4 },
    { id: 'data', name: '데이터분석', targetLevel: 3 },
  ];
  const catalog: LearningCourse[] = [
    { id: 'sec-101', title: '보안 기초', domainId: 'sec', levelFrom: 1, levelTo: 2, hours: 8 },
    { id: 'sec-201', title: '보안 중급', domainId: 'sec', levelFrom: 2, levelTo: 3, hours: 12 },
    { id: 'sec-301', title: '보안 고급', domainId: 'sec', levelFrom: 3, levelTo: 4, hours: 16 },
    { id: 'data-101', title: '데이터 기초', domainId: 'data', levelFrom: 1, levelTo: 2, hours: 6 },
    { id: 'data-201', title: '데이터 중급', domainId: 'data', levelFrom: 2, levelTo: 3, hours: 10 },
  ];

  const assess: Assessment = {
    userId: 'u1',
    domainScores: {
      sec: { selfScore: 40, testScore: 40 },
      data: { selfScore: 20, testScore: 20 },
    },
    assessedAt: new Date().toISOString(),
  };

  it('diagnoses competency gap', () => {
    const d = ai.diagnose(assess, domains);
    expect(d).toHaveLength(2);
    const sec = d.find((x) => x.domainId === 'sec')!;
    expect(sec.gap).toBeGreaterThan(0);
  });

  it('recommends learning path', () => {
    const d = ai.diagnose(assess, domains);
    const path = ai.recommendPath('u1', d, catalog);
    expect(path.courses.length).toBeGreaterThan(0);
    expect(path.estimatedHours).toBeGreaterThan(0);
  });

  it('tracks progress', () => {
    const p = ai.updateProgress([], {
      userId: 'u1',
      courseId: 'sec-101',
      progress: 1,
      passed: true,
      completedAt: new Date().toISOString(),
    });
    expect(p).toHaveLength(1);
    expect(p[0]!.passed).toBe(true);
  });

  it('verifies completion requirements', () => {
    const d = ai.diagnose(assess, domains);
    const path = ai.recommendPath('u1', d, catalog);
    const progress = path.courses.map((c) => ({
      userId: 'u1',
      courseId: c.courseId,
      progress: 1,
      passed: true,
    }));
    const result = ai.verifyCompletion('u1', path, progress, catalog);
    expect(result.meetsRequirements).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('measures improvement', () => {
    const after: Assessment = {
      ...assess,
      domainScores: {
        sec: { selfScore: 80, testScore: 80 },
        data: { selfScore: 60, testScore: 60 },
      },
    };
    const imp = ai.measureImprovement(assess, after, domains);
    expect(imp.find((x) => x.domainId === 'sec')!.delta).toBeGreaterThan(0);
  });
});
