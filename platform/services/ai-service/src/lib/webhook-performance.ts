// Design Ref: MTU-N195
// Plan SC: FR-N195.1~5

export interface WebhookPerformanceConfig { enabled: boolean; namespace: string; version: string; }
export interface WebhookPerformanceRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface WebhookPerformanceEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface WebhookPerformanceStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class WebhookPerformance {
  private rules: WebhookPerformanceRule[] = [];
  private events: WebhookPerformanceEvent[] = [];
  validateConfig(c: WebhookPerformanceConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: WebhookPerformanceRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): WebhookPerformanceEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: WebhookPerformanceEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): WebhookPerformanceStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): WebhookPerformanceEvent[] { return [...this.events]; }
}
