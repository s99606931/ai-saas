// 알림 선호 설정 엔진 -- FR-N362.1~FR-N362.4
// Design Ref: MTU-N362 | CSAP: D-06, D-08

export interface NotificationChannel { readonly channelId: string; readonly name: string; readonly type: 'email' | 'sms' | 'push' | 'webhook' | 'in_app'; readonly enabled: boolean; }
export interface UserPreference { readonly userId: string; readonly tenantId: string; readonly channels: Record<string, boolean>; readonly quietHoursStart: string | null; readonly quietHoursEnd: string | null; readonly categories: Record<string, boolean>; }
export interface NotifPrefAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: NotifPrefAuditEntry[] = [];
function recordAudit(entry: Omit<NotifPrefAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getNotifPrefAuditLog(tenantId: string): readonly NotifPrefAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const channelStore: NotificationChannel[] = [];
const prefStore: Map<string, UserPreference> = new Map();

export function registerChannel(name: string, type: NotificationChannel['type']): NotificationChannel {
  const ch: NotificationChannel = { channelId: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, type, enabled: true };
  channelStore.push(ch);
  return ch;
}

export function setPreference(tenantId: string, userId: string, channels: Record<string, boolean>, categories: Record<string, boolean> = {}, quietStart: string | null = null, quietEnd: string | null = null): UserPreference {
  const pref: UserPreference = { userId, tenantId, channels, quietHoursStart: quietStart, quietHoursEnd: quietEnd, categories };
  prefStore.set(`${tenantId}:${userId}`, pref);
  recordAudit({ actor: userId, tenantId, action: 'PREFERENCE_SET', target: userId, details: { channels, categories } });
  return pref;
}

export function getPreference(tenantId: string, userId: string): UserPreference | null { return prefStore.get(`${tenantId}:${userId}`) ?? null; }

export function shouldNotify(tenantId: string, userId: string, channel: string, category: string): boolean {
  const pref = prefStore.get(`${tenantId}:${userId}`);
  if (!pref) return true; // 기본: 모두 허용
  if (pref.channels[channel] === false) return false;
  if (pref.categories[category] === false) return false;
  if (pref.quietHoursStart && pref.quietHoursEnd) {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const current = h * 60 + m;
    const [sh, sm] = pref.quietHoursStart.split(':').map(Number);
    const [eh, em] = pref.quietHoursEnd.split(':').map(Number);
    const start = (sh ?? 0) * 60 + (sm ?? 0);
    const end = (eh ?? 0) * 60 + (em ?? 0);
    if (start <= end) { if (current >= start && current <= end) return false; }
    else { if (current >= start || current <= end) return false; }
  }
  return true;
}

export class NotificationPreferenceService {
  constructor(private readonly tenantId: string) {}
  registerChannel(name: string, type: NotificationChannel['type']): NotificationChannel { return registerChannel(name, type); }
  setPreference(userId: string, channels: Record<string, boolean>, categories?: Record<string, boolean>): UserPreference { return setPreference(this.tenantId, userId, channels, categories); }
  getPreference(userId: string): UserPreference | null { return getPreference(this.tenantId, userId); }
  shouldNotify(userId: string, channel: string, category: string): boolean { return shouldNotify(this.tenantId, userId, channel, category); }
  getAuditLog(): readonly NotifPrefAuditEntry[] { return getNotifPrefAuditLog(this.tenantId); }
}
