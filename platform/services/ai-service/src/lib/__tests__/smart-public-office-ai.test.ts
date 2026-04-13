import { describe, it, expect, beforeEach } from 'vitest';
import { SmartPublicOfficeAi, type SensorReading } from '../smart-public-office-ai';

describe('SmartPublicOfficeAi (R500 milestone)', () => {
  let ai: SmartPublicOfficeAi;

  beforeEach(() => {
    ai = new SmartPublicOfficeAi();
  });

  const sample = (over: Partial<SensorReading> = {}): SensorReading => ({
    facilityId: 'f-1',
    facilityType: 'meeting_room',
    timestamp: '2026-04-13T09:00:00.000Z',
    occupancy: 5,
    capacity: 10,
    temperatureC: 23,
    co2Ppm: 800,
    powerKw: 1.0,
    ...over,
  });

  it('500 라운드 이정표가 노출된다', () => {
    expect(ai.milestoneRound).toBe(500);
  });

  it('정상 시설은 continue_monitoring 추천이다', () => {
    ai.ingest(sample());
    const result = ai.optimize('f-1');
    expect(result.recommendedActions).toContain('continue_monitoring');
    expect(result.priority).toBe('low');
  });

  it('과밀 시설은 expand_capacity 추천이다', () => {
    ai.ingest(sample({ occupancy: 10, capacity: 10 }));
    const result = ai.optimize('f-1');
    expect(result.recommendedActions).toContain('expand_capacity');
    expect(result.utilizationPct).toBe(100);
  });

  it('CO2 1200 초과 시 ventilation_increase 추천', () => {
    ai.ingest(sample({ co2Ppm: 1500 }));
    const result = ai.optimize('f-1');
    expect(result.recommendedActions).toContain('ventilation_increase');
  });

  it('KPI 요약에 milestoneRound 500 포함', () => {
    ai.ingest(sample({ facilityId: 'f-1' }));
    ai.ingest(sample({ facilityId: 'f-2' }));
    const kpi = ai.kpiSummary();
    expect(kpi.milestoneRound).toBe(500);
    expect(kpi.totalFacilities).toBe(2);
  });

  it('잘못된 occupancy는 거부한다', () => {
    expect(() => ai.ingest(sample({ occupancy: 20, capacity: 10 }))).toThrow('VALIDATION');
  });
});
