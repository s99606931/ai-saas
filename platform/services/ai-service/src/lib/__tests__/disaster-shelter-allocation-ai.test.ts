import { describe, it, expect, beforeEach } from 'vitest';
import { DisasterShelterAllocationAI } from '../disaster-shelter-allocation-ai';

describe('DisasterShelterAllocationAI', () => {
  let svc: DisasterShelterAllocationAI;

  beforeEach(() => {
    svc = new DisasterShelterAllocationAI();
    svc.registerShelter({ id: 's1', name: '체육관', lat: 37.5, lng: 127.0, capacity: 100, occupied: 0, accessibility: true });
    svc.registerShelter({ id: 's2', name: '학교', lat: 37.6, lng: 127.1, capacity: 50, occupied: 0, accessibility: false });
  });

  it('대피소를 등록한다', () => {
    expect(svc.getAuditLog().filter(e => e.action === 'REGISTER_SHELTER').length).toBe(2);
  });

  it('가장 가까운 가용 대피소를 찾는다', () => {
    const nearest = svc.findNearestAvailable({ groupId: 'g1', lat: 37.51, lng: 127.01, size: 10, needsAccessibility: false });
    expect(nearest?.id).toBe('s1');
  });

  it('수용 가능 인원을 배분한다', () => {
    const allocations = svc.allocateGroup({ groupId: 'g1', lat: 37.5, lng: 127.0, size: 30, needsAccessibility: false });
    expect(allocations.length).toBe(1);
    expect(allocations[0]?.assignedCount).toBe(30);
  });

  it('수용량 초과 시 분할 배분', () => {
    const allocations = svc.allocateGroup({ groupId: 'g2', lat: 37.5, lng: 127.0, size: 130, needsAccessibility: false });
    expect(allocations.length).toBe(2);
    const total = allocations.reduce((s, a) => s + a.assignedCount, 0);
    expect(total).toBe(130);
  });

  it('접근성 필요 시 적합한 대피소만 사용', () => {
    const allocations = svc.allocateGroup({ groupId: 'g3', lat: 37.6, lng: 127.1, size: 20, needsAccessibility: true });
    expect(allocations.every(a => a.shelterId === 's1')).toBe(true);
  });

  it('S등급 데이터 차단', () => {
    expect(() => svc.allocateGroup({ groupId: 'g4', lat: 37.5, lng: 127.0, size: 10, needsAccessibility: false }, 'S')).toThrow('BLOCKED');
  });
});
