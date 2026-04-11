// 점검 일정 관리 -- FR-N369.1~FR-N369.4
// Design Ref: MTU-N369 | CSAP: D-06, D-08

export interface MaintenanceWindow { readonly windowId: string; readonly tenantId: string; readonly title: string; readonly startTime: string; readonly endTime: string; readonly services: readonly string[]; readonly status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'; }
export interface WindowConflict { readonly windowA: string; readonly windowB: string; readonly overlappingServices: readonly string[]; readonly overlapStart: string; readonly overlapEnd: string; }
export interface MaintAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: MaintAuditEntry[] = [];
function recordAudit(entry: Omit<MaintAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getMaintAuditLog(tenantId: string): readonly MaintAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const windowStore: Map<string, MaintenanceWindow[]> = new Map();

export function scheduleWindow(tenantId: string, title: string, startTime: string, endTime: string, services: string[]): MaintenanceWindow {
  const win: MaintenanceWindow = { windowId: `mw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, tenantId, title, startTime, endTime, services, status: 'scheduled' };
  const existing = windowStore.get(tenantId) ?? [];
  existing.push(win);
  windowStore.set(tenantId, existing);
  recordAudit({ actor: 'system', tenantId, action: 'MAINTENANCE_SCHEDULED', target: win.windowId, details: { title, services } });
  return win;
}

export function checkConflicts(tenantId: string): WindowConflict[] {
  const windows = windowStore.get(tenantId) ?? [];
  const conflicts: WindowConflict[] = [];
  for (let i = 0; i < windows.length; i++) {
    for (let j = i + 1; j < windows.length; j++) {
      const a = windows[i]!;
      const b = windows[j]!;
      if (a.status === 'cancelled' || b.status === 'cancelled') continue;
      const aStart = new Date(a.startTime).getTime();
      const aEnd = new Date(a.endTime).getTime();
      const bStart = new Date(b.startTime).getTime();
      const bEnd = new Date(b.endTime).getTime();
      if (aStart < bEnd && bStart < aEnd) {
        const overlap = a.services.filter(s => b.services.includes(s));
        if (overlap.length > 0) {
          conflicts.push({ windowA: a.windowId, windowB: b.windowId, overlappingServices: overlap, overlapStart: new Date(Math.max(aStart, bStart)).toISOString(), overlapEnd: new Date(Math.min(aEnd, bEnd)).toISOString() });
        }
      }
    }
  }
  return conflicts;
}

export function getWindows(tenantId: string): readonly MaintenanceWindow[] { return windowStore.get(tenantId) ?? []; }

export class MaintenanceWindowManagerService {
  constructor(private readonly tenantId: string) {}
  schedule(title: string, start: string, end: string, services: string[]): MaintenanceWindow { return scheduleWindow(this.tenantId, title, start, end, services); }
  checkConflicts(): WindowConflict[] { return checkConflicts(this.tenantId); }
  list(): readonly MaintenanceWindow[] { return getWindows(this.tenantId); }
  getAuditLog(): readonly MaintAuditEntry[] { return getMaintAuditLog(this.tenantId); }
}
