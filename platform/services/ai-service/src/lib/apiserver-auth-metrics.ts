// Design Ref: MTU-N219
// Plan SC: FR-N219.1~5

export interface ApiserverAuthMetricsConfig { enabled: boolean; namespace: string; version: string; }
export interface ApiserverAuthMetricsRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface ApiserverAuthMetricsEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface ApiserverAuthMetricsStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class ApiserverAuthMetrics {
  private rules: ApiserverAuthMetricsRule[] = [];
  private events: ApiserverAuthMetricsEvent[] = [];
  validateConfig(c: ApiserverAuthMetricsConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: ApiserverAuthMetricsRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): ApiserverAuthMetricsEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: ApiserverAuthMetricsEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): ApiserverAuthMetricsStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): ApiserverAuthMetricsEvent[] { return [...this.events]; }
}
