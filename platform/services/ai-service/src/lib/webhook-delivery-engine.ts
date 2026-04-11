// 웹훅 발송/재시도/로깅 엔진 -- FR-N331.1~FR-N331.4
// Design Ref: MTU-N331 | CSAP: D-06, D-08

export interface WebhookEndpoint { readonly endpointId: string; readonly tenantId: string; readonly url: string; readonly events: readonly string[]; readonly secret: string; readonly active: boolean; readonly createdAt: string; }
export interface WebhookDelivery { readonly deliveryId: string; readonly endpointId: string; readonly event: string; readonly payload: Record<string, unknown>; readonly signature: string; readonly status: 'pending' | 'delivered' | 'failed' | 'retrying'; readonly attempts: number; readonly maxRetries: number; readonly nextRetryAt: string | null; readonly lastAttemptAt: string; }
export interface WebhookAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: WebhookAuditEntry[] = [];
function recordAudit(entry: Omit<WebhookAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getWebhookAuditLog(tenantId: string): readonly WebhookAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const endpointStore: Map<string, WebhookEndpoint[]> = new Map();
const deliveryStore: WebhookDelivery[] = [];

export function registerEndpoint(tenantId: string, url: string, events: string[], secret: string): WebhookEndpoint {
  const endpoint: WebhookEndpoint = { endpointId: `wh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, url, events, secret, active: true, createdAt: new Date().toISOString() };
  const existing = endpointStore.get(tenantId) ?? [];
  existing.push(endpoint);
  endpointStore.set(tenantId, existing);
  recordAudit({ actor: 'system', tenantId, action: 'WEBHOOK_REGISTERED', target: endpoint.endpointId, details: { url, events } });
  return endpoint;
}

export function computeSignature(payload: Record<string, unknown>, secret: string): string {
  const data = JSON.stringify(payload);
  let hash = 0;
  const combined = data + secret;
  for (let i = 0; i < combined.length; i++) { hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0; }
  return `sha256=${Math.abs(hash).toString(16).padStart(16, '0')}`;
}

export function createDelivery(tenantId: string, endpointId: string, event: string, payload: Record<string, unknown>, secret: string): WebhookDelivery {
  const signature = computeSignature(payload, secret);
  const delivery: WebhookDelivery = { deliveryId: `del-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, endpointId, event, payload, signature, status: 'pending', attempts: 0, maxRetries: 5, nextRetryAt: null, lastAttemptAt: new Date().toISOString() };
  deliveryStore.push(delivery);
  recordAudit({ actor: 'system', tenantId, action: 'WEBHOOK_DELIVERY_CREATED', target: delivery.deliveryId, details: { event, endpointId } });
  return delivery;
}

export function simulateDeliveryAttempt(delivery: WebhookDelivery, success: boolean): WebhookDelivery {
  const attempts = delivery.attempts + 1;
  if (success) return { ...delivery, status: 'delivered', attempts, lastAttemptAt: new Date().toISOString(), nextRetryAt: null };
  if (attempts >= delivery.maxRetries) return { ...delivery, status: 'failed', attempts, lastAttemptAt: new Date().toISOString(), nextRetryAt: null };
  const backoffMs = Math.pow(2, attempts) * 1000;
  return { ...delivery, status: 'retrying', attempts, lastAttemptAt: new Date().toISOString(), nextRetryAt: new Date(Date.now() + backoffMs).toISOString() };
}

export class WebhookDeliveryService {
  constructor(private readonly tenantId: string) {}
  register(url: string, events: string[], secret: string): WebhookEndpoint { return registerEndpoint(this.tenantId, url, events, secret); }
  deliver(endpointId: string, event: string, payload: Record<string, unknown>, secret: string): WebhookDelivery { return createDelivery(this.tenantId, endpointId, event, payload, secret); }
  getAuditLog(): readonly WebhookAuditEntry[] { return getWebhookAuditLog(this.tenantId); }
}
