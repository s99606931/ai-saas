// Design Ref: MTU-N75
// Plan SC: FR-N75.1~5

export interface AdmissionWebhookSecurityConfig { enabled: boolean; namespace: string; version: string; }
export interface AdmissionWebhookSecurityRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface AdmissionWebhookSecurityEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface AdmissionWebhookSecurityStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class AdmissionWebhookSecurity {
  private rules: AdmissionWebhookSecurityRule[] = [];
  private events: AdmissionWebhookSecurityEvent[] = [];
  validateConfig(c: AdmissionWebhookSecurityConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: AdmissionWebhookSecurityRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): AdmissionWebhookSecurityEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: AdmissionWebhookSecurityEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): AdmissionWebhookSecurityStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): AdmissionWebhookSecurityEvent[] { return [...this.events]; }
}
