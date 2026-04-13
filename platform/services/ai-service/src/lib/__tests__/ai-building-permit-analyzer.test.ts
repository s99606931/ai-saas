import { describe, it, expect, beforeEach } from 'vitest';
import { AIBuildingPermitAnalyzer } from '../ai-building-permit-analyzer';

describe('AIBuildingPermitAnalyzer', () => {
  let svc: AIBuildingPermitAnalyzer;

  beforeEach(() => {
    svc = new AIBuildingPermitAnalyzer();
  });

  it('적합한 신청은 승인된다', () => {
    const result = svc.analyze({
      applicationId: 'a1',
      zoneType: 'residential',
      floorAreaRatioPct: 180,
      buildingCoverageRatioPct: 50,
      heightM: 25,
      setbackM: 4,
      parkingSpaces: 20,
      totalUnits: 20,
    });
    expect(result.approved).toBe(true);
    expect(result.scoreOutOf100).toBe(100);
  });

  it('용적률 초과 시 거부', () => {
    const result = svc.analyze({
      applicationId: 'a2',
      zoneType: 'residential',
      floorAreaRatioPct: 250,
      buildingCoverageRatioPct: 50,
      heightM: 25,
      setbackM: 4,
      parkingSpaces: 20,
      totalUnits: 20,
    });
    expect(result.approved).toBe(false);
    expect(result.issues.some(i => i.ruleCode === 'FAR-EXCEED')).toBe(true);
  });

  it('주차 부족 시 경고', () => {
    const result = svc.analyze({
      applicationId: 'a3',
      zoneType: 'residential',
      floorAreaRatioPct: 180,
      buildingCoverageRatioPct: 50,
      heightM: 25,
      setbackM: 4,
      parkingSpaces: 5,
      totalUnits: 20,
    });
    expect(result.issues.some(i => i.ruleCode === 'PARKING-INSUFFICIENT')).toBe(true);
    expect(result.approved).toBe(true); // warning만이라 승인은 됨
  });

  it('녹지 지역은 더 엄격하다', () => {
    const result = svc.analyze({
      applicationId: 'a4',
      zoneType: 'green',
      floorAreaRatioPct: 100,
      buildingCoverageRatioPct: 30,
      heightM: 20,
      setbackM: 5,
      parkingSpaces: 5,
      totalUnits: 5,
    });
    expect(result.approved).toBe(false);
  });

  it('일괄 분석', () => {
    const results = svc.batchAnalyze([
      { applicationId: 'a1', zoneType: 'commercial', floorAreaRatioPct: 400, buildingCoverageRatioPct: 60, heightM: 50, setbackM: 3, parkingSpaces: 20, totalUnits: 30 },
      { applicationId: 'a2', zoneType: 'industrial', floorAreaRatioPct: 300, buildingCoverageRatioPct: 50, heightM: 40, setbackM: 6, parkingSpaces: 5, totalUnits: 10 },
    ]);
    expect(results.length).toBe(2);
  });

  it('C등급 데이터 차단', () => {
    expect(() => svc.analyze({
      applicationId: 'a5',
      zoneType: 'residential',
      floorAreaRatioPct: 180,
      buildingCoverageRatioPct: 50,
      heightM: 25,
      setbackM: 4,
      parkingSpaces: 20,
      totalUnits: 20,
    }, 'C')).toThrow('BLOCKED');
  });
});
