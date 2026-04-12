import { describe, it, expect } from 'vitest';
import { AIRegulationCompliance, type AISystemProfile } from '../ai-regulation-compliance';

describe('AIRegulationCompliance', () => {
  const svc = new AIRegulationCompliance();

  const highRisk: AISystemProfile = {
    systemId: 'S1',
    name: '채용 평가 AI',
    purpose: '이력서 스크리닝',
    usesPersonalData: true,
    affectsRights: true,
    inHighRiskDomain: true,
    usedBy: 'business',
    autoDecisions: true,
  };

  const minimal: AISystemProfile = {
    systemId: 'S2',
    name: '내부 문서 요약',
    purpose: '회의록 요약',
    usesPersonalData: false,
    affectsRights: false,
    inHighRiskDomain: false,
    usedBy: 'internal',
    autoDecisions: false,
  };

  it('classifies high risk system', () => {
    expect(svc.classifyEuRisk(highRisk)).toBe('high');
  });

  it('classifies minimal system', () => {
    expect(svc.classifyEuRisk(minimal)).toBe('minimal');
  });

  it('applies Korean AI law for personal data', () => {
    expect(svc.isKoreanAiLawApplicable(highRisk)).toBe(true);
    expect(svc.isKoreanAiLawApplicable(minimal)).toBe(false);
  });

  it('returns more controls for high risk', () => {
    const high = svc.getRequiredControls('high');
    const min = svc.getRequiredControls('minimal');
    expect(high.length).toBeGreaterThan(min.length);
  });

  it('generates report with gaps', () => {
    const report = svc.generateReport(highRisk, { C1: 'doc1', C2: 'doc2' });
    expect(report.euAiActLevel).toBe('high');
    expect(report.gaps.length).toBeGreaterThan(0);
    expect(report.passRate).toBeLessThan(1);
  });
});
