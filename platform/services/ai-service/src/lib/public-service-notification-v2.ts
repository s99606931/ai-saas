// Design Ref: §R339 — AI기반 공공 서비스 알림 자동화 v2
// Plan SC: SC-R339

export interface NotificationTemplate {
  templateId: string
  eventType: string
  channel: 'SMS' | 'EMAIL' | 'PUSH' | 'KAKAO'
  titleTemplate: string
  bodyTemplate: string
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'
}

export interface NotificationEvent {
  eventId: string
  eventType: string
  userId: string
  variables: Record<string, string>
  timestamp: number
}

export interface NotificationResult {
  eventId: string
  userId: string
  maskedUserId: string
  channel: NotificationTemplate['channel']
  title: string
  body: string
  priority: NotificationTemplate['priority']
  status: 'QUEUED' | 'SKIPPED_NO_TEMPLATE'
}

export interface BatchNotificationResult {
  totalEvents: number
  queuedCount: number
  skippedCount: number
  results: NotificationResult[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`)
}

function maskUserId(userId: string): string {
  if (userId.length <= 3) return '*'.repeat(userId.length)
  return userId.slice(0, 2) + '*'.repeat(userId.length - 4) + userId.slice(-2)
}

export class PublicServiceNotificationV2 {
  private templates = new Map<string, NotificationTemplate>()
  private auditLog: AuditEntry[] = []

  registerTemplate(template: NotificationTemplate): void {
    this.templates.set(template.templateId, template)
    this.auditLog.push({ action: 'template.register', timestamp: new Date().toISOString(), detail: template.templateId })
  }

  dispatch(event: NotificationEvent): NotificationResult {
    const template = Array.from(this.templates.values()).find((t) => t.eventType === event.eventType)

    if (!template) {
      this.auditLog.push({ action: 'notification.skip', timestamp: new Date().toISOString(), detail: `${event.eventId}:NO_TEMPLATE` })
      return {
        eventId: event.eventId,
        userId: event.userId,
        maskedUserId: maskUserId(event.userId),
        channel: 'EMAIL',
        title: '',
        body: '',
        priority: 'NORMAL',
        status: 'SKIPPED_NO_TEMPLATE',
      }
    }

    const title = renderTemplate(template.titleTemplate, event.variables)
    const body = renderTemplate(template.bodyTemplate, event.variables)

    this.auditLog.push({ action: 'notification.dispatch', timestamp: new Date().toISOString(), detail: `${event.eventId}:${template.channel}` })
    return {
      eventId: event.eventId,
      userId: event.userId,
      maskedUserId: maskUserId(event.userId),
      channel: template.channel,
      title,
      body,
      priority: template.priority,
      status: 'QUEUED',
    }
  }

  dispatchBatch(events: NotificationEvent[]): BatchNotificationResult {
    const results = events.map((e) => this.dispatch(e))
    const queuedCount = results.filter((r) => r.status === 'QUEUED').length
    const skippedCount = results.filter((r) => r.status === 'SKIPPED_NO_TEMPLATE').length
    this.auditLog.push({ action: 'notification.batch', timestamp: new Date().toISOString(), detail: `queued=${queuedCount}` })
    return { totalEvents: events.length, queuedCount, skippedCount, results }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
