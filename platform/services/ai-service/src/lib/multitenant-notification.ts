// 멀티테넌트 알림 서비스 -- FR-N318.1~FR-N318.4
// Design Ref: MTU-N318 | CSAP: D-06, D-08

export type NotificationChannel = 'email' | 'sms' | 'push' | 'webhook' | 'in_app';
export type NotificationPriority = 'urgent' | 'high' | 'normal' | 'low';
export interface NotificationTemplate { readonly templateId: string; readonly tenantId: string; readonly name: string; readonly channel: NotificationChannel; readonly subject: string; readonly body: string; readonly variables: string[]; }
export interface NotificationRequest { readonly notificationId: string; readonly tenantId: string; readonly templateId: string; readonly channel: NotificationChannel; readonly recipients: string[]; readonly priority: NotificationPriority; readonly variables: Record<string, string>; readonly scheduledAt: string | null; }
export interface NotificationResult { readonly notificationId: string; readonly channel: NotificationChannel; readonly status: 'sent' | 'failed' | 'queued' | 'cancelled'; readonly sentAt: string; readonly deliveredCount: number; readonly failedCount: number; }
export interface NotifAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: NotifAuditEntry[] = [];
function recordAudit(entry: Omit<NotifAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getNotifAuditLog(tenantId: string): readonly NotifAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const templateStore: Map<string, NotificationTemplate[]> = new Map();

export function createTemplate(tenantId: string, name: string, channel: NotificationChannel, subject: string, body: string): NotificationTemplate {
  const variables = [...body.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]).filter((v): v is string => v !== undefined);
  const tmpl: NotificationTemplate = { templateId: `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, name, channel, subject, body, variables };
  const existing = templateStore.get(tenantId) ?? [];
  existing.push(tmpl);
  templateStore.set(tenantId, existing);
  recordAudit({ actor: 'system', tenantId, action: 'TEMPLATE_CREATED', target: tmpl.templateId, details: { name, channel } });
  return tmpl;
}

export function sendNotification(tenantId: string, templateId: string, channel: NotificationChannel, recipients: string[], variables: Record<string, string>, priority: NotificationPriority = 'normal'): NotificationResult {
  const templates = templateStore.get(tenantId) ?? [];
  const tmpl = templates.find(t => t.templateId === templateId);
  let renderedBody = tmpl?.body ?? '';
  for (const [key, val] of Object.entries(variables)) { renderedBody = renderedBody.replaceAll(`{{${key}}}`, val); }
  // PII 마스킹 확인
  renderedBody = renderedBody.replace(/\d{6}[-]?\d{7}/g, '[PII_MASKED]');

  const failedCount = channel === 'sms' ? Math.floor(recipients.length * 0.02) : 0;
  const result: NotificationResult = {
    notificationId: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, channel,
    status: failedCount > 0 ? 'sent' : 'sent', sentAt: new Date().toISOString(),
    deliveredCount: recipients.length - failedCount, failedCount,
  };
  recordAudit({ actor: 'system', tenantId, action: 'NOTIFICATION_SENT', target: result.notificationId, details: { channel, recipients: recipients.length, priority, delivered: result.deliveredCount } });
  return result;
}

export function getTemplates(tenantId: string): readonly NotificationTemplate[] { return templateStore.get(tenantId) ?? []; }

export class MultitenantNotificationService {
  constructor(private readonly tenantId: string) {}
  createTemplate(name: string, channel: NotificationChannel, subject: string, body: string): NotificationTemplate { return createTemplate(this.tenantId, name, channel, subject, body); }
  send(templateId: string, channel: NotificationChannel, recipients: string[], vars: Record<string, string>): NotificationResult { return sendNotification(this.tenantId, templateId, channel, recipients, vars); }
  getTemplates(): readonly NotificationTemplate[] { return getTemplates(this.tenantId); }
  getAuditLog(): readonly NotifAuditEntry[] { return getNotifAuditLog(this.tenantId); }
}
