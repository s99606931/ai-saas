// Design Ref: MTU-N234
// Plan SC: FR-N234.1~5

export interface OtelCollectorMonitoringConfig { enabled: boolean; namespace: string; version: string; }
export interface OtelCollectorMonitoringRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface OtelCollectorMonitoringEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface OtelCollectorMonitoringStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class OtelCollectorMonitoring {
  private rules: OtelCollectorMonitoringRule[] = [];
  private events: OtelCollectorMonitoringEvent[] = [];
  validateConfig(c: OtelCollectorMonitoringConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: OtelCollectorMonitoringRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): OtelCollectorMonitoringEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: OtelCollectorMonitoringEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): OtelCollectorMonitoringStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): OtelCollectorMonitoringEvent[] { return [...this.events]; }
}
