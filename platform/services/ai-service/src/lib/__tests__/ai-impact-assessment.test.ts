import { describe, it, expect } from 'vitest';
import { AiImpactAssessment, type AiSystemProfile } from '../ai-impact-assessment';

describe('AiImpactAssessment', () => {
  const svc = new AiImpactAssessment();

  it('FR-AIA.1/2 분류 (high)', () => {
    const p: AiSystemProfile = {
      id: 's1',
      name: '채용 AI',
      useCase: 'recruitment',
      automatedDecision: true,
      affectsVulnerable: false,
      usesPersonalData: true,
    };
    expect(svc.classify(p)).toBe('high');
  });

  it('FR-AIA.1/2 분류 (minimal)', () => {
    const p: AiSystemProfile = {
      id: 's2',
      name: '범용 챗봇',
      useCase: 'general',
      automatedDecision: false,
      affectsVulnerable: false,
      usesPersonalData: false,
    };
    expect(svc.classify(p)).toBe('minimal');
  });

  it('FR-AIA.3 의무 체크리스트 (high)', () => {
    const obs = svc.getObligations('high');
    expect(obs).toContain('인간 감독');
    expect(obs.length).toBeGreaterThanOrEqual(5);
  });

  it('FR-AIA.4 승인 필요', () => {
    expect(svc.requiresApproval('high')).toBe(true);
    expect(svc.requiresApproval('limited')).toBe(false);
  });

  it('FR-AIA.5 평가 보고서', () => {
    const p: AiSystemProfile = {
      id: 's3',
      name: '의료 진단',
      useCase: 'healthcare',
      automatedDecision: true,
      affectsVulnerable: true,
      usesPersonalData: true,
    };
    const r = svc.assess(p, new Date('2026-04-11'));
    expect(r.risk).toBe('high');
    expect(r.approvalRequired).toBe(true);
  });
});
