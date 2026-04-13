import { describe, it, expect, beforeEach } from 'vitest';
import { GovernmentVehicleFleetAI } from '../government-vehicle-fleet-ai';

describe('GovernmentVehicleFleetAI', () => {
  let ai: GovernmentVehicleFleetAI;

  beforeEach(() => {
    ai = new GovernmentVehicleFleetAI(2026);
  });

  it('차량을 등록하고 목록에 반영한다', () => {
    ai.register({
      vehicleId: 'V1',
      type: 'sedan',
      fuel: 'gasoline',
      yearBuilt: 2023,
      odometerKm: 30000,
      lastServiceKm: 25000,
      monthlyMileageKm: 1500,
      assignedDept: '총무',
    });
    expect(ai.listFleet()).toHaveLength(1);
  });

  it('차령/주행거리 초과 시 폐차 권고', () => {
    ai.register({
      vehicleId: 'V2',
      type: 'sedan',
      fuel: 'diesel',
      yearBuilt: 2012,
      odometerKm: 250000,
      lastServiceKm: 245000,
      monthlyMileageKm: 500,
      assignedDept: '총무',
    });
    const tasks = ai.planMaintenance();
    expect(tasks.some((t) => t.action === 'retire')).toBe(true);
  });

  it('정기 정비 주기 경과 탐지', () => {
    ai.register({
      vehicleId: 'V3',
      type: 'van',
      fuel: 'diesel',
      yearBuilt: 2022,
      odometerKm: 50000,
      lastServiceKm: 35000,
      monthlyMileageKm: 2000,
      assignedDept: '건설',
    });
    const tasks = ai.planMaintenance();
    expect(tasks.some((t) => t.action === 'routine_service')).toBe(true);
  });

  it('EV 우선 배차', () => {
    ai.register({
      vehicleId: 'EV1',
      type: 'sedan',
      fuel: 'electric',
      yearBuilt: 2024,
      odometerKm: 10000,
      lastServiceKm: 10000,
      monthlyMileageKm: 1000,
      assignedDept: '환경',
    });
    ai.register({
      vehicleId: 'GS1',
      type: 'sedan',
      fuel: 'gasoline',
      yearBuilt: 2025,
      odometerKm: 5000,
      lastServiceKm: 5000,
      monthlyMileageKm: 800,
      assignedDept: '환경',
    });
    const chosen = ai.dispatch({
      requestId: 'D1',
      dept: '환경',
      passengerCount: 2,
      tripDistanceKm: 20,
      requiresCargo: false,
    });
    expect(chosen?.fuel).toBe('electric');
  });

  it('화물 요청은 트럭/밴만 배차', () => {
    ai.register({
      vehicleId: 'TR1',
      type: 'truck',
      fuel: 'diesel',
      yearBuilt: 2023,
      odometerKm: 20000,
      lastServiceKm: 20000,
      monthlyMileageKm: 3000,
      assignedDept: '시설',
    });
    ai.register({
      vehicleId: 'SD1',
      type: 'sedan',
      fuel: 'hybrid',
      yearBuilt: 2024,
      odometerKm: 10000,
      lastServiceKm: 10000,
      monthlyMileageKm: 1000,
      assignedDept: '시설',
    });
    const chosen = ai.dispatch({
      requestId: 'D2',
      dept: '시설',
      passengerCount: 2,
      tripDistanceKm: 50,
      requiresCargo: true,
    });
    expect(chosen?.type).toBe('truck');
  });

  it('C등급 차단', () => {
    expect(() =>
      ai.register(
        {
          vehicleId: 'Z',
          type: 'sedan',
          fuel: 'gasoline',
          yearBuilt: 2024,
          odometerKm: 1,
          lastServiceKm: 0,
          monthlyMileageKm: 10,
          assignedDept: 'x',
        },
        'C' as never,
      ),
    ).toThrow('BLOCKED');
  });
});
