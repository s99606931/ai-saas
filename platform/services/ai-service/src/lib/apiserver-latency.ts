// Design Ref: MTU-N200
// Plan SC: FR-N200.1~5

export interface ApiserverLatencyConfig { enabled: boolean; namespace: string; version: string; }
export interface ApiserverLatencyRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface ApiserverLatencyEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface ApiserverLatencyStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class ApiserverLatency {
  private rules: ApiserverLatencyRule[] = [];
  private events: ApiserverLatencyEvent[] = [];
  validateConfig(c: ApiserverLatencyConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: ApiserverLatencyRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): ApiserverLatencyEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: ApiserverLatencyEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): ApiserverLatencyStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): ApiserverLatencyEvent[] { return [...this.events]; }
}
