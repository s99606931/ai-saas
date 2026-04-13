import { describe, it, expect } from 'vitest';
import { UrbanPlanImpactAnalyzerAI } from '../urban-plan-impact-analyzer-ai.js';

describe('SVC-AI-ADV-R437 UrbanPlanImpactAnalyzerAI', () => {
  const svc = new UrbanPlanImpactAnalyzerAI();

  it('FR-437.1: 교통 영향 HIGH', () => {
    const r = svc.analyze({
      planId: 'P1',
      heightMeters: 10,
      expectedVehicles: 200,
      constructionMonths: 2,
      distanceToNearestBuilding: 50,
    });
    expect(r.traffic.level).toBe('HIGH');
    expect(r.recommendations.some((x) => x.includes('교통'))).toBe(true);
  });

  it('FR-437.2: 소음 영향 HIGH', () => {
    const r = svc.analyze({
      planId: 'P1',
      heightMeters: 20,
      expectedVehicles: 10,
      constructionMonths: 24,
      distanceToNearestBuilding: 50,
    });
    expect(r.noise.level).toBe('HIGH');
  });

  it('FR-437.3: 일조 영향 계산', () => {
    const r = svc.analyze({
      planId: 'P1',
      heightMeters: 100,
      expectedVehicles: 10,
      constructionMonths: 2,
      distanceToNearestBuilding: 0,
    });
    expect(r.sunlight.score).toBeGreaterThan(0);
  });

  it('FR-437.4: 경미한 영향 → 통상 승인 권고', () => {
    const r = svc.analyze({
      planId: 'P1',
      heightMeters: 3,
      expectedVehicles: 5,
      constructionMonths: 1,
      distanceToNearestBuilding: 100,
    });
    expect(r.traffic.level).toBe('LOW');
    expect(r.recommendations[0]).toContain('경미');
  });

  it('음수 입력 → 오류', () => {
    expect(() =>
      svc.analyze({
        planId: 'P1',
        heightMeters: -1,
        expectedVehicles: 0,
        constructionMonths: 0,
        distanceToNearestBuilding: 0,
      }),
    ).toThrow('INVALID_INPUT');
  });

  it('FR-437.5: C 차단', () => {
    expect(() =>
      svc.analyze(
        {
          planId: 'P1',
          heightMeters: 10,
          expectedVehicles: 10,
          constructionMonths: 1,
          distanceToNearestBuilding: 10,
        },
        'C',
      ),
    ).toThrow('N2SF_BLOCKED');
  });

  it('감사 로그', () => {
    svc.analyze({
      planId: 'P1',
      heightMeters: 10,
      expectedVehicles: 10,
      constructionMonths: 1,
      distanceToNearestBuilding: 10,
    });
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
