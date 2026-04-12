// SVC-AI-ADV-R350 Tests
import { describe, it, expect } from 'vitest';
import { EmergencyResourceAllocator } from '../emergency-resource-allocator.js';

describe('SVC-AI-ADV-R350 EmergencyResourceAllocator', () => {
  it('FR-350.1: 우선순위 매칭', () => {
    const svc = new EmergencyResourceAllocator();
    svc.registerResource('r1', 'fire', 37.5, 127.0);
    svc.reportIncident('i1', 'fire', 'critical', 37.5, 127.0, 'O');
    const alloc = svc.allocate('i1');
    expect(alloc.resourceId).toBe('r1');
  });

  it('FR-350.2: 가장 가까운 가용 자원 선택', () => {
    const svc = new EmergencyResourceAllocator();
    svc.registerResource('far', 'police', 37.0, 127.0);
    svc.registerResource('near', 'police', 37.5, 127.0);
    svc.reportIncident('i2', 'police', 'high', 37.5, 127.01, 'O');
    const alloc = svc.allocate('i2');
    expect(alloc.resourceId).toBe('near');
  });

  it('FR-350.3: C/S등급 차단', () => {
    const svc = new EmergencyResourceAllocator();
    expect(() => svc.reportIncident('iX', 'ambulance', 'critical', 0, 0, 'S')).toThrow('N2SF_BLOCKED');
  });

  it('FR-350.4: 감사 로그 기록', () => {
    const svc = new EmergencyResourceAllocator();
    svc.registerResource('r1', 'ambulance', 0, 0);
    svc.reportIncident('i1', 'ambulance', 'low', 0, 0, 'O');
    svc.allocate('i1');
    expect(svc.getAuditLog().length).toBeGreaterThanOrEqual(3);
  });

  it('가용 자원 없으면 resourceId null', () => {
    const svc = new EmergencyResourceAllocator();
    svc.reportIncident('i1', 'fire', 'low', 0, 0, 'O');
    const alloc = svc.allocate('i1');
    expect(alloc.resourceId).toBeNull();
  });

  it('동일 자원은 한 번만 배분', () => {
    const svc = new EmergencyResourceAllocator();
    svc.registerResource('r1', 'fire', 0, 0);
    svc.reportIncident('i1', 'fire', 'critical', 0, 0, 'O');
    svc.reportIncident('i2', 'fire', 'critical', 0, 0, 'O');
    const a1 = svc.allocate('i1');
    const a2 = svc.allocate('i2');
    expect(a1.resourceId).toBe('r1');
    expect(a2.resourceId).toBeNull();
  });
});
