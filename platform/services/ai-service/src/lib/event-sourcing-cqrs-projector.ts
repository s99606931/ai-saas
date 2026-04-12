// 이벤트 소싱 CQRS 프로젝터 -- FR-N372.1~FR-N372.5
// Design Ref: MTU-N372 | CSAP: D-06, D-08

export interface DomainEvent<T = unknown> {
  readonly eventId: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly eventType: string;
  readonly version: number;
  readonly payload: T;
  readonly occurredAt: string;
  readonly actor: string;
}

export interface Snapshot<S = unknown> {
  readonly aggregateId: string;
  readonly version: number;
  readonly state: S;
  readonly takenAt: string;
}

export type Projector<S> = (state: S, event: DomainEvent) => S;

export interface EsAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const eventStore: DomainEvent[] = [];
const snapshots: Snapshot[] = [];
const auditLog: EsAuditEntry[] = [];

function recordAudit(entry: Omit<EsAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getEsAuditLog(tenantId: string): readonly EsAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

export function appendEvent<T>(tenantId: string, event: DomainEvent<T>): DomainEvent<T> {
  const existing = eventStore.filter((e) => e.aggregateId === event.aggregateId);
  const expectedVersion = existing.length + 1;
  if (event.version !== expectedVersion) {
    throw new Error(`version mismatch: expected ${expectedVersion}, got ${event.version}`);
  }
  eventStore.push(event as DomainEvent);
  recordAudit({
    actor: event.actor,
    tenantId,
    action: 'EVENT_APPENDED',
    target: event.aggregateId,
    details: { eventType: event.eventType, version: event.version },
  });
  return event;
}

export function loadEvents(aggregateId: string, fromVersion = 1): readonly DomainEvent[] {
  return eventStore.filter((e) => e.aggregateId === aggregateId && e.version >= fromVersion);
}

export function saveSnapshot<S>(tenantId: string, snapshot: Snapshot<S>): void {
  snapshots.push(snapshot as Snapshot);
  recordAudit({
    actor: 'system',
    tenantId,
    action: 'SNAPSHOT_SAVED',
    target: snapshot.aggregateId,
    details: { version: snapshot.version },
  });
}

export function loadLatestSnapshot<S>(aggregateId: string): Snapshot<S> | undefined {
  const filtered = snapshots.filter((s) => s.aggregateId === aggregateId);
  if (filtered.length === 0) return undefined;
  return filtered.reduce((latest, cur) => (cur.version > latest.version ? cur : latest)) as Snapshot<S>;
}

export function rebuildProjection<S>(
  aggregateId: string,
  initialState: S,
  projector: Projector<S>,
): { state: S; version: number } {
  const snap = loadLatestSnapshot<S>(aggregateId);
  let state = snap?.state ?? initialState;
  const fromVersion = (snap?.version ?? 0) + 1;
  const events = loadEvents(aggregateId, fromVersion);
  for (const ev of events) {
    state = projector(state, ev);
  }
  const lastVersion = events.length > 0 ? (events[events.length - 1]?.version ?? snap?.version ?? 0) : (snap?.version ?? 0);
  return { state, version: lastVersion };
}

export function getAggregateVersion(aggregateId: string): number {
  return eventStore.filter((e) => e.aggregateId === aggregateId).length;
}

export class EventSourcingService<S> {
  constructor(
    private readonly tenantId: string,
    private readonly initialState: S,
    private readonly projector: Projector<S>,
  ) {}
  append(event: DomainEvent): DomainEvent {
    return appendEvent(this.tenantId, event);
  }
  rebuild(aggregateId: string): { state: S; version: number } {
    return rebuildProjection(aggregateId, this.initialState, this.projector);
  }
  snapshot(aggregateId: string): void {
    const { state, version } = this.rebuild(aggregateId);
    saveSnapshot(this.tenantId, { aggregateId, version, state, takenAt: new Date().toISOString() });
  }
  getAuditLog(): readonly EsAuditEntry[] {
    return getEsAuditLog(this.tenantId);
  }
}
