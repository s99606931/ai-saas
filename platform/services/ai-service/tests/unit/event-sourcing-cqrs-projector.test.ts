// MTU-N372 단위 테스트
import { describe, it, expect } from 'vitest';
import {
  appendEvent,
  loadEvents,
  rebuildProjection,
  getAggregateVersion,
  EventSourcingService,
  getEsAuditLog,
  type DomainEvent,
} from '../../src/lib/event-sourcing-cqrs-projector';

interface CounterState {
  value: number;
}

function mkEvent(aggregateId: string, version: number, delta: number): DomainEvent<{ delta: number }> {
  return {
    eventId: `e-${version}`,
    aggregateId,
    aggregateType: 'counter',
    eventType: 'increment',
    version,
    payload: { delta },
    occurredAt: new Date().toISOString(),
    actor: 'tester',
  };
}

describe('MTU-N372 EventSourcingCQRSProjector', () => {
  it('이벤트 append', () => {
    const ev = mkEvent('agg-1', 1, 5);
    const r = appendEvent('t1', ev);
    expect(r.eventId).toBe('e-1');
  });

  it('버전 불일치 시 예외', () => {
    expect(() => appendEvent('t1', mkEvent('agg-wrong', 5, 1))).toThrow(/version mismatch/);
  });

  it('loadEvents 버전 필터', () => {
    appendEvent('t1', mkEvent('agg-2', 1, 1));
    appendEvent('t1', mkEvent('agg-2', 2, 2));
    const events = loadEvents('agg-2', 2);
    expect(events.length).toBe(1);
    expect(events[0]?.version).toBe(2);
  });

  it('rebuildProjection 누적 계산', () => {
    appendEvent('t1', mkEvent('agg-3', 1, 10));
    appendEvent('t1', mkEvent('agg-3', 2, 20));
    const projector = (s: CounterState, e: DomainEvent): CounterState => ({
      value: s.value + (e.payload as { delta: number }).delta,
    });
    const result = rebuildProjection<CounterState>('agg-3', { value: 0 }, projector);
    expect(result.state.value).toBe(30);
    expect(result.version).toBe(2);
  });

  it('getAggregateVersion', () => {
    appendEvent('t1', mkEvent('agg-4', 1, 1));
    expect(getAggregateVersion('agg-4')).toBe(1);
  });

  it('서비스 클래스 append + rebuild', () => {
    const svc = new EventSourcingService<CounterState>(
      't2',
      { value: 0 },
      (s, e) => ({ value: s.value + ((e.payload as { delta: number }).delta ?? 0) }),
    );
    svc.append(mkEvent('agg-5', 1, 7));
    const r = svc.rebuild('agg-5');
    expect(r.state.value).toBe(7);
  });

  it('snapshot 저장 후 rebuild', () => {
    const svc = new EventSourcingService<CounterState>(
      't3',
      { value: 0 },
      (s, e) => ({ value: s.value + ((e.payload as { delta: number }).delta ?? 0) }),
    );
    svc.append(mkEvent('agg-6', 1, 3));
    svc.snapshot('agg-6');
    svc.append(mkEvent('agg-6', 2, 4));
    const r = svc.rebuild('agg-6');
    expect(r.state.value).toBe(7);
  });

  it('감사 로그 기록', () => {
    appendEvent('tenant-log', mkEvent('agg-log', 1, 1));
    expect(getEsAuditLog('tenant-log').length).toBeGreaterThan(0);
  });

  it('감사 로그 테넌트 격리', () => {
    appendEvent('tenant-a', mkEvent('agg-iso-a', 1, 1));
    appendEvent('tenant-b', mkEvent('agg-iso-b', 1, 1));
    expect(getEsAuditLog('tenant-a').every((e) => e.tenantId === 'tenant-a')).toBe(true);
  });

  it('빈 aggregate rebuild', () => {
    const projector = (s: CounterState): CounterState => s;
    const r = rebuildProjection<CounterState>('agg-empty', { value: 100 }, projector);
    expect(r.state.value).toBe(100);
    expect(r.version).toBe(0);
  });
});
