import { describe, it, expect } from 'vitest';
import { EducationSupportSystem } from '../education-support-system.js';

describe('SVC-AI-ADV-R443 EducationSupportSystem', () => {
  const svc = new EducationSupportSystem();

  it('FR-443.2: cohort 평균', () => {
    const r = svc.analyze([
      { id: 's1', scores: { math: 80, kor: 70 } },
      { id: 's2', scores: { math: 60, kor: 90 } },
    ]);
    expect(r.cohortAvg.math).toBe(70);
    expect(r.cohortAvg.kor).toBe(80);
  });

  it('FR-443.3: WEAK 탐지', () => {
    const r = svc.analyze([
      { id: 'a', scores: { math: 90 } },
      { id: 'b', scores: { math: 90 } },
      { id: 'c', scores: { math: 50 } },
    ]);
    const plan = r.plans.find((p) => p.id === 'c');
    expect(plan?.weakSubjects).toContain('math');
  });

  it('FR-443.4: 추천 생성', () => {
    const r = svc.analyze([
      { id: 'a', scores: { math: 90 } },
      { id: 'b', scores: { math: 90 } },
      { id: 'c', scores: { math: 50 } },
    ]);
    const plan = r.plans.find((p) => p.id === 'c');
    expect(plan?.recommendations[0]).toContain('math');
  });

  it('빈 입력', () => {
    const r = svc.analyze([]);
    expect(r.plans).toEqual([]);
  });

  it('점수 범위 오류', () => {
    expect(() =>
      svc.analyze([{ id: 'a', scores: { math: 200 } }]),
    ).toThrow('INVALID_SCORE');
  });

  it('FR-443.5: C 차단', () => {
    expect(() => svc.analyze([], 'C')).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.analyze([{ id: 'a', scores: { math: 80 } }]);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
