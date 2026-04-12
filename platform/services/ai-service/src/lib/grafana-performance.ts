// Design Ref: MTU-N90
// Plan SC: FR-N90.1~5

export interface GrafanaPerformanceConfig { enabled: boolean; namespace: string; version: string; }
export interface GrafanaPerformanceRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface GrafanaPerformanceEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface GrafanaPerformanceStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class GrafanaPerformance {
  private rules: GrafanaPerformanceRule[] = [];
  private events: GrafanaPerformanceEvent[] = [];
  validateConfig(c: GrafanaPerformanceConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: GrafanaPerformanceRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): GrafanaPerformanceEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: GrafanaPerformanceEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): GrafanaPerformanceStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): GrafanaPerformanceEvent[] { return [...this.events]; }
}
