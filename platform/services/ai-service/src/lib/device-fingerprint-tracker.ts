// 장치 핑거프린팅 추적 -- FR-N364.1~FR-N364.4
// Design Ref: MTU-N364 | CSAP: D-06, D-08

export interface DeviceFingerprint { readonly fingerprintId: string; readonly userId: string; readonly userAgent: string; readonly screenResolution: string; readonly timezone: string; readonly language: string; readonly hash: string; readonly firstSeen: string; readonly lastSeen: string; }
export interface DeviceHistory { readonly userId: string; readonly devices: readonly DeviceFingerprint[]; readonly totalDevices: number; }
export interface NewDeviceAlert { readonly userId: string; readonly fingerprint: DeviceFingerprint; readonly isNew: boolean; readonly riskLevel: 'low' | 'medium' | 'high'; }
export interface DeviceAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: DeviceAuditEntry[] = [];
function recordAudit(entry: Omit<DeviceAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getDeviceAuditLog(tenantId: string): readonly DeviceAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const deviceStore: Map<string, DeviceFingerprint[]> = new Map();

function computeHash(ua: string, res: string, tz: string, lang: string): string {
  let h = 0;
  const s = `${ua}|${res}|${tz}|${lang}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).padStart(8, '0');
}

export function createFingerprint(userId: string, ua: string, resolution: string, timezone: string, language: string): DeviceFingerprint {
  const hash = computeHash(ua, resolution, timezone, language);
  const now = new Date().toISOString();
  return { fingerprintId: `fp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, userId, userAgent: ua, screenResolution: resolution, timezone, language, hash, firstSeen: now, lastSeen: now };
}

export function trackDevice(tenantId: string, userId: string, fp: DeviceFingerprint): NewDeviceAlert {
  const key = `${tenantId}:${userId}`;
  const existing = deviceStore.get(key) ?? [];
  const known = existing.find(d => d.hash === fp.hash);
  if (known) {
    const idx = existing.indexOf(known);
    existing[idx] = { ...known, lastSeen: new Date().toISOString() };
    return { userId, fingerprint: existing[idx]!, isNew: false, riskLevel: 'low' };
  }
  existing.push(fp);
  deviceStore.set(key, existing);
  const riskLevel: NewDeviceAlert['riskLevel'] = existing.length > 5 ? 'high' : existing.length > 2 ? 'medium' : 'low';
  recordAudit({ actor: userId, tenantId, action: 'NEW_DEVICE_DETECTED', target: fp.fingerprintId, details: { hash: fp.hash, totalDevices: existing.length } });
  return { userId, fingerprint: fp, isNew: true, riskLevel };
}

export function getDeviceHistory(tenantId: string, userId: string): DeviceHistory {
  const devices = deviceStore.get(`${tenantId}:${userId}`) ?? [];
  return { userId, devices, totalDevices: devices.length };
}

export class DeviceFingerprintTrackerService {
  constructor(private readonly tenantId: string) {}
  fingerprint(userId: string, ua: string, res: string, tz: string, lang: string): DeviceFingerprint { return createFingerprint(userId, ua, res, tz, lang); }
  track(userId: string, fp: DeviceFingerprint): NewDeviceAlert { return trackDevice(this.tenantId, userId, fp); }
  history(userId: string): DeviceHistory { return getDeviceHistory(this.tenantId, userId); }
  getAuditLog(): readonly DeviceAuditEntry[] { return getDeviceAuditLog(this.tenantId); }
}
