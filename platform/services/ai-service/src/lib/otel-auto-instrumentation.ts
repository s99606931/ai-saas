// Design Ref: MTU-N175
// Plan SC: FR-N175.1~5

export interface OtelAutoInstrumentationConfig { enabled: boolean; namespace: string; version: string; }
export interface OtelAutoInstrumentationRule { id: string; name: string; severity: 'low'|'medium'|'high'|'critical'; action: 'alert'|'block'|'log'; }
export interface OtelAutoInstrumentationEvent { ruleId: string; actor: string; resource: string; at: string; severity: string; }
export interface OtelAutoInstrumentationStatus { healthy: boolean; rulesLoaded: number; eventsProcessed: number; }

export class OtelAutoInstrumentation {
  private rules: OtelAutoInstrumentationRule[] = [];
  private events: OtelAutoInstrumentationEvent[] = [];
  validateConfig(c: OtelAutoInstrumentationConfig): boolean { if (!c.namespace || !c.version) return false; return c.enabled; }
  registerRule(r: OtelAutoInstrumentationRule): void { if (this.rules.some((x) => x.id === r.id)) throw new Error('Duplicate'); this.rules.push(r); }
  evaluate(actor: string, resource: string, ruleId: string): OtelAutoInstrumentationEvent {
    const r = this.rules.find((x) => x.id === ruleId);
    if (!r) throw new Error('Not found');
    const ev: OtelAutoInstrumentationEvent = { ruleId, actor, resource, at: new Date().toISOString(), severity: r.severity };
    this.events.push(ev);
    return ev;
  }
  getStatus(): OtelAutoInstrumentationStatus { return { healthy: this.rules.length > 0, rulesLoaded: this.rules.length, eventsProcessed: this.events.length }; }
  getAuditLog(): OtelAutoInstrumentationEvent[] { return [...this.events]; }
}
