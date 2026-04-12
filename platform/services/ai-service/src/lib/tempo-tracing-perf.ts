// Design Ref: MTU-N230
// Plan SC: FR-N230.1~5

export interface TempoTracingPerfConfig { enabled: boolean; namespace: string; version: string; }
export interface TempoTracingPerfRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface TempoTracingPerfEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface TempoTracingPerfStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class TempoTracingPerf {
  private rules: TempoTracingPerfRule[] = [];
  private events: TempoTracingPerfEvent[] = [];
  validateConfig(c: TempoTracingPerfConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: TempoTracingPerfRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): TempoTracingPerfEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: TempoTracingPerfEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): TempoTracingPerfStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): TempoTracingPerfEvent[] { return [...this.events]; }
}
