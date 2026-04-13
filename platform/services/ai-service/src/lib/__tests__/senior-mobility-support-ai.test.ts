import { describe, it, expect, beforeEach } from 'vitest';
import { SeniorMobilitySupportAI } from '../senior-mobility-support-ai';

describe('SeniorMobilitySupportAI', () => {
  let ai: SeniorMobilitySupportAI;

  beforeEach(() => {
    ai = new SeniorMobilitySupportAI();
  });

  it('요청과 차량을 등록한다', () => {
    ai.submitRequest({
      requestId: 'R1',
      seniorCode: 'S001',
      mobilityLevel: 'wheelchair',
      origin: '경로당',
      destination: '보건소',
      purpose: 'medical',
      requestedTime: '2026-04-13T09:00:00Z',
      requiresCaregiver: true,
    });
    ai.registerVehicle({
      vehicleId: 'V1',
      wheelchairAccessible: true,
      caregiverOnboard: true,
      currentLocation: '경로당',
      availableFrom: '2026-04-13T08:30:00Z',
    });
    expect(ai.listPendingRequests().length).toBe(1);
  });

  it('휠체어 요청에 휠체어 차량을 배정한다', () => {
    ai.submitRequest({
      requestId: 'R1',
      seniorCode: 'S001',
      mobilityLevel: 'wheelchair',
      origin: 'A',
      destination: 'B',
      purpose: 'medical',
      requestedTime: '2026-04-13T09:00:00Z',
      requiresCaregiver: false,
    });
    ai.registerVehicle({
      vehicleId: 'V1',
      wheelchairAccessible: true,
      caregiverOnboard: false,
      currentLocation: 'A',
      availableFrom: '2026-04-13T08:00:00Z',
    });
    const a = ai.assignVehicle('R1');
    expect(a.vehicleId).toBe('V1');
    expect(a.rationale.some(r => r.includes('의료'))).toBe(true);
  });

  it('요건 불충족 시 vehicleId는 null이다', () => {
    ai.submitRequest({
      requestId: 'R2',
      seniorCode: 'S002',
      mobilityLevel: 'wheelchair',
      origin: 'A',
      destination: 'B',
      purpose: 'shopping',
      requestedTime: '2026-04-13T09:00:00Z',
      requiresCaregiver: true,
    });
    ai.registerVehicle({
      vehicleId: 'V2',
      wheelchairAccessible: false,
      caregiverOnboard: true,
      currentLocation: 'A',
      availableFrom: '2026-04-13T08:00:00Z',
    });
    const a = ai.assignVehicle('R2');
    expect(a.vehicleId).toBeNull();
  });

  it('배정 히스토리를 반환한다', () => {
    ai.submitRequest({
      requestId: 'R3',
      seniorCode: 'S003',
      mobilityLevel: 'cane',
      origin: 'X',
      destination: 'Y',
      purpose: 'welfare_center',
      requestedTime: '2026-04-13T10:00:00Z',
      requiresCaregiver: false,
    });
    ai.registerVehicle({
      vehicleId: 'V3',
      wheelchairAccessible: false,
      caregiverOnboard: false,
      currentLocation: 'X',
      availableFrom: '2026-04-13T09:00:00Z',
    });
    ai.assignVehicle('R3');
    expect(ai.getAssignmentHistory().length).toBe(1);
  });

  it('배정 후 대기 요청 목록에서 제외된다', () => {
    ai.submitRequest({
      requestId: 'R4',
      seniorCode: 'S004',
      mobilityLevel: 'independent',
      origin: 'X',
      destination: 'Y',
      purpose: 'shopping',
      requestedTime: '2026-04-13T10:00:00Z',
      requiresCaregiver: false,
    });
    ai.registerVehicle({
      vehicleId: 'V4',
      wheelchairAccessible: true,
      caregiverOnboard: true,
      currentLocation: 'X',
      availableFrom: '2026-04-13T09:00:00Z',
    });
    ai.assignVehicle('R4');
    expect(ai.listPendingRequests().length).toBe(0);
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.submitRequest(
        {
          requestId: 'X',
          seniorCode: 'Y',
          mobilityLevel: 'cane',
          origin: 'A',
          destination: 'B',
          purpose: 'shopping',
          requestedTime: '2026-04-13T10:00:00Z',
          requiresCaregiver: false,
        },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
