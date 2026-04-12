// MTU-N372 이벤트 소싱 CQRS 프로젝터 테스트
import { describe, it, expect } from 'vitest';
import { EventSourcingService, type DomainEvent } from '../event-sourcing-cqrs-projector.js';

interface Counter { value: number }

describe('MTU-N372 EventSourcingCQRSProjector', () => {
  const svc = new EventSourcingService<Counter>(
    'tenant-n372',
    { value: 0 },
    (state, event) => {
      if (event.eventType === 'inc') return { value: state.value + 1 };
      return state;
    },
  );

  it('FR-N372.1: 이벤트 적재 및 리플레이', () => {
    const make = (v: number): DomainEvent => ({
      eventId: `e-${v}`,
      aggregateId: 'agg-1',
      aggregateType: 'counter',
      eventType: 'inc',
      version: v,
      payload: {},
      occurredAt: new Date().toISOString(),
      actor: 'system',
    });
    svc.append(make(1));
    svc.append(make(2));
    svc.append(make(3));
    const { state, version } = svc.rebuild('agg-1');
    expect(state.value).toBe(3);
    expect(version).toBe(3);
  });

  it('FR-N372.2: 스냅샷', () => {
    svc.snapshot('agg-1');
    const { state } = svc.rebuild('agg-1');
    expect(state.value).toBe(3);
  });

  it('FR-N372.3: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
