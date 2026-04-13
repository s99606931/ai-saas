import { describe, it, expect, beforeEach } from 'vitest';
import {
  SportsFacilityAllocator,
  type Facility,
  type BookingRequest,
} from '../public-sports-facility-allocator-ai';

const sampleFacility = (id: string, overrides: Partial<Facility> = {}): Facility => ({
  facilityId: id,
  type: 'gym',
  capacity: 50,
  operatingHoursStart: 9,
  operatingHoursEnd: 22,
  ...overrides,
});

const sampleRequest = (id: string, overrides: Partial<BookingRequest> = {}): BookingRequest => ({
  requestId: id,
  facilityId: 'f1',
  groupSize: 20,
  preferredStartHour: 14,
  durationHours: 2,
  priorityCategory: 'general',
  previousAllocationCount: 0,
  ...overrides,
});

describe('SportsFacilityAllocator', () => {
  let ai: SportsFacilityAllocator;

  beforeEach(() => {
    ai = new SportsFacilityAllocator();
    ai.registerFacility(sampleFacility('f1'));
  });

  it('시설과 요청을 등록한다', () => {
    ai.submitRequest(sampleRequest('r1'));
    expect(ai.listFacilities().length).toBe(1);
  });

  it('시간대를 배정한다', () => {
    ai.submitRequest(sampleRequest('r1'));
    const allocations = ai.allocate();
    expect(allocations[0]!.status).toBe('granted');
    expect(allocations[0]!.startHour).toBe(14);
  });

  it('우선순위 그룹을 먼저 배정한다', () => {
    ai.submitRequest(sampleRequest('rGen', { priorityCategory: 'general' }));
    ai.submitRequest(sampleRequest('rSen', { priorityCategory: 'senior' }));
    const allocations = ai.allocate();
    const senior = allocations.find(a => a.requestId === 'rSen')!;
    const general = allocations.find(a => a.requestId === 'rGen')!;
    expect(senior.fairnessScore).toBeGreaterThan(general.fairnessScore);
  });

  it('수용 초과 요청은 거절한다', () => {
    ai.submitRequest(sampleRequest('r1', { groupSize: 100 }));
    const allocations = ai.allocate();
    expect(allocations[0]!.status).toBe('denied');
  });

  it('이용률을 계산한다', () => {
    ai.submitRequest(sampleRequest('r1', { durationHours: 3 }));
    ai.allocate();
    const rate = ai.utilizationRate('f1');
    expect(rate).toBeGreaterThan(0);
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() => ai.submitRequest(sampleRequest('r1'), 'C')).toThrow('BLOCKED');
  });
});
