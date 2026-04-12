// MTU-N287 테넌트 온보딩 AI 테스트
import { describe, it, expect } from 'vitest';
import { TenantOnboardingAIService } from '../tenant-onboarding-ai.js';

describe('MTU-N287 TenantOnboardingAI', () => {
  const svc = new TenantOnboardingAIService('tenant-n287');

  const baseSurvey = {
    organizationName: '서울특별시',
    organizationType: 'local_government' as const,
    scale: 'large' as const,
    employeeCount: 5000,
    expectedUsers: 1000,
    requiredModules: ['users', 'audit'],
    securityLevel: 'enhanced' as const,
    dataClassification: 'O' as const,
    existingSystems: ['legacy_db'],
    migrationNeeded: true,
    customRequirements: ['단일 사인온'],
  };

  it('FR-N287.1: 설문 분석', () => {
    const r = svc.analyzeSurvey(baseSurvey);
    expect(r.analysisId).toBeDefined();
    expect(r.recommendedConfig).toBeDefined();
  });

  it('FR-N287.2: 프로비저닝 + 검증', () => {
    const a = svc.analyzeSurvey(baseSurvey);
    const p = svc.provision(a.recommendedConfig);
    expect(p.tenantId).toBe('tenant-n287');
    const v = svc.verify(p, a.recommendedConfig);
    expect(v).toBeDefined();
  });

  it('FR-N287.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
