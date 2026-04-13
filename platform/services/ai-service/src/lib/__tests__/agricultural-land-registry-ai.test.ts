import { describe, it, expect, beforeEach } from 'vitest';
import { AgriculturalLandRegistryAI } from '../agricultural-land-registry-ai';

describe('AgriculturalLandRegistryAI', () => {
  let ai: AgriculturalLandRegistryAI;

  beforeEach(() => {
    ai = new AgriculturalLandRegistryAI();
  });

  it('필지를 등록한다', () => {
    ai.registerParcel({
      parcelId: 'P1',
      ownerId: 'OWN1',
      category: 'paddy',
      areaM2: 500,
      useStatus: 'in_use',
      isProtectedZone: false,
      registeredAt: '2026-04-13',
    });
    expect(ai.getOwnerParcels('OWN1').length).toBe(1);
  });

  it('중복 등록은 거부한다', () => {
    ai.registerParcel({
      parcelId: 'P1',
      ownerId: 'OWN1',
      category: 'upland',
      areaM2: 200,
      useStatus: 'in_use',
      isProtectedZone: false,
      registeredAt: '2026-04-13',
    });
    expect(() =>
      ai.registerParcel({
        parcelId: 'P1',
        ownerId: 'OWN2',
        category: 'upland',
        areaM2: 200,
        useStatus: 'in_use',
        isProtectedZone: false,
        registeredAt: '2026-04-13',
      }),
    ).toThrow('이미 등록');
  });

  it('보호구역 전환은 error로 검증한다', () => {
    ai.registerParcel({
      parcelId: 'P2',
      ownerId: 'OWN1',
      category: 'paddy',
      areaM2: 1000,
      useStatus: 'in_use',
      isProtectedZone: true,
      registeredAt: '2026-04-13',
    });
    ai.updateUseStatus('P2', 'converted');
    const issues = ai.validateParcel('P2');
    expect(issues.some(i => i.severity === 'error')).toBe(true);
  });

  it('유휴 농지는 warning을 반환한다', () => {
    ai.registerParcel({
      parcelId: 'P3',
      ownerId: 'OWN1',
      category: 'upland',
      areaM2: 400,
      useStatus: 'idle',
      isProtectedZone: false,
      registeredAt: '2026-04-13',
    });
    const issues = ai.validateParcel('P3');
    expect(issues.some(i => i.severity === 'warning')).toBe(true);
  });

  it('지목별 총 면적을 집계한다', () => {
    ai.registerParcel({
      parcelId: 'P4',
      ownerId: 'OWN1',
      category: 'paddy',
      areaM2: 500,
      useStatus: 'in_use',
      isProtectedZone: false,
      registeredAt: '2026-04-13',
    });
    ai.registerParcel({
      parcelId: 'P5',
      ownerId: 'OWN1',
      category: 'paddy',
      areaM2: 700,
      useStatus: 'in_use',
      isProtectedZone: false,
      registeredAt: '2026-04-13',
    });
    expect(ai.getTotalAreaByCategory().paddy).toBe(1200);
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerParcel(
        {
          parcelId: 'X',
          ownerId: 'Y',
          category: 'paddy',
          areaM2: 100,
          useStatus: 'in_use',
          isProtectedZone: false,
          registeredAt: '2026-04-13',
        },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
