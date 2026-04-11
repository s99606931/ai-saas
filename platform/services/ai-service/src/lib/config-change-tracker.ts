// 구성 변경 추적/비교/롤백 -- FR-N338.1~FR-N338.4
// Design Ref: MTU-N338 | CSAP: D-06, D-08, D-13

export interface ConfigSnapshot { readonly snapshotId: string; readonly tenantId: string; readonly configName: string; readonly version: number; readonly data: Record<string, unknown>; readonly createdAt: string; readonly createdBy: string; }
export interface ConfigDiff { readonly property: string; readonly oldValue: unknown; readonly newValue: unknown; readonly changeType: 'added' | 'modified' | 'removed'; }
export interface ConfigChangeAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: ConfigChangeAuditEntry[] = [];
function recordAudit(entry: Omit<ConfigChangeAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getConfigAuditLog(tenantId: string): readonly ConfigChangeAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const snapshotStore: Map<string, ConfigSnapshot[]> = new Map();

export function saveSnapshot(tenantId: string, configName: string, data: Record<string, unknown>, createdBy: string = 'system'): ConfigSnapshot {
  const key = `${tenantId}:${configName}`;
  const existing = snapshotStore.get(key) ?? [];
  const version = existing.length + 1;
  const snap: ConfigSnapshot = { snapshotId: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, configName, version, data: structuredClone(data), createdAt: new Date().toISOString(), createdBy };
  existing.push(snap);
  snapshotStore.set(key, existing);
  recordAudit({ actor: createdBy, tenantId, action: 'CONFIG_SNAPSHOT_SAVED', target: configName, details: { version } });
  return snap;
}

export function getSnapshots(tenantId: string, configName: string): readonly ConfigSnapshot[] {
  return snapshotStore.get(`${tenantId}:${configName}`) ?? [];
}

export function diffSnapshots(oldSnap: ConfigSnapshot, newSnap: ConfigSnapshot): ConfigDiff[] {
  const diffs: ConfigDiff[] = [];
  const oldKeys = new Set(Object.keys(oldSnap.data));
  const newKeys = new Set(Object.keys(newSnap.data));
  for (const key of newKeys) {
    if (!oldKeys.has(key)) diffs.push({ property: key, oldValue: undefined, newValue: newSnap.data[key], changeType: 'added' });
    else if (JSON.stringify(oldSnap.data[key]) !== JSON.stringify(newSnap.data[key])) diffs.push({ property: key, oldValue: oldSnap.data[key], newValue: newSnap.data[key], changeType: 'modified' });
  }
  for (const key of oldKeys) {
    if (!newKeys.has(key)) diffs.push({ property: key, oldValue: oldSnap.data[key], newValue: undefined, changeType: 'removed' });
  }
  return diffs;
}

export function rollback(tenantId: string, configName: string, targetVersion: number): ConfigSnapshot | null {
  const key = `${tenantId}:${configName}`;
  const snapshots = snapshotStore.get(key) ?? [];
  const target = snapshots.find(s => s.version === targetVersion);
  if (!target) return null;
  const restored = saveSnapshot(tenantId, configName, target.data, 'rollback');
  recordAudit({ actor: 'system', tenantId, action: 'CONFIG_ROLLBACK', target: configName, details: { fromVersion: snapshots.length, toVersion: targetVersion } });
  return restored;
}

export class ConfigChangeTrackerService {
  constructor(private readonly tenantId: string) {}
  save(name: string, data: Record<string, unknown>, by?: string): ConfigSnapshot { return saveSnapshot(this.tenantId, name, data, by); }
  history(name: string): readonly ConfigSnapshot[] { return getSnapshots(this.tenantId, name); }
  diff(old: ConfigSnapshot, neu: ConfigSnapshot): ConfigDiff[] { return diffSnapshots(old, neu); }
  rollback(name: string, version: number): ConfigSnapshot | null { return rollback(this.tenantId, name, version); }
  getAuditLog(): readonly ConfigChangeAuditEntry[] { return getConfigAuditLog(this.tenantId); }
}
