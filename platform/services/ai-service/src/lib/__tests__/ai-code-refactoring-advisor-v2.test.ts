import { describe, it, expect, beforeEach } from 'vitest';
import { AICodeRefactoringAdvisorV2 } from '../ai-code-refactoring-advisor-v2';

describe('AICodeRefactoringAdvisorV2', () => {
  let adv: AICodeRefactoringAdvisorV2;

  beforeEach(() => {
    adv = new AICodeRefactoringAdvisorV2();
    adv.registerModule({ moduleId: 'm1', language: 'ts', loc: 200 });
  });

  it('classifies CRITICAL + SPLIT for cyclomatic >= 20', () => {
    const a = adv.analyzeMetrics({ metricId: 'm', moduleId: 'm1', cyclomatic: 25 });
    expect(a.level).toBe('CRITICAL');
    expect(a.action).toBe('SPLIT');
  });

  it('classifies HIGH + SIMPLIFY for cyclomatic 10~20', () => {
    const a = adv.analyzeMetrics({ metricId: 'm', moduleId: 'm1', cyclomatic: 12 });
    expect(a.level).toBe('HIGH');
    expect(a.action).toBe('SIMPLIFY');
  });

  it('classifies MODERATE + REVIEW for cyclomatic < 10', () => {
    const a = adv.analyzeMetrics({ metricId: 'm', moduleId: 'm1', cyclomatic: 5 });
    expect(a.level).toBe('MODERATE');
    expect(a.action).toBe('REVIEW');
  });

  it('escalates one rank when loc > 800', () => {
    adv.registerModule({ moduleId: 'big', language: 'ts', loc: 1200 });
    const a = adv.analyzeMetrics({ metricId: 'm', moduleId: 'big', cyclomatic: 5 });
    expect(a.action).toBe('SIMPLIFY');
  });

  it('blocks C/S grade (N2SF N-05)', () => {
    expect(() =>
      adv.analyzeMetrics({ metricId: 'm', moduleId: 'm1', cyclomatic: 5 }, 'C'),
    ).toThrow('BLOCKED');
    expect(() =>
      adv.analyzeMetrics({ metricId: 'm', moduleId: 'm1', cyclomatic: 5 }, 'S'),
    ).toThrow('BLOCKED');
  });

  it('rejects unknown module and invalid cyclomatic', () => {
    expect(() =>
      adv.analyzeMetrics({ metricId: 'm', moduleId: 'unknown', cyclomatic: 5 }),
    ).toThrow('UNKNOWN_MODULE');
    expect(() =>
      adv.analyzeMetrics({ metricId: 'm', moduleId: 'm1', cyclomatic: -1 }),
    ).toThrow('INVALID_CYCLOMATIC');
  });

  it('lists split candidates and maintains audit log', () => {
    adv.analyzeMetrics({ metricId: 'm1', moduleId: 'm1', cyclomatic: 30 });
    adv.analyzeMetrics({ metricId: 'm2', moduleId: 'm1', cyclomatic: 3 });
    expect(adv.getSplitCandidates().map((a) => a.metricId)).toEqual(['m1']);
    expect(adv.getAuditLog().some((e) => e.action === 'ANALYZE_METRIC')).toBe(true);
  });
});
