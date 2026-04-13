import { describe, it, expect, beforeEach } from 'vitest';
import {
  SmartStreetlightController,
  type StreetlightUnit,
  type SensorReading,
} from '../smart-streetlight-controller-ai';

const sampleLight = (id: string, overrides: Partial<StreetlightUnit> = {}): StreetlightUnit => ({
  lightId: id,
  zoneType: 'residential',
  ratedWattage: 100,
  installedYear: 2022,
  lastMaintenance: '2025-06-01',
  ...overrides,
});

const sampleReading = (id: string, overrides: Partial<SensorReading> = {}): SensorReading => ({
  lightId: id,
  timestamp: '2026-04-13T22:00:00Z',
  ambientLux: 5,
  pedestrianCountPerMin: 10,
  vehicleCountPerMin: 5,
  ...overrides,
});

describe('SmartStreetlightController', () => {
  let ai: SmartStreetlightController;

  beforeEach(() => {
    ai = new SmartStreetlightController();
  });

  it('가로등과 센서 데이터를 등록한다', () => {
    ai.registerLight(sampleLight('L1'));
    ai.ingestReading(sampleReading('L1'));
    expect(ai.getAuditLog().length).toBeGreaterThan(0);
  });

  it('주간에는 조명을 끈다', () => {
    ai.registerLight(sampleLight('L1'));
    ai.ingestReading(sampleReading('L1', { ambientLux: 5000 }));
    const cmd = ai.computeDimming('L1');
    expect(cmd.brightnessPct).toBe(0);
  });

  it('학교 구역은 조도를 가중한다', () => {
    ai.registerLight(sampleLight('L1', { zoneType: 'school' }));
    ai.ingestReading(sampleReading('L1'));
    const cmd = ai.computeDimming('L1');
    expect(cmd.brightnessPct).toBeGreaterThanOrEqual(70);
  });

  it('총 소비 전력을 합산한다', () => {
    ai.registerLight(sampleLight('L1'));
    ai.registerLight(sampleLight('L2'));
    ai.ingestReading(sampleReading('L1'));
    ai.ingestReading(sampleReading('L2'));
    expect(ai.totalPowerConsumption()).toBeGreaterThan(0);
  });

  it('유지보수 대상을 식별한다', () => {
    ai.registerLight(sampleLight('L1', { lastMaintenance: '2024-01-01' }));
    const due = ai.needsMaintenance('2026-04-13');
    expect(due).toContain('L1');
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() => ai.registerLight(sampleLight('L1'), 'S')).toThrow('BLOCKED');
  });
});
