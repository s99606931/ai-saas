// Test Ref: MTU-N463 §impact-assessment
import { describe, it, expect } from 'vitest';
import { AiImpactAssessor, classifyRisk, mandatoryControls } from '../src/index.js';

describe('classifyRisk — FR-AIA.2', () => {
  it('socical_scoring → unacceptable', () => {
    expect(classifyRisk('social_scoring')).toBe('unacceptable');
  });

  it('recruitment → high', () => {
    expect(classifyRisk('recruitment')).toBe('high');
  });

  it('chatbot → limited', () => {
    expect(classifyRisk('chatbot')).toBe('limited');
  });

  it('spam_filter → minimal', () => {
    expect(classifyRisk('spam_filter')).toBe('minimal');
  });
});

describe('mandatoryControls — FR-AIA.3', () => {
  it('high 위험은 9개 이상 통제', () => {
    expect(mandatoryControls('high').length).toBeGreaterThanOrEqual(9);
  });

  it('unacceptable은 사용 금지', () => {
    expect(mandatoryControls('unacceptable')).toEqual(['사용 금지']);
  });
});

describe('AiImpactAssessor — FR-AIA.1/4/5', () => {
  it('high 위험 + 통제 완비 시 승인', () => {
    const assessor = new AiImpactAssessor();
    const r = assessor.assess({
      id: 'ai-1',
      name: '채용 AI',
      purpose: 'recruitment',
      humanOversight: true,
      transparency: true,
      dataGovernance: true,
      logsRetained: true,
      affectedPopulation: 10000,
    });
    expect(r.riskLevel).toBe('high');
    expect(r.approved).toBe(true);
    expect(r.gaps).toEqual([]);
  });

  it('high 위험 + 통제 누락 시 승인 거부', () => {
    const assessor = new AiImpactAssessor();
    const r = assessor.assess({
      id: 'ai-2',
      name: '의료 AI',
      purpose: 'healthcare',
      humanOversight: false,
      transparency: true,
      dataGovernance: true,
      logsRetained: false,
      affectedPopulation: 500,
    });
    expect(r.approved).toBe(false);
    expect(r.gaps).toContain('human_oversight_missing');
    expect(r.gaps).toContain('log_retention_missing');
  });

  it('unacceptable은 무조건 거부', () => {
    const assessor = new AiImpactAssessor();
    const r = assessor.assess({
      id: 'ai-3',
      name: '사회 점수',
      purpose: 'social_scoring',
      humanOversight: true,
      transparency: true,
      dataGovernance: true,
      logsRetained: true,
      affectedPopulation: 1,
    });
    expect(r.approved).toBe(false);
  });

  it('high 위험은 재평가 주기 1년', () => {
    const assessor = new AiImpactAssessor();
    const now = new Date('2026-04-11T00:00:00Z');
    const r = assessor.assess(
      {
        id: 'ai-4',
        name: 'x',
        purpose: 'credit_scoring',
        humanOversight: true,
        transparency: true,
        dataGovernance: true,
        logsRetained: true,
        affectedPopulation: 1,
      },
      now,
    );
    expect(new Date(r.nextReviewAt).getUTCFullYear()).toBe(2027);
  });
});
