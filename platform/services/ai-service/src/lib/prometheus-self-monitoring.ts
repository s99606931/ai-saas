// Design Ref: MTU-N231
// Plan SC: FR-N231.1~5

export interface PrometheusSelfMonitoringConfig { enabled: boolean; namespace: string; version: string; }
export interface PrometheusSelfMonitoringRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface PrometheusSelfMonitoringEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface PrometheusSelfMonitoringStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class PrometheusSelfMonitoring {
  private rules: PrometheusSelfMonitoringRule[] = [];
  private events: PrometheusSelfMonitoringEvent[] = [];
  validateConfig(c: PrometheusSelfMonitoringConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: PrometheusSelfMonitoringRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): PrometheusSelfMonitoringEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: PrometheusSelfMonitoringEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): PrometheusSelfMonitoringStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): PrometheusSelfMonitoringEvent[] { return [...this.events]; }
}
