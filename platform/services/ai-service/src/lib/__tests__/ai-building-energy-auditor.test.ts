import { describe, it, expect, beforeEach } from 'vitest';
import { AIBuildingEnergyAuditor } from '../ai-building-energy-auditor';

describe('AIBuildingEnergyAuditor', () => {
  let auditor: AIBuildingEnergyAuditor;

  beforeEach(() => {
    auditor = new AIBuildingEnergyAuditor();
    auditor.registerBuilding({
      id: 'b1', type: 'office', areaSqm: 1000, yearBuilt: 2010, occupancy: 100,
    });
  });

  it('건물을 등록한다', () => {
    expect(auditor.getAuditLog().some(l => l.action === 'REGISTER_BUILDING')).toBe(true);
  });

  it('검침 데이터를 기록한다', () => {
    auditor.recordReading({
      buildingId: 'b1', month: '2026-03', electricityKwh: 10000, heatingGJ: 20, waterM3: 100,
    });
    expect(auditor.getAuditLog().some(l => l.action === 'RECORD_READING')).toBe(true);
  });

  it('효율 등급을 산정한다', () => {
    auditor.recordReading({
      buildingId: 'b1', month: '2026-03', electricityKwh: 10000, heatingGJ: 20, waterM3: 100,
    });
    const result = auditor.audit('b1');
    expect(['A', 'B', 'C', 'D', 'E']).toContain(result.efficiencyGrade);
  });

  it('고소비 건물은 개선 권고가 나온다', () => {
    auditor.recordReading({
      buildingId: 'b1', month: '2026-03', electricityKwh: 30000, heatingGJ: 50, waterM3: 300,
    });
    const result = auditor.audit('b1');
    expect(result.recommendedRetrofits.length).toBeGreaterThan(0);
    expect(result.estimatedSavingsPercent).toBeGreaterThan(0);
  });

  it('미등록 건물 감사 시 에러', () => {
    expect(() => auditor.audit('unknown')).toThrow();
  });

  it('C등급 데이터 차단', () => {
    expect(() => auditor.recordReading({
      buildingId: 'b1', month: '2026-03', electricityKwh: 1000, heatingGJ: 1, waterM3: 10,
    }, 'C' as unknown as never)).toThrow(/BLOCKED/);
  });
});
