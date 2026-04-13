import { describe, it, expect } from 'vitest';
import { SmartParkingAllocatorAI, type Slot } from '../smart-parking-allocator-ai.js';

describe('SVC-AI-ADV-R422 SmartParkingAllocatorAI', () => {
  const makeSlots = (): Slot[] => [
    { slotId: 'A1', distanceFromEntrance: 5, occupied: false },
    { slotId: 'A2', distanceFromEntrance: 10, occupied: false },
    { slotId: 'A3', distanceFromEntrance: 20, occupied: false },
  ];

  it('FR-422.1: 우선순위 순서 할당', () => {
    const svc = new SmartParkingAllocatorAI();
    const out = svc.allocate(
      [
        { requestId: 'r1', priority: 'VISITOR' },
        { requestId: 'r2', priority: 'EMERGENCY' },
      ],
      makeSlots(),
    );
    const em = out.find((a) => a.requestId === 'r2');
    expect(em?.assigned).toBe('A1'); // nearest
  });

  it('FR-422.2: 슬롯 부족 → NO_SLOT', () => {
    const svc = new SmartParkingAllocatorAI();
    const out = svc.allocate(
      [
        { requestId: 'r1', priority: 'STAFF' },
        { requestId: 'r2', priority: 'STAFF' },
        { requestId: 'r3', priority: 'STAFF' },
        { requestId: 'r4', priority: 'STAFF' },
      ],
      makeSlots(),
    );
    expect(out[3]!.assigned).toBeNull();
    expect(out[3]!.reason).toBe('NO_SLOT');
  });

  it('FR-422.3: 활용률 > 0.9 → SATURATED', () => {
    const svc = new SmartParkingAllocatorAI();
    const slots: Slot[] = [
      { slotId: 'A1', distanceFromEntrance: 5, occupied: false },
      { slotId: 'A2', distanceFromEntrance: 10, occupied: false },
    ];
    const out = svc.allocate(
      [
        { requestId: 'r1', priority: 'STAFF' },
        { requestId: 'r2', priority: 'STAFF' },
      ],
      slots,
    );
    expect(out[1]!.alert).toBe('SATURATED');
  });

  it('FR-422.4: C 등급 차단', () => {
    const svc = new SmartParkingAllocatorAI();
    expect(() => svc.allocate([], makeSlots(), 'C')).toThrow('N2SF_BLOCKED');
  });

  it('FR-422.5: 감사 로그', () => {
    const svc = new SmartParkingAllocatorAI();
    svc.allocate([{ requestId: 'r1', priority: 'VISITOR' }], makeSlots());
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });

  it('EMERGENCY > DISABLED > STAFF > VISITOR 순 정렬', () => {
    const svc = new SmartParkingAllocatorAI();
    const out = svc.allocate(
      [
        { requestId: 'v', priority: 'VISITOR' },
        { requestId: 's', priority: 'STAFF' },
        { requestId: 'd', priority: 'DISABLED' },
        { requestId: 'e', priority: 'EMERGENCY' },
      ],
      makeSlots(),
    );
    // 첫 번째로 A1 할당된 것은 e (EMERGENCY)
    expect(out.find((a) => a.requestId === 'e')?.assigned).toBe('A1');
    expect(out.find((a) => a.requestId === 'd')?.assigned).toBe('A2');
    expect(out.find((a) => a.requestId === 's')?.assigned).toBe('A3');
    expect(out.find((a) => a.requestId === 'v')?.assigned).toBeNull();
  });
});
