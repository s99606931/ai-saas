// Design Ref: MTU-N232
// Plan SC: FR-N232.1~5

export interface AlertmanagerDeliveryPerfConfig { enabled: boolean; namespace: string; version: string; }
export interface AlertmanagerDeliveryPerfRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface AlertmanagerDeliveryPerfEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface AlertmanagerDeliveryPerfStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class AlertmanagerDeliveryPerf {
  private rules: AlertmanagerDeliveryPerfRule[] = [];
  private events: AlertmanagerDeliveryPerfEvent[] = [];
  validateConfig(c: AlertmanagerDeliveryPerfConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: AlertmanagerDeliveryPerfRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): AlertmanagerDeliveryPerfEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: AlertmanagerDeliveryPerfEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): AlertmanagerDeliveryPerfStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): AlertmanagerDeliveryPerfEvent[] { return [...this.events]; }
}
