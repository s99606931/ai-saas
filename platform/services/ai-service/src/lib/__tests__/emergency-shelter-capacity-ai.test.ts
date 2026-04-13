import { describe, it, expect, beforeEach } from 'vitest';
import { EmergencyShelterCapacityAI } from '../emergency-shelter-capacity-ai';

describe('EmergencyShelterCapacityAI', () => {
  let ai: EmergencyShelterCapacityAI;

  beforeEach(() => {
    ai = new EmergencyShelterCapacityAI();
    ai.registerShelter({
      shelterId: 's1',
      type: 'school',
      maxCapacity: 500,
      currentOccupants: 50,
      lat: 37.5,
      lng: 127.0,
      suitableFor: ['earthquake', 'flood', 'typhoon'],
    });
    ai.registerShelter({
      shelterId: 's2',
      type: 'gym',
      maxCapacity: 300,
      currentOccupants: 0,
      lat: 37.51,
      lng: 127.01,
      suitableFor: ['earthquake', 'fire'],
    });
    ai.registerShelter({
      shelterId: 's3',
      type: 'underground',
      maxCapacity: 200,
      currentOccupants: 0,
      lat: 37.52,
      lng: 127.02,
      suitableFor: ['chemical', 'earthquake'],
    });
  });

  it('대피소 등록', () => {
    expect(ai.getAuditLog().filter(l => l.action === 'REGISTER_SHELTER').length).toBe(3);
  });

  it('지진 발생 시 적합 대피소 수용력 예측', () => {
    const f = ai.forecast({ region: '강남', disasterType: 'earthquake', estimatedEvacuees: 400 });
    expect(f.totalCapacity).toBe(1000);
    expect(f.availableCapacity).toBe(950);
    expect(f.deficitCount).toBe(0);
    expect(f.recommendedShelters.length).toBeGreaterThan(0);
  });

  it('화학 재난은 underground만 적합', () => {
    const f = ai.forecast({ region: '강남', disasterType: 'chemical', estimatedEvacuees: 150 });
    expect(f.totalCapacity).toBe(200);
    expect(f.recommendedShelters[0]!.shelterId).toBe('s3');
  });

  it('수용 초과는 deficit 산출', () => {
    const f = ai.forecast({ region: '강남', disasterType: 'chemical', estimatedEvacuees: 500 });
    expect(f.deficitCount).toBe(300);
  });

  it('잘못된 capacity 등록 차단', () => {
    expect(() =>
      ai.registerShelter({
        shelterId: 'bad',
        type: 'school',
        maxCapacity: 0,
        currentOccupants: 0,
        lat: 0,
        lng: 0,
        suitableFor: [],
      }),
    ).toThrow(/capacity/);
  });

  it('S등급 차단', () => {
    expect(() =>
      ai.forecast(
        { region: '강남', disasterType: 'earthquake', estimatedEvacuees: 100 },
        'S' as unknown as never,
      ),
    ).toThrow(/BLOCKED/);
  });
});
