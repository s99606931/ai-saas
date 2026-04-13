import { describe, it, expect, beforeEach } from 'vitest';
import { UrbanPlanningComplianceAI } from '../urban-planning-compliance-ai';

describe('UrbanPlanningComplianceAI', () => {
  let ai: UrbanPlanningComplianceAI;

  beforeEach(() => {
    ai = new UrbanPlanningComplianceAI();
  });

  it('주거지역 내 주택 계획을 승인한다', () => {
    const r = ai.check({
      planId: 'U1',
      zone: 'residential',
      siteAreaSqm: 1000,
      buildingFootprintSqm: 500,
      totalFloorAreaSqm: 2000,
      buildingHeightMeter: 40,
      useType: 'housing',
    });
    expect(r.compliant).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it('건폐율 초과를 탐지한다', () => {
    const r = ai.check({
      planId: 'U2',
      zone: 'residential',
      siteAreaSqm: 1000,
      buildingFootprintSqm: 800,
      totalFloorAreaSqm: 2000,
      buildingHeightMeter: 30,
      useType: 'housing',
    });
    expect(r.compliant).toBe(false);
    expect(r.violations.some((v) => v.code === 'BCR_EXCEEDED')).toBe(true);
  });

  it('허용되지 않은 용도를 탐지한다', () => {
    const r = ai.check({
      planId: 'U3',
      zone: 'greenbelt',
      siteAreaSqm: 10000,
      buildingFootprintSqm: 500,
      totalFloorAreaSqm: 1000,
      buildingHeightMeter: 8,
      useType: 'factory',
    });
    expect(r.violations.some((v) => v.code === 'USE_NOT_ALLOWED')).toBe(true);
  });

  it('용적률과 높이 동시 초과를 탐지한다', () => {
    const r = ai.check({
      planId: 'U4',
      zone: 'historic',
      siteAreaSqm: 500,
      buildingFootprintSqm: 100,
      totalFloorAreaSqm: 2000,
      buildingHeightMeter: 60,
      useType: 'housing',
    });
    expect(r.violations.some((v) => v.code === 'FAR_EXCEEDED')).toBe(true);
    expect(r.violations.some((v) => v.code === 'HEIGHT_EXCEEDED')).toBe(true);
  });

  it('규칙 오버라이드가 반영된다', () => {
    ai.overrideRule({
      zone: 'residential',
      maxBuildingCoverageRatio: 30,
      maxFloorAreaRatio: 100,
      maxHeightMeter: 20,
      allowedUses: ['housing'],
    });
    const r = ai.check({
      planId: 'U5',
      zone: 'residential',
      siteAreaSqm: 1000,
      buildingFootprintSqm: 400,
      totalFloorAreaSqm: 1500,
      buildingHeightMeter: 30,
      useType: 'housing',
    });
    expect(r.violations.length).toBeGreaterThanOrEqual(3);
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.check(
        {
          planId: 'U6',
          zone: 'residential',
          siteAreaSqm: 100,
          buildingFootprintSqm: 10,
          totalFloorAreaSqm: 20,
          buildingHeightMeter: 5,
          useType: 'housing',
        },
        'C' as never,
      ),
    ).toThrow('BLOCKED');
  });
});
