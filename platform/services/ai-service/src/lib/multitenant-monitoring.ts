// Design Ref: MTU-N96
// Plan SC: FR-N96.1~5

export interface MultitenantMonitoringConfig { enabled: boolean; namespace: string; version: string; }
export interface MultitenantMonitoringRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface MultitenantMonitoringEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface MultitenantMonitoringStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class MultitenantMonitoring {
  private rules: MultitenantMonitoringRule[] = [];
  private events: MultitenantMonitoringEvent[] = [];
  validateConfig(c: MultitenantMonitoringConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: MultitenantMonitoringRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): MultitenantMonitoringEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: MultitenantMonitoringEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): MultitenantMonitoringStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): MultitenantMonitoringEvent[] { return [...this.events]; }
}
