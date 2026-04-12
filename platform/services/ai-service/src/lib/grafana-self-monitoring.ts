// Design Ref: MTU-N233
// Plan SC: FR-N233.1~5

export interface GrafanaSelfMonitoringConfig { enabled: boolean; namespace: string; version: string; }
export interface GrafanaSelfMonitoringRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface GrafanaSelfMonitoringEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface GrafanaSelfMonitoringStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class GrafanaSelfMonitoring {
  private rules: GrafanaSelfMonitoringRule[] = [];
  private events: GrafanaSelfMonitoringEvent[] = [];
  validateConfig(c: GrafanaSelfMonitoringConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: GrafanaSelfMonitoringRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): GrafanaSelfMonitoringEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: GrafanaSelfMonitoringEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): GrafanaSelfMonitoringStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): GrafanaSelfMonitoringEvent[] { return [...this.events]; }
}
