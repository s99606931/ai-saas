import { describe, it, expect, beforeEach } from 'vitest';
import { DrugAbusePreventionAI, type ScreeningInput } from '../drug-abuse-prevention-ai';

describe('DrugAbusePreventionAI', () => {
  let ai: DrugAbusePreventionAI;

  const base = (): ScreeningInput => ({
    screeningId: 'S1',
    ageGroup: 'adult',
    stressLevel: 1,
    socialIsolation: 1,
    peerInfluence: 1,
    pastUse: 0,
    mentalHealthScore: 1,
    priorRehab: false,
    prescribedOpioid: false,
    familyHistory: false,
  });

  beforeEach(() => {
    ai = new DrugAbusePreventionAI();
  });

  it('저위험 시 minimal', () => {
    const r = ai.screen(base());
    expect(r.riskTier).toBe('minimal');
  });

  it('모든 지표 높음 → severe', () => {
    const r = ai.screen({
      ...base(),
      stressLevel: 5,
      socialIsolation: 5,
      peerInfluence: 5,
      pastUse: 5,
      mentalHealthScore: 5,
      priorRehab: true,
    });
    expect(r.riskTier).toBe('severe');
    expect(r.urgentContact).toBe(true);
  });

  it('청소년 가중', () => {
    const adult = ai.screen({ ...base(), ageGroup: 'adult', stressLevel: 3, peerInfluence: 3 });
    const teen = ai.screen({ ...base(), ageGroup: 'teen', stressLevel: 3, peerInfluence: 3 });
    expect(teen.riskScore).toBeGreaterThan(adult.riskScore);
  });

  it('severe 시 즉시 상담 권고', () => {
    const r = ai.screen({
      ...base(),
      stressLevel: 5,
      socialIsolation: 5,
      peerInfluence: 5,
      pastUse: 5,
      mentalHealthScore: 5,
      priorRehab: true,
      familyHistory: true,
    });
    expect(r.riskTier).toBe('severe');
    expect(r.interventions).toContain('즉시 전문가 상담');
  });

  it('지표 범위 초과 오류', () => {
    expect(() => ai.screen({ ...base(), stressLevel: 6 })).toThrow();
  });

  it('감사 로그 SCREEN 기록', () => {
    ai.screen(base());
    expect(ai.getAuditLog().length).toBe(1);
  });
});
